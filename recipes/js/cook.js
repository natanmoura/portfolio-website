/* ═══════════════════════════════════════════════════════════════
   A single recipe. Ingredients on the left, method on the right,
   both grouped by the thing being made and both collapsible.
   The servings stepper rescales every amount live.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const RECIPES = window.RECIPES || [];
  const PLAN_KEY = 'mbfr.plan.v2';

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

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function load(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
  }

  const params = new URLSearchParams(location.search);
  const recipe = RECIPES.find((r) => r.slug === params.get('r'));

  const elTitle = document.getElementById('title');
  const elMeta = document.getElementById('meta');
  const elIng = document.getElementById('ingredients');
  const elSteps = document.getElementById('steps');
  const elServe = document.getElementById('servings');
  const elPlanBtn = document.getElementById('planBtn');

  if (!recipe) {
    elTitle.textContent = 'Recipe not found';
    document.getElementById('cookGrid').innerHTML =
      '<p class="muted-note">That link points at a recipe that isn\'t here. <a href="index.html" class="inline-link">Back to all recipes</a>.</p>';
    if (elServe) elServe.style.display = 'none';
    return;
  }

  document.title = `${recipe.title} — Moura Boys Forever Recipes`;
  elTitle.textContent = recipe.title;
  document.documentElement.style.setProperty('--dish', recipe.dish);
  elTitle.style.setProperty('--dish', recipe.dish);
  elMeta.textContent = recipe.time;

  let plan = load(PLAN_KEY, []);
  const existing = plan.find((p) => p.slug === recipe.slug);
  let servings = existing ? existing.servings : recipe.servings.n;

  /* ── Servings ────────────────────────────────────────── */

  function renderServings() {
    const changed = servings !== recipe.servings.n;
    elServe.innerHTML = `
      <button class="step-btn" id="sDec" aria-label="Fewer ${esc(recipe.servings.unit)}">−</button>
      <span class="serv-n">${servings}</span>
      <span class="serv-u">${esc(recipe.servings.unit)}</span>
      <button class="step-btn" id="sInc" aria-label="More ${esc(recipe.servings.unit)}">+</button>
      ${changed ? `<span class="serv-note">recipe makes ${recipe.servings.n}</span>` : ''}`;

    document.getElementById('sDec').onclick = () => { servings = Math.max(1, servings - 1); afterServings(); };
    document.getElementById('sInc').onclick = () => { servings += 1; afterServings(); };
  }

  function afterServings() {
    renderServings();
    renderIngredients();
    // keep the plan in step if this recipe is already in it
    const p = plan.find((x) => x.slug === recipe.slug);
    if (p) { p.servings = servings; save(PLAN_KEY, plan); }
  }

  const factor = () => servings / recipe.servings.n;

  /* ── Ingredients ─────────────────────────────────────── */

  function renderIngredients() {
    const f = factor();
    elIng.innerHTML = recipe.components
      .filter((c) => c.ingredients.length)
      .map((c, i) => `
        <section class="group" data-group="ing-${i}">
          <button class="group-head" aria-expanded="true" data-toggle="ing-${i}">
            <span class="group-name">${esc(c.name)}</span>
          </button>
          <div class="group-body"><div class="group-body-inner">
            <ul class="ing-list">
              ${c.ingredients.map((ing) => {
                const q = (ing.q === null || ing.q === undefined) ? null : ing.q * f;
                return `<li>
                  <span class="ing-qty">${esc(fmtAmount(q, ing.u))}</span>
                  <span class="ing-name">${esc(ing.n)}${ing.note ? `<span class="ing-note"> — ${esc(ing.note)}</span>` : ''}</span>
                </li>`;
              }).join('')}
            </ul>
          </div></div>
        </section>`).join('');
  }

  /* ── Instructions ────────────────────────────────────── */

  function renderSteps() {
    elSteps.innerHTML = recipe.components.map((c, i) => `
      <section class="group" data-group="st-${i}">
        <button class="group-head" aria-expanded="true" data-toggle="st-${i}">
          <span class="group-name">${esc(c.name)}</span>
        </button>
        <div class="group-body"><div class="group-body-inner">
          <ul class="step-list">
            ${c.steps.map((s) => `<li>${esc(s)}</li>`).join('')}
          </ul>
          ${c.tip ? `<p class="tip">${esc(c.tip)}</p>` : ''}
        </div></div>
      </section>`).join('');
  }

  /* One handler for every collapse toggle on the page */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-toggle]');
    if (!btn) return;
    const section = btn.closest('.group');
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    section.classList.toggle('is-closed', open);
  });

  /* ── Plan button ─────────────────────────────────────── */

  function renderPlanBtn() {
    const on = plan.some((p) => p.slug === recipe.slug);
    elPlanBtn.classList.toggle('is-on', on);
    elPlanBtn.innerHTML = on
      ? '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m3.5 8.5 3 3 6-7"/></svg><span>In plan</span>'
      : '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M8 3.5v9M3.5 8h9"/></svg><span>Add to plan</span>';
  }

  elPlanBtn.addEventListener('click', () => {
    const i = plan.findIndex((p) => p.slug === recipe.slug);
    if (i === -1) plan.push({ slug: recipe.slug, servings });
    else plan.splice(i, 1);
    save(PLAN_KEY, plan);
    renderPlanBtn();
  });

  renderServings();
  renderIngredients();
  renderSteps();
  renderPlanBtn();
})();
