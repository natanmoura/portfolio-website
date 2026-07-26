/* ═══════════════════════════════════════════════════════════════
   Top modes (Recipes/Plan) · List/Tile/Orbit · search · sort ·
   meal plan · grocery list · saved plans
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const RECIPES = window.RECIPES || [];
  const AISLES = window.AISLES || [];
  const DISCRETE = window.DISCRETE_UNITS || [null, '', 'bunch', 'can', 'block', 'head', 'jar', 'pack'];

  const PLAN_KEY = 'mbfr.plan.v2';
  const EDITS_KEY = 'mbfr.edits.v2';
  const SAVED_KEY = 'mbfr.saved.v1';
  const SPICE_AISLE = 'Spices & Dried Herbs';

  const $ = (id) => document.getElementById(id);

  const el = {
    meta: $('mastheadMeta'),
    topInk: $('topInk'),
    planCount: $('planCount'),
    search: $('search'),
    searchWrap: $('searchWrap'),
    searchClear: $('searchClear'),
    autofill: $('autofill'),
    viewSelect: $('viewSelect'),
    viewSelectWrap: $('viewSelectWrap'),
    sort: $('sort'),
    sortWrap: $('sortWrap'),
    list: $('recipeList'),
    tileGrid: $('tileGrid'),
    controls: $('controls'),
    chosenList: $('chosenList'),
    chosenSub: $('chosenSub'),
    groceryList: $('groceryList'),
    grocerySub: $('grocerySub'),
    copyBtn: $('copyBtn'),
    copyLabel: $('copyLabel'),
    spiceBtn: $('spiceBtn'),
    trashBtn: $('trashBtn'),
    trashCount: $('trashCount'),
    undoBtn: $('undoBtn'),
    savedList: $('savedList'),
    publishBtn: $('publishBtn'),
    planName: $('planName'),
    toast: $('toast'),
    toastMsg: $('toastMsg'),
    toastUndo: $('toastUndo'),
  };

  /* ── State ───────────────────────────────────────────── */

  const state = {
    topMode: 'recipes',   // 'recipes' | 'plan'
    subMode: 'list',      // 'list' | 'tile' | 'orbit' — remembered across a Plan visit
    query: '',
    sort: 'az',
    // plan: [{ slug, servings }]
    plan: load(PLAN_KEY, []),
    // edits: { "name|unit": { amount, removed } }
    edits: load(EDITS_KEY, {}),
    saved: load(SAVED_KEY, []),
    selected: new Set(),  // grocery keys checked for bulk delete — transient, not persisted
    afIndex: -1,
    animate: true,        // only animate rows on a real content change
  };

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
  }

  /* ── Search index ────────────────────────────────────── */

  const index = RECIPES.map((r) => {
    const ingredients = [];
    const body = [];
    r.components.forEach((c) => {
      c.ingredients.forEach((i) => ingredients.push(i.n));
      c.steps.forEach((s) => body.push(s));
      body.push(c.name);
    });
    return {
      slug: r.slug,
      recipe: r,
      title: r.title.toLowerCase(),
      ingredients: ingredients.map((s) => s.toLowerCase()),
      ingredientLabel: dedupe(ingredients),
      body: body.join(' ').toLowerCase(),
    };
  });

  function dedupe(arr) {
    const seen = new Set();
    return arr.filter((s) => {
      const k = s.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  function score(entry, q) {
    if (!q) return 1;
    const t = entry.title;
    if (t === q) return 1000;
    if (t.startsWith(q)) return 900;
    if (t.includes(q)) return 800;
    if (t.split(/\s+/).some((w) => w.startsWith(q))) return 700;

    let best = 0;
    for (const ing of entry.ingredients) {
      if (ing === q) { best = Math.max(best, 600); continue; }
      if (ing.startsWith(q)) { best = Math.max(best, 550); continue; }
      if (ing.includes(q)) best = Math.max(best, 500);
    }
    if (best) return best;
    if (entry.body.includes(q)) return 200;
    return 0;
  }

  function matched(entry, q) {
    if (!q || entry.title.includes(q)) return null;
    const ing = entry.ingredientLabel.find((i) => i.toLowerCase().includes(q));
    if (ing) return ing;
    if (entry.body.includes(q)) return 'in the method';
    return null;
  }

  function results() {
    const q = state.query.trim().toLowerCase();
    const out = index
      .map((e) => ({ entry: e, s: score(e, q), why: matched(e, q) }))
      .filter((x) => x.s > 0);

    if (q) out.sort((a, b) => b.s - a.s || a.entry.title.localeCompare(b.entry.title));
    else out.sort((a, b) => sortCompare(a.entry.recipe, b.entry.recipe));
    return out;
  }

  function sortCompare(a, b) {
    switch (state.sort) {
      case 'za': return b.title.localeCompare(a.title);
      case 'newest': return b.order - a.order;
      case 'oldest': return a.order - b.order;
      default: return a.title.localeCompare(b.title);
    }
  }

  /* ── Amounts ─────────────────────────────────────────── */

  const FRACTIONS = [
    [0.125, '⅛'], [0.25, '¼'], [0.333, '⅓'], [0.375, '⅜'],
    [0.5, '½'], [0.625, '⅝'], [0.666, '⅔'], [0.75, '¾'], [0.875, '⅞'],
  ];

  function fmtQty(q) {
    if (q === null || q === undefined) return '';
    const whole = Math.floor(q + 1e-9);
    const frac = q - whole;
    let fracStr = '';
    if (frac > 0.02) {
      const hit = FRACTIONS.find(([v]) => Math.abs(frac - v) < 0.035);
      fracStr = hit ? hit[1] : String(Math.round(frac * 100) / 100).replace(/^0/, '');
    }
    if (whole === 0) return fracStr || '0';
    return whole + fracStr;
  }

  function fmtAmount(q, u) {
    const n = fmtQty(q);
    if (!n && !u) return '';
    if (!u) return n;
    return n ? `${n} ${u}` : u;
  }

  const isDiscrete = (u) => DISCRETE.indexOf(u || null) !== -1 || DISCRETE.indexOf(u) !== -1;

  /* You can't buy 1.3 lemons. Round discrete things up, and round
     weights and volumes to a number you'd actually read off a label. */
  function roundForBuying(q, u) {
    if (q === null || q === undefined) return { q, rounded: false, from: null };
    if (isDiscrete(u)) {
      const up = Math.ceil(q - 1e-9);
      return { q: up, rounded: Math.abs(up - q) > 0.05, from: q };
    }
    if (u === 'g' || u === 'mL') {
      const step = q >= 200 ? 50 : 10;
      const up = Math.ceil(q / step) * step;
      return { q: up, rounded: Math.abs(up - q) > 0.5, from: q };
    }
    const up = Math.round(q * 4) / 4;
    return { q: up, rounded: false, from: q };
  }

  /* How much a +/- press should move, in purchase units. */
  function stepFor(u) {
    if (isDiscrete(u)) return 1;
    if (u === 'g') return 50;
    if (u === 'mL') return 50;
    return 1;
  }

  /* ── Plan helpers ────────────────────────────────────── */

  const planEntry = (slug) => state.plan.find((p) => p.slug === slug);
  const planHas = (slug) => !!planEntry(slug);
  const recipeBySlug = (slug) => RECIPES.find((r) => r.slug === slug);

  function togglePlan(slug, servings) {
    const i = state.plan.findIndex((p) => p.slug === slug);
    if (i === -1) {
      const r = recipeBySlug(slug);
      state.plan.push({ slug, servings: servings || (r ? r.servings.n : 1) });
    } else {
      state.plan.splice(i, 1);
    }
    save(PLAN_KEY, state.plan);
    updatePlanCount();
    patchRow(slug);
    patchTile(slug);
    renderPlan();
  }

  function setServings(slug, n) {
    const p = planEntry(slug);
    if (!p) return;
    p.servings = Math.max(1, Math.round(n));
    save(PLAN_KEY, state.plan);
    renderPlan();
  }

  /* ── Grocery engine ──────────────────────────────────── */

  /* Merge every ingredient across the plan into things you can buy.
     Amounts scale with each recipe's chosen servings. */
  function compileGroceries() {
    const map = new Map();

    state.plan.forEach((entry) => {
      const r = recipeBySlug(entry.slug);
      if (!r) return;
      const factor = entry.servings / r.servings.n;

      r.components.forEach((c) => {
        c.ingredients.forEach((ing) => {
          const buy = ing.buy || { q: ing.q, u: ing.u };
          const name = ing.buyAs || ing.n;
          const unit = buy.u === undefined ? ing.u : buy.u;
          const key = `${name.toLowerCase()}|${unit || ''}`;

          if (!map.has(key)) {
            map.set(key, {
              key,
              name,
              unit,
              aisle: ing.aisle,
              qty: null,
              hasQty: false,
              notes: new Set(),
              from: new Set(),
            });
          }
          const it = map.get(key);
          if (buy.q !== null && buy.q !== undefined) {
            it.qty = (it.qty || 0) + buy.q * factor;
            it.hasQty = true;
          }
          if (ing.buyNote) it.notes.add(ing.buyNote);
          it.from.add(r.title);
        });
      });
    });

    const items = [];
    map.forEach((it) => {
      const edit = state.edits[it.key];
      if (edit && edit.removed) return;

      if (edit && typeof edit.amount === 'number' && it.hasQty) {
        it.qty = edit.amount;
        it.rounded = false;
      } else if (it.hasQty) {
        const r = roundForBuying(it.qty, it.unit);
        it.rounded = r.rounded;
        it.roundedFrom = r.from;
        it.qty = r.q;
      }
      items.push(it);
    });

    const byAisle = new Map();
    items.forEach((it) => {
      if (!byAisle.has(it.aisle)) byAisle.set(it.aisle, []);
      byAisle.get(it.aisle).push(it);
    });

    return AISLES
      .filter((a) => byAisle.has(a))
      .map((a) => ({ aisle: a, items: byAisle.get(a).sort((x, y) => x.name.localeCompare(y.name)) }));
  }

  /* ── Rendering: list ─────────────────────────────────── */

  function rowHtml(entry, why, i) {
    const r = entry.recipe;
    const on = planHas(r.slug);
    const steps = r.components.length;
    const keywords = why
      ? `<span class="row-why">${esc(why)}</span> · ${esc(entry.ingredientLabel.slice(0, 5).join(' · '))}`
      : esc(entry.ingredientLabel.slice(0, 6).join(' · '));

    return `
      <a class="recipe-row${on ? ' is-planned' : ''}" href="recipe.html?r=${encodeURIComponent(r.slug)}"
         data-row="${r.slug}" style="--dish:${r.dish}${state.animate ? `;animation-delay:${Math.min(i * 24, 300)}ms` : ''}">
        <span class="row-main">
          <span class="row-title">${esc(r.title)}</span>
          <span class="row-keywords">${keywords}</span>
          <span class="row-meta">${r.servings.n} ${esc(r.servings.unit)} · ${esc(r.time)} · ${steps} ${steps === 1 ? 'step' : 'steps'}</span>
        </span>
        <span class="row-side">
          <button class="plan-btn${on ? ' is-on' : ''}" data-plan="${r.slug}" aria-pressed="${on}">
            ${on ? checkSvg() : plusSvg()}<span>${on ? 'In plan' : 'Add to plan'}</span>
          </button>
        </span>
      </a>`;
  }

  function renderList() {
    const res = results();
    if (!res.length) {
      el.list.innerHTML = '<div class="empty"><strong>Nothing matches that.</strong>Try an ingredient — tahini, chard, lime.</div>';
      return;
    }
    el.list.classList.toggle('no-anim', !state.animate);
    el.list.innerHTML = res.map(({ entry, why }, i) => rowHtml(entry, why, i)).join('');
  }

  /* Update one row in place. Re-rendering the whole list made every
     card replay its entry animation, which read as a flash. */
  function patchRow(slug) {
    const row = el.list.querySelector(`[data-row="${slug}"]`);
    if (!row) return;
    const on = planHas(slug);
    row.classList.toggle('is-planned', on);
    const btn = row.querySelector('.plan-btn');
    if (btn) {
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', String(on));
      btn.innerHTML = `${on ? checkSvg() : plusSvg()}<span>${on ? 'In plan' : 'Add to plan'}</span>`;
    }
  }

  const plusSvg = () => '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M8 3.5v9M3.5 8h9"/></svg>';
  const checkSvg = () => '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m3.5 8.5 3 3 6-7"/></svg>';
  const xSvg = () => '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
  const arrowSvg = () => '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h7v7M13 3 3 13"/></svg>';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  /* ── Rendering: tile ─────────────────────────────────── */

  function tileHtml(entry) {
    const r = entry.recipe;
    const on = planHas(r.slug);
    return `
      <div class="tile-item" style="--dish:${r.dish}" data-tile="${r.slug}">
        <button class="tile-toggle${on ? ' is-on' : ''}" data-plan="${r.slug}" aria-pressed="${on}">
          <span class="tile-check" aria-hidden="true">${checkSvg()}</span>
          <span class="tile-title">${esc(r.title)}</span>
          <span class="tile-time">${esc(r.time)}</span>
        </button>
        <a class="tile-open" href="recipe.html?r=${encodeURIComponent(r.slug)}" aria-label="Open ${esc(r.title)}">${arrowSvg()}</a>
      </div>`;
  }

  function renderTiles() {
    const res = results();
    if (!res.length) {
      el.tileGrid.innerHTML = '<div class="empty"><strong>Nothing matches that.</strong>Try an ingredient — tahini, chard, lime.</div>';
      return;
    }
    el.tileGrid.classList.toggle('no-anim', !state.animate);
    el.tileGrid.innerHTML = res.map(({ entry }) => tileHtml(entry)).join('');
  }

  function patchTile(slug) {
    const item = el.tileGrid.querySelector(`[data-tile="${slug}"]`);
    if (!item) return;
    const on = planHas(slug);
    const btn = item.querySelector('.tile-toggle');
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
  }

  /* ── Autofill (orbit) ────────────────────────────────── */

  function renderAutofill() {
    const q = state.query.trim().toLowerCase();
    if (state.subMode !== 'orbit' || !q) {
      el.autofill.classList.remove('is-on');
      el.autofill.innerHTML = '';
      state.afIndex = -1;
      return;
    }
    const res = results().slice(0, 6);
    if (!res.length) { el.autofill.classList.remove('is-on'); return; }

    el.autofill.innerHTML = res.map(({ entry, why }, i) => `
      <button class="autofill-item${i === state.afIndex ? ' is-active' : ''}" data-slug="${entry.slug}" role="option" style="--dish:${entry.recipe.dish}">
        <span class="af-title">${esc(entry.recipe.title)}</span>${why ? `<span class="af-why"> — ${esc(why)}</span>` : ''}
      </button>`).join('');
    el.autofill.classList.add('is-on');
  }

  /* ── Rendering: plan ─────────────────────────────────── */

  function renderPlan() {
    renderChosen();
    renderGroceries();
    renderSaved();
  }

  function renderChosen() {
    if (!state.plan.length) {
      el.chosenSub.textContent = 'Nothing picked yet';
      el.chosenList.innerHTML = '<p class="muted-note">Add recipes from the Recipes tab. Their ingredients land here, sorted by aisle.</p>';
      return;
    }
    el.chosenSub.textContent = `${state.plan.length} ${state.plan.length === 1 ? 'recipe' : 'recipes'}`;
    el.chosenList.innerHTML = state.plan.map((p) => {
      const r = recipeBySlug(p.slug);
      if (!r) return '';
      const changed = p.servings !== r.servings.n;
      return `
        <div class="chosen" style="--dish:${r.dish}">
          <div class="chosen-top">
            <span class="chosen-name">${esc(r.title)}</span>
            <button class="icon-btn" data-unplan="${p.slug}" aria-label="Remove ${esc(r.title)}">${xSvg()}</button>
          </div>
          <div class="chosen-servings">
            <button class="step-btn" data-sdec="${p.slug}" aria-label="Fewer">−</button>
            <span class="serv-n">${p.servings}</span>
            <span class="serv-u">${esc(r.servings.unit)}</span>
            <button class="step-btn" data-sinc="${p.slug}" aria-label="More">+</button>
          </div>
          <p class="serv-note" style="visibility:${changed ? 'visible' : 'hidden'}">recipe makes ${r.servings.n}</p>
        </div>`;
    }).join('');
  }

  function renderGroceries() {
    const groups = compileGroceries();
    const total = groups.reduce((n, g) => n + g.items.length, 0);
    const hasSpices = groups.some((g) => g.aisle === SPICE_AISLE);

    // A key that no longer exists on the list can't stay selected
    const validKeys = new Set();
    groups.forEach((g) => g.items.forEach((it) => validKeys.add(it.key)));
    Array.from(state.selected).forEach((k) => { if (!validKeys.has(k)) state.selected.delete(k); });

    el.copyBtn.disabled = total === 0;
    el.publishBtn.disabled = total === 0;
    el.spiceBtn.style.display = hasSpices ? '' : 'none';
    el.grocerySub.textContent = total
      ? `${total} ${total === 1 ? 'item' : 'items'} · ${groups.length} ${groups.length === 1 ? 'aisle' : 'aisles'}`
      : 'By aisle';

    updateToolbar();

    if (!total) {
      el.groceryList.innerHTML = '<p class="muted-note">Your list builds itself once you pick a recipe.</p>';
      return;
    }

    el.groceryList.innerHTML = groups.map((g) => `
      <div class="aisle">
        <div class="aisle-name">${esc(g.aisle)}<span>${g.items.length}</span></div>
        ${g.items.map((it) => {
          const note = Array.from(it.notes)[0] || '';
          const from = Array.from(it.from).join(', ');
          const checked = state.selected.has(it.key);
          return `
          <div class="g-item${checked ? ' is-selected' : ''}" data-key="${esc(it.key)}">
            <label class="g-check">
              <input type="checkbox" data-select="${esc(it.key)}" ${checked ? 'checked' : ''} aria-label="Select ${esc(it.name)}" />
              <span class="box">${checkSvg()}</span>
            </label>
            <span class="g-name">${esc(it.name)}</span>
            <span class="g-amount${it.hasQty ? '' : ' is-loose'}">
              ${it.hasQty ? `<button class="step-btn" data-dec="${esc(it.key)}" aria-label="Less ${esc(it.name)}">−</button>` : ''}
              <span class="amt">${esc(fmtAmount(it.qty, it.unit) || 'some')}</span>
              ${it.hasQty ? `<button class="step-btn" data-inc="${esc(it.key)}" aria-label="More ${esc(it.name)}">+</button>` : ''}
            </span>
            <span class="g-side">
              ${note ? `<span class="g-note">${esc(note)}</span>` : ''}
              ${it.rounded ? `<span class="g-round">rounded up from ${esc(fmtQty(it.roundedFrom))}</span>` : ''}
              <span class="g-from">${esc(from)}</span>
            </span>
          </div>`;
        }).join('')}
      </div>`).join('');
  }

  /* Update just one amount, so a +/- press doesn't repaint the list. */
  function patchAmount(key) {
    const groups = compileGroceries();
    let item = null;
    groups.forEach((g) => g.items.forEach((it) => { if (it.key === key) item = it; }));
    const row = el.groceryList.querySelector(`[data-key="${cssEscape(key)}"]`);
    if (!row) { renderGroceries(); return; }
    if (!item) { row.remove(); renderGroceries(); return; }

    row.querySelector('.amt').textContent = fmtAmount(item.qty, item.unit) || 'some';
    const roundEl = row.querySelector('.g-round');
    if (roundEl) roundEl.remove();
  }

  function cssEscape(s) { return s.replace(/["\\]/g, '\\$&'); }

  function updateToolbar() {
    const n = state.selected.size;
    el.trashBtn.disabled = n === 0;
    el.trashCount.textContent = n || '';
    el.trashCount.classList.toggle('is-on', n > 0);
    el.undoBtn.disabled = !lastBatch;
  }

  /* ── Batch undo for the grocery list only ─────────────── */
  /* Tracks just the most recent grocery action (a bulk delete, or one
     amount tweak) so Undo can put it back exactly — separate from
     anything else you do on the page. */
  let lastBatch = null;

  function recordBatch(keys) {
    const snapshot = {};
    keys.forEach((k) => { snapshot[k] = state.edits[k]; });
    lastBatch = { snapshot, keys: keys.slice() };
  }

  function undoLastBatch() {
    if (!lastBatch) return;
    const keys = lastBatch.keys;
    restoreEdits(lastBatch.snapshot);
    lastBatch = null;
    updateToolbar(); // restoreEdits already rendered once, while the batch still existed
    flashKeys(keys);
  }

  function restoreEdits(snapshot) {
    Object.keys(snapshot).forEach((k) => {
      if (snapshot[k] === undefined) delete state.edits[k];
      else state.edits[k] = snapshot[k];
    });
    save(EDITS_KEY, state.edits);
    renderGroceries();
  }

  function flashKeys(keys) {
    requestAnimationFrame(() => {
      keys.forEach((k) => {
        const row = el.groceryList.querySelector(`[data-key="${cssEscape(k)}"]`);
        if (!row) return;
        row.classList.add('is-restored');
        setTimeout(() => row.classList.remove('is-restored'), 1300);
      });
    });
  }

  /* ── Saved plans ─────────────────────────────────────── */

  /* No backend here — a plan travels as a compressed payload in the
     URL, so a list made on the iPad opens on the phone from a link. */
  function encodePlan(name) {
    const payload = { n: name, p: state.plan, e: state.edits };
    return btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decodePlan(str) {
    try {
      const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(decodeURIComponent(escape(atob(b64))));
    } catch (e) { return null; }
  }

  function planUrl(name) {
    return `${location.origin}${location.pathname}#list=${encodePlan(name)}`;
  }

  function publishPlan() {
    const name = (el.planName.value || '').trim() || defaultPlanName();
    const url = planUrl(name);
    const rec = { name, url, at: Date.now(), count: state.plan.length };

    const i = state.saved.findIndex((s) => s.name === name);
    if (i === -1) state.saved.unshift(rec);
    else state.saved[i] = rec;

    save(SAVED_KEY, state.saved);
    el.planName.value = '';
    renderSaved();
    copyText(url).then(() => toast(`"${name}" published — link copied`));
  }

  function defaultPlanName() {
    const d = new Date();
    return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} shop`;
  }

  function renderSaved() {
    if (!state.saved.length) {
      el.savedList.innerHTML = '<p class="muted-note">Publish a list to get a link you can open on any device.</p>';
      return;
    }
    el.savedList.innerHTML = state.saved.map((s, i) => `
      <div class="saved">
        <span class="saved-name">${esc(s.name)}</span>
        <span class="saved-meta">${s.count} ${s.count === 1 ? 'recipe' : 'recipes'}</span>
        <button class="mini-btn" data-open="${i}">Open</button>
        <button class="mini-btn" data-link="${i}">Copy link</button>
        <button class="icon-btn" data-forget="${i}" aria-label="Delete ${esc(s.name)}">${xSvg()}</button>
      </div>`).join('');
  }

  function loadPlanPayload(payload) {
    if (!payload || !Array.isArray(payload.p)) return false;
    state.plan = payload.p.filter((p) => recipeBySlug(p.slug));
    state.edits = payload.e || {};
    save(PLAN_KEY, state.plan);
    save(EDITS_KEY, state.edits);
    updatePlanCount();
    renderList();
    renderTiles();
    renderPlan();
    return true;
  }

  /* ── Copy ────────────────────────────────────────────── */

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }

  function groceryText() {
    const groups = compileGroceries();
    const lines = ['Moura Boys Forever Recipes — grocery list'];
    const names = state.plan.map((p) => {
      const r = recipeBySlug(p.slug);
      if (!r) return '';
      return p.servings === r.servings.n ? r.title : `${r.title} (${p.servings} ${r.servings.unit})`;
    }).filter(Boolean);
    if (names.length) lines.push(names.join(', '));
    lines.push('');

    groups.forEach((g) => {
      lines.push(g.aisle.toUpperCase());
      g.items.forEach((it) => {
        const amt = fmtAmount(it.qty, it.unit);
        const note = Array.from(it.notes)[0];
        lines.push(`- ${amt ? amt + ' ' : ''}${it.name}${note ? ` (${note})` : ''}`);
      });
      lines.push('');
    });
    return lines.join('\n').trim();
  }

  /* ── Toast ───────────────────────────────────────────── */

  let toastTimer;
  let undoAction = null;

  function toast(msg, onUndo) {
    el.toastMsg.textContent = msg;
    undoAction = onUndo || null;
    el.toastUndo.style.display = onUndo ? '' : 'none';
    el.toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.toast.classList.remove('is-on'); undoAction = null; }, onUndo ? 5000 : 2400);
  }

  el.toastUndo.addEventListener('click', () => {
    if (undoAction) undoAction();
    el.toast.classList.remove('is-on');
    clearTimeout(toastTimer);
    undoAction = null;
  });

  /* ── Masthead stats ──────────────────────────────────── */

  function computeStats() {
    const stats = [`${RECIPES.length} recipes`];

    const newest = RECIPES.reduce((a, b) => (a.order > b.order ? a : b), RECIPES[0]);
    if (newest) stats.push(`Newest: ${newest.title}`);

    const quickest = RECIPES.reduce((a, b) => (parseInt(a.time, 10) <= parseInt(b.time, 10) ? a : b), RECIPES[0]);
    if (quickest) stats.push(`Quickest: ${quickest.title} — ${quickest.time}`);

    const ingredientCount = new Map();
    const uniqueIngredients = new Set();
    RECIPES.forEach((r) => {
      const seenInThisRecipe = new Set();
      r.components.forEach((c) => c.ingredients.forEach((ing) => {
        const name = (ing.buyAs || ing.n).toLowerCase();
        uniqueIngredients.add(name);
        if (!seenInThisRecipe.has(name)) {
          seenInThisRecipe.add(name);
          ingredientCount.set(name, (ingredientCount.get(name) || 0) + 1);
        }
      }));
    });
    stats.push(`${uniqueIngredients.size} different ingredients across the collection`);

    let topName = null, topCount = 0;
    ingredientCount.forEach((count, name) => { if (count > topCount) { topCount = count; topName = name; } });
    if (topName && topCount > 1) stats.push(`${cap(topName)} shows up in ${topCount} of ${RECIPES.length} recipes`);

    return stats;
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function startStatRotator() {
    const stats = computeStats();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let i = 0;

    el.meta.innerHTML = `<span class="stat is-on">${esc(stats[0])}</span>`;
    if (stats.length < 2 || reduceMotion) return;

    setInterval(() => {
      const next = (i + 1) % stats.length;
      const cur = el.meta.querySelector('.stat.is-on');
      if (cur) cur.classList.remove('is-on');
      const fresh = document.createElement('span');
      fresh.className = 'stat';
      fresh.textContent = stats[next];
      el.meta.appendChild(fresh);
      requestAnimationFrame(() => fresh.classList.add('is-on'));
      setTimeout(() => { if (cur) cur.remove(); }, 600);
      i = next;
    }, 4200);
  }

  /* ── Views ───────────────────────────────────────────── */

  function setTopMode(mode) {
    state.topMode = mode;
    document.querySelectorAll('.top-btn').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.top === mode)));
    moveTopInk();
    el.controls.style.display = mode === 'recipes' ? '' : 'none';
    syncViews();
    if (mode === 'plan' && window.OrbitAPI) window.OrbitAPI.pause();
    else if (mode === 'recipes' && state.subMode === 'orbit') resumeOrbit();
    updateHash();
  }

  function setSubMode(mode) {
    state.subMode = mode;
    el.viewSelect.value = mode;
    syncViews();
    el.sortWrap.style.display = mode === 'orbit' ? 'none' : '';
    el.search.placeholder = mode === 'orbit' ? 'Search and spin to it' : 'Search recipes and ingredients';
    renderAutofill();
    if (mode === 'orbit') resumeOrbit();
    else if (window.OrbitAPI) window.OrbitAPI.pause();
    updateHash();
  }

  function syncViews() {
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('is-active'));
    if (state.topMode === 'plan') { $('view-plan').classList.add('is-active'); }
    else { $(`view-${state.subMode}`).classList.add('is-active'); }
  }

  function resumeOrbit() {
    if (window.OrbitAPI) { window.OrbitAPI.resume(); return; }
    setTimeout(() => {
      if (!(state.topMode === 'recipes' && state.subMode === 'orbit')) return;
      if (window.OrbitAPI) window.OrbitAPI.resume();
      else { $('orbitFallback').classList.add('is-on'); $('orbitStage').style.display = 'none'; }
    }, 1200);
  }

  function updateHash() {
    if (location.hash.startsWith('#list=')) return; // a shared-plan link owns the hash on load
    let h = '';
    if (state.topMode === 'plan') h = 'plan';
    else if (state.subMode !== 'list') h = state.subMode;
    history.replaceState(null, '', h ? `#${h}` : location.pathname);
  }

  function moveTopInk() {
    const active = document.querySelector('.top-btn[aria-selected="true"]');
    if (!active) return;
    el.topInk.style.width = `${active.offsetWidth}px`;
    el.topInk.style.transform = `translateX(${active.offsetLeft - 4}px)`;
  }

  function updatePlanCount() {
    el.planCount.textContent = state.plan.length ? ` ${state.plan.length}` : '';
    moveTopInk();
  }

  /* ── Init ────────────────────────────────────────────── */

  function init() {
    startStatRotator();

    // A shared plan link wins over whatever is stored locally
    const shared = location.hash.startsWith('#list=') ? decodePlan(location.hash.slice(6)) : null;

    updatePlanCount();
    renderList();
    renderTiles();
    renderPlan();
    state.animate = false; // entry animation is a first-paint thing only

    moveTopInk();
    requestAnimationFrame(moveTopInk);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveTopInk);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) moveTopInk(); });

    if (shared && loadPlanPayload(shared)) {
      setTopMode('plan');
      toast(shared.n ? `Opened "${shared.n}"` : 'Opened shared list');
    } else {
      const hash = location.hash.replace('#', '');
      if (hash === 'plan') setTopMode('plan');
      else if (hash === 'tile' || hash === 'orbit') setSubMode(hash);
    }

    // Search
    el.search.addEventListener('input', () => {
      state.query = el.search.value;
      state.afIndex = -1;
      el.searchClear.classList.toggle('is-on', !!state.query);
      renderList();
      renderTiles();
      renderAutofill();
    });

    el.search.addEventListener('keydown', (e) => {
      if (state.subMode !== 'orbit' || !el.autofill.classList.contains('is-on')) {
        if (e.key === 'Escape') { el.search.value = ''; el.search.dispatchEvent(new Event('input')); }
        return;
      }
      const items = el.autofill.querySelectorAll('.autofill-item');
      if (e.key === 'ArrowDown') { e.preventDefault(); state.afIndex = Math.min(state.afIndex + 1, items.length - 1); renderAutofill(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); state.afIndex = Math.max(state.afIndex - 1, 0); renderAutofill(); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const pick = items[state.afIndex >= 0 ? state.afIndex : 0];
        if (pick) selectFromAutofill(pick.dataset.slug);
      } else if (e.key === 'Escape') el.autofill.classList.remove('is-on');
    });

    el.searchClear.addEventListener('click', () => {
      el.search.value = '';
      state.query = '';
      el.searchClear.classList.remove('is-on');
      renderList();
      renderTiles();
      renderAutofill();
      el.search.focus();
    });

    el.autofill.addEventListener('click', (e) => {
      const item = e.target.closest('.autofill-item');
      if (item) selectFromAutofill(item.dataset.slug);
    });

    function selectFromAutofill(slug) {
      el.autofill.classList.remove('is-on');
      el.search.blur();
      if (window.OrbitAPI) window.OrbitAPI.focusSlug(slug);
    }

    el.sort.addEventListener('change', () => {
      state.sort = el.sort.value;
      renderList();
      renderTiles();
    });

    el.viewSelect.addEventListener('change', () => setSubMode(el.viewSelect.value));

    document.querySelectorAll('.top-btn').forEach((b) => {
      b.addEventListener('click', () => setTopMode(b.dataset.top));
    });

    // The whole row/tile is the link; the plan button opts out.
    el.list.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-plan]');
      if (btn) { e.preventDefault(); togglePlan(btn.dataset.plan); }
    });
    el.tileGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-plan]');
      if (btn) { e.preventDefault(); togglePlan(btn.dataset.plan); }
    });

    // Chosen recipes: remove, and servings steppers
    el.chosenList.addEventListener('click', (e) => {
      const un = e.target.closest('[data-unplan]');
      const dec = e.target.closest('[data-sdec]');
      const inc = e.target.closest('[data-sinc]');
      if (un) return togglePlan(un.dataset.unplan);
      if (dec) { const p = planEntry(dec.dataset.sdec); if (p) setServings(p.slug, p.servings - 1); }
      if (inc) { const p = planEntry(inc.dataset.sinc); if (p) setServings(p.slug, p.servings + 1); }
    });

    // Grocery list: checkbox selection + amount steppers
    el.groceryList.addEventListener('change', (e) => {
      const box = e.target.closest('[data-select]');
      if (!box) return;
      const key = box.dataset.select;
      if (box.checked) state.selected.add(key); else state.selected.delete(key);
      box.closest('.g-item').classList.toggle('is-selected', box.checked);
      updateToolbar();
    });

    el.groceryList.addEventListener('click', (e) => {
      const dec = e.target.closest('[data-dec]');
      const inc = e.target.closest('[data-inc]');
      if (!dec && !inc) return;

      const key = (dec || inc).dataset[dec ? 'dec' : 'inc'];
      const groups = compileGroceries();
      let cur = null;
      groups.forEach((g) => g.items.forEach((it) => { if (it.key === key) cur = it; }));
      if (!cur || !cur.hasQty) return;

      recordBatch([key]);

      const step = stepFor(cur.unit);
      let next = dec ? cur.qty - step : cur.qty + step;
      next = Math.max(0, Math.round(next * 100) / 100);

      if (next === 0) {
        state.edits[key] = Object.assign({}, state.edits[key], { removed: true });
        save(EDITS_KEY, state.edits);
        const row = el.groceryList.querySelector(`[data-key="${cssEscape(key)}"]`);
        if (row) row.remove();
        renderGroceries();
      } else {
        state.edits[key] = Object.assign({}, state.edits[key], { amount: next, removed: false });
        save(EDITS_KEY, state.edits);
        patchAmount(key);
      }
      updateToolbar();
    });

    // Trash: delete everything checked, as one undo-able batch
    el.trashBtn.addEventListener('click', () => {
      const keys = Array.from(state.selected);
      if (!keys.length) return;
      recordBatch(keys);
      keys.forEach((k) => { state.edits[k] = Object.assign({}, state.edits[k], { removed: true }); });
      state.selected.clear();
      save(EDITS_KEY, state.edits);
      renderGroceries();
      toast(`Removed ${keys.length} ${keys.length === 1 ? 'item' : 'items'}`, undoLastBatch);
    });

    el.undoBtn.addEventListener('click', undoLastBatch);

    // Select spices — just checks their boxes, Trash does the deleting
    el.spiceBtn.addEventListener('click', () => {
      const groups = compileGroceries();
      const spices = groups.find((g) => g.aisle === SPICE_AISLE);
      if (!spices) return;
      spices.items.forEach((it) => state.selected.add(it.key));
      renderGroceries();
      toast(`Selected ${spices.items.length} spices — tap Trash to remove`);
    });

    el.copyBtn.addEventListener('click', async () => {
      await copyText(groceryText());
      el.copyBtn.classList.add('is-copied');
      el.copyLabel.textContent = 'Copied';
      toast('Grocery list copied');
      setTimeout(() => { el.copyBtn.classList.remove('is-copied'); el.copyLabel.textContent = 'Copy list'; }, 2000);
    });

    el.publishBtn.addEventListener('click', publishPlan);
    el.planName.addEventListener('keydown', (e) => { if (e.key === 'Enter') publishPlan(); });

    el.savedList.addEventListener('click', (e) => {
      const open = e.target.closest('[data-open]');
      const link = e.target.closest('[data-link]');
      const forget = e.target.closest('[data-forget]');

      if (open) {
        const s = state.saved[+open.dataset.open];
        const payload = decodePlan(s.url.split('#list=')[1] || '');
        if (loadPlanPayload(payload)) toast(`Opened "${s.name}"`);
        return;
      }
      if (link) {
        const s = state.saved[+link.dataset.link];
        copyText(s.url).then(() => toast('Link copied'));
        return;
      }
      if (forget) {
        const i = +forget.dataset.forget;
        const name = state.saved[i].name;
        state.saved.splice(i, 1);
        save(SAVED_KEY, state.saved);
        renderSaved();
        toast(`Deleted "${name}"`);
      }
    });

    const sentinel = document.querySelector('.masthead');
    if ('IntersectionObserver' in window && sentinel) {
      new IntersectionObserver(
        ([entry]) => el.controls.classList.toggle('is-stuck', !entry.isIntersecting),
        { threshold: 0, rootMargin: '-8px 0px 0px 0px' }
      ).observe(sentinel);
    }

    window.addEventListener('resize', moveTopInk);

    // Orbit hands recipes back to the plan
    window.addEventListener('orbit:plan', (e) => {
      togglePlan(e.detail.slug);
      const on = planHas(e.detail.slug);
      toast(on ? 'Added to plan' : 'Removed from plan');
      if (window.OrbitAPI) window.OrbitAPI.refreshCard();
    });
    window.OrbitPlanHas = planHas;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
