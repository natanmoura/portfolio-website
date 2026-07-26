/* ═══════════════════════════════════════════════════════════════
   Cook mode — one step box per thing being made, so two people can
   work the same screen at their own pace. Ingredients stay put on
   the left; each box walks its own steps.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const RECIPES = window.RECIPES || [];

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

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  const params = new URLSearchParams(location.search);
  const slug = params.get('r');
  const recipe = RECIPES.find((r) => r.slug === slug);

  const elTitle = document.getElementById('title');
  const elMeta = document.getElementById('meta');
  const elIng = document.getElementById('ingredients');
  const elSteps = document.getElementById('steps');

  if (!recipe) {
    elTitle.textContent = 'Recipe not found';
    elMeta.textContent = '';
    document.getElementById('cookGrid').innerHTML =
      '<p style="color:var(--muted)">That link points at a recipe that isn\'t here. <a href="index.html" style="color:var(--herb);font-weight:700">Back to all recipes</a>.</p>';
    return;
  }

  document.title = `${recipe.title} — The Moura Boy Forever Recipes`;
  document.documentElement.style.setProperty('--dish', recipe.dish);

  elTitle.textContent = recipe.title;
  elTitle.style.setProperty('--dish', recipe.dish);
  elMeta.textContent = recipe.meta;

  /* ── Ingredients, grouped by what they're for ──────────── */

  elIng.style.setProperty('--dish', recipe.dish);
  elIng.innerHTML = recipe.components
    .filter((c) => c.ingredients.length)
    .map((c) => `
      <div class="ing-group">
        <div class="ing-group-name">${esc(c.name)}</div>
        <ul class="ing-list">
          ${c.ingredients.map((i) => `
            <li>
              <span class="ing-qty">${esc(fmtAmount(i.q, i.u))}</span>
              <span class="ing-name">${esc(i.n)}${i.note ? `<span class="ing-note"> — ${esc(i.note)}</span>` : ''}</span>
            </li>`).join('')}
        </ul>
      </div>`).join('');

  /* ── One step box per component ────────────────────────── */

  const arrowLeft = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13 5 8l5-5"/></svg>';
  const arrowRight = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 3 5 5-5 5"/></svg>';

  const boxes = recipe.components.map((c, ci) => {
    // A tip rides along as one extra card at the end
    const cards = c.steps.map((s) => ({ text: s, tip: false }));
    if (c.tip) cards.push({ text: c.tip, tip: true });
    return { component: c, cards, i: 0, ci };
  });

  elSteps.innerHTML = boxes.map((b) => `
    <section class="step-box" data-box="${b.ci}" style="--dish:${recipe.dish}">
      <div class="step-box-head">
        <h2 class="step-box-name">${esc(b.component.name)}</h2>
        <span class="step-count" data-count="${b.ci}"></span>
      </div>
      <div class="step-body"><p class="step-text" data-text="${b.ci}"></p></div>
      <div class="step-foot">
        <button class="arrow" data-prev="${b.ci}" aria-label="Previous step in ${esc(b.component.name)}">${arrowLeft}</button>
        <div class="step-dots" data-dots="${b.ci}"></div>
        <button class="arrow" data-next="${b.ci}" aria-label="Next step in ${esc(b.component.name)}">${arrowRight}</button>
      </div>
    </section>`).join('');

  function paint(ci) {
    const b = boxes[ci];
    const card = b.cards[b.i];
    const box = elSteps.querySelector(`[data-box="${ci}"]`);
    const textEl = elSteps.querySelector(`[data-text="${ci}"]`);
    const countEl = elSteps.querySelector(`[data-count="${ci}"]`);
    const dotsEl = elSteps.querySelector(`[data-dots="${ci}"]`);
    const prev = elSteps.querySelector(`[data-prev="${ci}"]`);
    const next = elSteps.querySelector(`[data-next="${ci}"]`);

    // Re-trigger the fade by replacing the node
    const fresh = textEl.cloneNode(false);
    fresh.textContent = card.text;
    fresh.className = 'step-text' + (card.tip ? ' is-tip' : '');
    textEl.replaceWith(fresh);

    const stepCount = b.component.steps.length;
    countEl.textContent = card.tip ? 'Tip' : `${b.i + 1} / ${stepCount}`;

    dotsEl.innerHTML = b.cards.map((_, i) =>
      `<span class="dot${i < b.i ? ' is-done' : ''}${i === b.i ? ' is-now' : ''}"></span>`
    ).join('');

    prev.disabled = b.i === 0;
    next.disabled = b.i === b.cards.length - 1;
    box.classList.toggle('is-done', b.i === b.cards.length - 1);
  }

  elSteps.addEventListener('click', (e) => {
    const nextBtn = e.target.closest('[data-next]');
    const prevBtn = e.target.closest('[data-prev]');
    if (nextBtn) {
      const b = boxes[+nextBtn.dataset.next];
      if (b.i < b.cards.length - 1) { b.i++; paint(b.ci); }
    } else if (prevBtn) {
      const b = boxes[+prevBtn.dataset.prev];
      if (b.i > 0) { b.i--; paint(b.ci); }
    }
  });

  boxes.forEach((b) => paint(b.ci));
})();
