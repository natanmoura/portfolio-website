/* ═══════════════════════════════════════════════════════════════
   List · search · sort · meal plan · grocery list
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const RECIPES = window.RECIPES || [];
  const AISLES = window.AISLES || [];
  const PLAN_KEY = 'mbfr.plan.v1';
  const EDITS_KEY = 'mbfr.edits.v1';

  const $ = (id) => document.getElementById(id);

  const el = {
    meta: $('mastheadMeta'),
    search: $('search'),
    searchClear: $('searchClear'),
    autofill: $('autofill'),
    sort: $('sort'),
    list: $('recipeList'),
    controls: $('controls'),
    modeInk: $('modeInk'),
    planCount: $('planCount'),
    chosenList: $('chosenList'),
    chosenSub: $('chosenSub'),
    groceryList: $('groceryList'),
    grocerySub: $('grocerySub'),
    copyBtn: $('copyBtn'),
    copyLabel: $('copyLabel'),
    toast: $('toast'),
  };

  /* ── State ───────────────────────────────────────────── */

  const state = {
    view: 'list',
    query: '',
    sort: 'az',
    plan: load(PLAN_KEY, []),
    // { "name|unit": { amount: n, removed: bool } }
    edits: load(EDITS_KEY, {}),
    afIndex: -1,
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
    const stepWords = [];
    r.components.forEach((c) => {
      c.ingredients.forEach((i) => ingredients.push(i.n));
      c.steps.forEach((s) => stepWords.push(s));
      stepWords.push(c.name);
    });
    return {
      slug: r.slug,
      recipe: r,
      title: r.title.toLowerCase(),
      ingredients: ingredients.map((s) => s.toLowerCase()),
      ingredientLabel: dedupe(ingredients),
      body: stepWords.join(' ').toLowerCase(),
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

  /* Name first, then ingredients, then anything in the method. */
  function score(entry, q) {
    if (!q) return 1;
    const t = entry.title;
    if (t === q) return 1000;
    if (t.startsWith(q)) return 900;
    if (t.includes(q)) return 800;

    const words = t.split(/\s+/);
    if (words.some((w) => w.startsWith(q))) return 700;

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
    if (!q) return null;
    if (entry.title.includes(q)) return null;
    const ing = entry.ingredientLabel.find((i) => i.toLowerCase().includes(q));
    if (ing) return ing;
    if (entry.body.includes(q)) return 'in the method';
    return null;
  }

  function results() {
    const q = state.query.trim().toLowerCase();
    let out = index
      .map((e) => ({ entry: e, s: score(e, q), why: matched(e, q) }))
      .filter((x) => x.s > 0);

    if (q) {
      out.sort((a, b) => b.s - a.s || a.entry.title.localeCompare(b.entry.title));
    } else {
      out.sort((a, b) => sortCompare(a.entry.recipe, b.entry.recipe));
    }
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

  /* ── Quantities ──────────────────────────────────────── */

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
    if (whole === 0 && fracStr) return fracStr;
    if (whole === 0 && !fracStr) return '0';
    return whole + fracStr;
  }

  function fmtAmount(q, u) {
    const n = fmtQty(q);
    if (!n && !u) return '';
    if (!u) return n;
    return n ? `${n} ${u}` : u;
  }

  /* ── Rendering: list ─────────────────────────────────── */

  function planHas(slug) { return state.plan.indexOf(slug) !== -1; }

  function renderList() {
    const res = results();
    if (!res.length) {
      el.list.innerHTML =
        '<div class="empty"><strong>Nothing matches that.</strong>Try an ingredient — tahini, chard, lime.</div>';
      return;
    }

    el.list.innerHTML = res.map(({ entry, why }, i) => {
      const r = entry.recipe;
      const on = planHas(r.slug);
      const parts = r.components.length;
      const keywords = why
        ? `<span style="color:var(--dish)">${escapeHtml(why)}</span> · ${escapeHtml(entry.ingredientLabel.slice(0, 5).join(' · '))}`
        : escapeHtml(entry.ingredientLabel.slice(0, 6).join(' · '));

      return `
        <article class="recipe-row${on ? ' is-planned' : ''}" style="--dish:${r.dish};animation-delay:${Math.min(i * 26, 320)}ms">
          <div class="row-main">
            <a class="row-title" href="recipe.html?r=${encodeURIComponent(r.slug)}">${escapeHtml(r.title)}</a>
            <p class="row-keywords">${keywords}</p>
            <p class="row-meta">${escapeHtml(r.meta)} · ${parts} ${parts === 1 ? 'part' : 'parts'}</p>
          </div>
          <div class="row-side">
            <button class="plan-btn${on ? ' is-on' : ''}" data-plan="${r.slug}" aria-pressed="${on}">
              ${on ? checkSvg() : plusSvg()}
              ${on ? 'In plan' : 'Add to plan'}
            </button>
          </div>
        </article>`;
    }).join('');
  }

  function plusSvg() {
    return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M8 3.5v9M3.5 8h9"/></svg>';
  }
  function checkSvg() {
    return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m3.5 8.5 3 3 6-7"/></svg>';
  }
  function xSvg() {
    return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  /* ── Rendering: autofill (orbit search) ──────────────── */

  function renderAutofill() {
    const q = state.query.trim().toLowerCase();
    if (state.view !== 'orbit' || !q) {
      el.autofill.classList.remove('is-on');
      el.autofill.innerHTML = '';
      state.afIndex = -1;
      return;
    }
    const res = results().slice(0, 6);
    if (!res.length) {
      el.autofill.classList.remove('is-on');
      return;
    }
    el.autofill.innerHTML = res.map(({ entry, why }, i) => `
      <button class="autofill-item${i === state.afIndex ? ' is-active' : ''}" data-slug="${entry.slug}" role="option" style="--dish:${entry.recipe.dish}">
        <span class="af-title">${escapeHtml(entry.recipe.title)}</span>
        ${why ? `<span class="af-why"> — ${escapeHtml(why)}</span>` : ''}
      </button>`).join('');
    el.autofill.classList.add('is-on');
  }

  /* ── Meal plan ───────────────────────────────────────── */

  function togglePlan(slug) {
    const i = state.plan.indexOf(slug);
    if (i === -1) state.plan.push(slug);
    else state.plan.splice(i, 1);
    save(PLAN_KEY, state.plan);
    renderList();
    renderPlan();
    updatePlanCount();
  }

  function updatePlanCount() {
    el.planCount.textContent = state.plan.length ? ` ${state.plan.length}` : '';
    moveInk(); // the count changes the button's width
  }

  function plannedRecipes() {
    return state.plan
      .map((slug) => RECIPES.find((r) => r.slug === slug))
      .filter(Boolean);
  }

  /* Merge every ingredient across the chosen recipes.
     Same name + same unit adds up; anything else stands on its own. */
  function compileGroceries() {
    const map = new Map();

    plannedRecipes().forEach((r) => {
      r.components.forEach((c) => {
        c.ingredients.forEach((ing) => {
          const key = `${ing.n.toLowerCase()}|${ing.u || ''}`;
          if (!map.has(key)) {
            // qty starts empty — the accumulator below adds every
            // occurrence, including this first one.
            map.set(key, {
              key,
              name: ing.n,
              unit: ing.u,
              aisle: ing.aisle,
              qty: null,
              hasQty: false,
              notes: new Set(),
              from: new Set(),
            });
          }
          const it = map.get(key);
          if (ing.q !== null && ing.q !== undefined) {
            it.qty = (it.qty === null || it.qty === undefined) ? ing.q : it.qty + ing.q;
            it.hasQty = true;
          }
          if (ing.note) it.notes.add(ing.note);
          it.from.add(r.title);
        });
      });
    });

    // Apply the edits made in the list itself
    const items = [];
    map.forEach((it) => {
      const edit = state.edits[it.key];
      if (edit && edit.removed) return;
      if (edit && typeof edit.amount === 'number' && it.hasQty) it.qty = edit.amount;
      items.push(it);
    });

    // Group by aisle, in shop-walk order
    const byAisle = new Map();
    items.forEach((it) => {
      if (!byAisle.has(it.aisle)) byAisle.set(it.aisle, []);
      byAisle.get(it.aisle).push(it);
    });

    return AISLES
      .filter((a) => byAisle.has(a))
      .map((a) => ({
        aisle: a,
        items: byAisle.get(a).sort((x, y) => x.name.localeCompare(y.name)),
      }));
  }

  function stepFor(q) {
    if (q >= 8) return 1;
    if (q >= 2) return 0.5;
    if (q >= 0.5) return 0.25;
    return 0.125;
  }

  function renderPlan() {
    const chosen = plannedRecipes();

    // Chosen recipes
    if (!chosen.length) {
      el.chosenSub.textContent = 'Nothing picked yet';
      el.chosenList.innerHTML =
        '<p style="font-size:.9rem;color:var(--muted)">Add recipes from the List tab and their ingredients land here, sorted by aisle.</p>';
    } else {
      el.chosenSub.textContent = `${chosen.length} ${chosen.length === 1 ? 'recipe' : 'recipes'}`;
      el.chosenList.innerHTML = chosen.map((r) => `
        <div class="chosen" style="--dish:${r.dish}">
          <span class="chosen-name">${escapeHtml(r.title)}</span>
          <button class="icon-btn" data-unplan="${r.slug}" aria-label="Remove ${escapeHtml(r.title)} from the plan">${xSvg()}</button>
        </div>`).join('');
    }

    // Grocery list
    const groups = compileGroceries();
    const total = groups.reduce((n, g) => n + g.items.length, 0);
    el.copyBtn.disabled = total === 0;
    el.grocerySub.textContent = total
      ? `${total} ${total === 1 ? 'item' : 'items'} · ${groups.length} ${groups.length === 1 ? 'aisle' : 'aisles'}`
      : 'By aisle';

    if (!total) {
      el.groceryList.innerHTML =
        '<p style="font-size:.9rem;color:var(--muted)">Your list builds itself once you pick a recipe.</p>';
      return;
    }

    el.groceryList.innerHTML = groups.map((g, gi) => `
      <div class="aisle" style="animation-delay:${Math.min(gi * 40, 260)}ms">
        <div class="aisle-name">${escapeHtml(g.aisle)}<span>${g.items.length}</span></div>
        ${g.items.map((it) => {
          const notes = Array.from(it.notes).slice(0, 2).join(', ');
          const from = Array.from(it.from).join(', ');
          const canStep = it.hasQty;
          const q = it.qty;
          return `
          <div class="g-item" data-key="${escapeHtml(it.key)}">
            <div class="g-name">
              ${escapeHtml(it.name)}
              ${notes ? `<span class="g-note">${escapeHtml(notes)}</span>` : ''}
            </div>
            <div class="g-amount${canStep ? '' : ' is-loose'}">
              ${canStep ? `<button class="step-btn" data-dec="${escapeHtml(it.key)}" aria-label="Less ${escapeHtml(it.name)}">−</button>` : ''}
              <span class="amt">${escapeHtml(fmtAmount(q, it.unit) || 'some')}</span>
              ${canStep ? `<button class="step-btn" data-inc="${escapeHtml(it.key)}" aria-label="More ${escapeHtml(it.name)}">+</button>` : ''}
            </div>
            <button class="icon-btn" data-drop="${escapeHtml(it.key)}" aria-label="Remove ${escapeHtml(it.name)} — already have it">${xSvg()}</button>
            <span class="g-from">${escapeHtml(from)}</span>
          </div>`;
        }).join('')}
      </div>`).join('');
  }

  function groceryText() {
    const groups = compileGroceries();
    const chosen = plannedRecipes().map((r) => r.title).join(', ');
    const lines = ['The Moura Boy Forever Recipes — grocery list'];
    if (chosen) lines.push(chosen);
    lines.push('');
    groups.forEach((g) => {
      lines.push(g.aisle.toUpperCase());
      g.items.forEach((it) => {
        const amt = fmtAmount(it.qty, it.unit);
        lines.push(`- ${amt ? amt + ' ' : ''}${it.name}`);
      });
      lines.push('');
    });
    return lines.join('\n').trim();
  }

  /* ── Toast ───────────────────────────────────────────── */

  let toastTimer;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('is-on'), 2200);
  }

  /* ── View switching ──────────────────────────────────── */

  function setView(view) {
    state.view = view;
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('is-active'));
    $(`view-${view}`).classList.add('is-active');

    document.querySelectorAll('.mode-btn').forEach((b) => {
      b.setAttribute('aria-selected', String(b.dataset.view === view));
    });
    moveInk();

    el.search.placeholder = view === 'orbit'
      ? 'Search and spin to it'
      : 'Search recipes and ingredients';

    // Sorting only means something in the flat list
    $('sortWrap').style.display = view === 'list' ? '' : 'none';

    renderAutofill();

    if (view === 'orbit') {
      if (window.OrbitAPI) window.OrbitAPI.resume();
      else {
        // The 3D engine loads as a module from a CDN. If it never arrived,
        // say so instead of showing an empty box.
        setTimeout(() => {
          if (state.view !== 'orbit') return;
          if (window.OrbitAPI) window.OrbitAPI.resume();
          else {
            $('orbitFallback').classList.add('is-on');
            $('orbitStage').style.display = 'none';
          }
        }, 1200);
      }
    } else if (window.OrbitAPI) {
      window.OrbitAPI.pause();
    }

    history.replaceState(null, '', view === 'list' ? location.pathname : `#${view}`);
  }

  function moveInk() {
    const active = document.querySelector('.mode-btn[aria-selected="true"]');
    if (!active) return;
    el.modeInk.style.width = `${active.offsetWidth}px`;
    el.modeInk.style.transform = `translateX(${active.offsetLeft - 3}px)`;
  }

  /* ── Wiring ──────────────────────────────────────────── */

  function init() {
    const newest = RECIPES.reduce((a, b) => (a.order > b.order ? a : b), RECIPES[0]);
    el.meta.textContent = `${RECIPES.length} recipes · newest: ${newest.title}`;

    updatePlanCount();
    renderList();
    renderPlan();

    // The pill has to land even if the page opened in a background tab
    // (no rAF there) or the display face arrives late and changes widths.
    moveInk();
    requestAnimationFrame(moveInk);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveInk);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) moveInk(); });

    // Search
    el.search.addEventListener('input', () => {
      state.query = el.search.value;
      state.afIndex = -1;
      el.searchClear.classList.toggle('is-on', !!state.query);
      renderList();
      renderAutofill();
    });

    el.search.addEventListener('keydown', (e) => {
      if (state.view !== 'orbit' || !el.autofill.classList.contains('is-on')) {
        if (e.key === 'Escape') { el.search.value = ''; el.search.dispatchEvent(new Event('input')); }
        return;
      }
      const items = el.autofill.querySelectorAll('.autofill-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        state.afIndex = Math.min(state.afIndex + 1, items.length - 1);
        renderAutofill();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        state.afIndex = Math.max(state.afIndex - 1, 0);
        renderAutofill();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const pick = items[state.afIndex >= 0 ? state.afIndex : 0];
        if (pick) selectFromAutofill(pick.dataset.slug);
      } else if (e.key === 'Escape') {
        el.autofill.classList.remove('is-on');
      }
    });

    el.searchClear.addEventListener('click', () => {
      el.search.value = '';
      state.query = '';
      el.searchClear.classList.remove('is-on');
      renderList();
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

    // Sort
    el.sort.addEventListener('change', () => {
      state.sort = el.sort.value;
      renderList();
    });

    // Modes
    document.querySelectorAll('.mode-btn').forEach((b) => {
      b.addEventListener('click', () => setView(b.dataset.view));
    });

    // Plan buttons in the list
    el.list.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-plan]');
      if (btn) togglePlan(btn.dataset.plan);
    });

    // Plan panel
    el.chosenList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-unplan]');
      if (btn) togglePlan(btn.dataset.unplan);
    });

    el.groceryList.addEventListener('click', (e) => {
      const drop = e.target.closest('[data-drop]');
      const dec = e.target.closest('[data-dec]');
      const inc = e.target.closest('[data-inc]');

      if (drop) {
        const key = drop.dataset.drop;
        state.edits[key] = Object.assign({}, state.edits[key], { removed: true });
        save(EDITS_KEY, state.edits);
        renderPlan();
        toast('Removed — already got it');
        return;
      }

      if (dec || inc) {
        const key = (dec || inc).dataset[dec ? 'dec' : 'inc'];
        const groups = compileGroceries();
        let current = null;
        groups.forEach((g) => g.items.forEach((it) => { if (it.key === key) current = it; }));
        if (!current || !current.hasQty) return;

        const step = stepFor(current.qty);
        let next = dec ? current.qty - step : current.qty + step;
        next = Math.max(0, Math.round(next * 1000) / 1000);

        if (next === 0) {
          state.edits[key] = Object.assign({}, state.edits[key], { removed: true });
        } else {
          state.edits[key] = Object.assign({}, state.edits[key], { amount: next, removed: false });
        }
        save(EDITS_KEY, state.edits);
        renderPlan();
      }
    });

    // Copy
    el.copyBtn.addEventListener('click', async () => {
      const text = groceryText();
      try {
        await navigator.clipboard.writeText(text);
      } catch (err) {
        // Older browsers, and any page not served over https
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      el.copyBtn.classList.add('is-copied');
      el.copyLabel.textContent = 'Copied';
      toast('Grocery list copied');
      setTimeout(() => {
        el.copyBtn.classList.remove('is-copied');
        el.copyLabel.textContent = 'Copy list';
      }, 2000);
    });

    // Sticky control shadow
    const sentinel = document.querySelector('.masthead');
    if ('IntersectionObserver' in window && sentinel) {
      new IntersectionObserver(
        ([entry]) => el.controls.classList.toggle('is-stuck', !entry.isIntersecting),
        { threshold: 0, rootMargin: '-8px 0px 0px 0px' }
      ).observe(sentinel);
    }

    window.addEventListener('resize', moveInk);

    // Deep link: #orbit / #plan
    const hash = location.hash.replace('#', '');
    if (hash === 'orbit' || hash === 'plan') setView(hash);

    // Let orbit.js hand focus back to the page
    window.addEventListener('orbit:pick', (e) => {
      el.search.value = '';
      state.query = '';
      el.searchClear.classList.remove('is-on');
      renderAutofill();
    });
  }

  // Shared helpers for the recipe page
  window.MBFR = { fmtAmount, fmtQty, escapeHtml };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
