// Hover help. Any element carrying data-help gets an overlay explaining what
// it does. The title comes from data-help-title, or the row's own label, or
// the element's text.
//
// One delegated listener and one shared node, so controls only have to
// declare their copy and nothing has to be wired up per control.
//
// House rule for this project, from DESIGN.md: a dial's help text is a three
// part contract. What it changes in the motion, the measured default and where
// it came from, and what happens when you push past it.

const DELAY = 140;

export function initTooltips() {
  const tip = document.createElement('div');
  tip.id = 'tip';
  tip.setAttribute('aria-hidden', 'true');
  document.body.append(tip);

  let timer = 0;
  let current = null;

  function hide() {
    clearTimeout(timer);
    tip.classList.remove('on');
    current = null;
  }

  function show(el) {
    const title =
      el.dataset.helpTitle ||
      el.querySelector('.lbl')?.textContent ||
      el.textContent.trim().slice(0, 40);
    tip.replaceChildren();
    if (title) {
      const strong = document.createElement('strong');
      strong.textContent = title;
      tip.append(strong);
    }
    const body = document.createElement('span');
    body.textContent = el.dataset.help;
    tip.append(body);
    // The source line, when a dial cites a measurement.
    if (el.dataset.helpSource) {
      const src = document.createElement('em');
      src.textContent = el.dataset.helpSource;
      tip.append(src);
    }
    tip.classList.add('on');
    place(el);
  }

  // Panels hug the window edges, so the overlay goes toward the middle where
  // it will not cover the control you are reading about.
  function place(el) {
    const r = el.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const gap = 12;
    const left = r.left < innerWidth / 2 ? r.right + gap : r.left - t.width - gap;
    tip.style.left = `${Math.max(8, Math.min(innerWidth - t.width - 8, left))}px`;
    tip.style.top = `${Math.max(8, Math.min(innerHeight - t.height - 8, r.top + r.height / 2 - t.height / 2))}px`;
  }

  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest('[data-help]');
    if (!el || el === current) return;
    clearTimeout(timer);
    current = el;
    timer = setTimeout(() => show(el), DELAY);
  });

  document.addEventListener('mouseout', (e) => {
    const el = e.target.closest('[data-help]');
    if (el && el === current && !el.contains(e.relatedTarget)) hide();
  });

  addEventListener('scroll', hide, true);
  addEventListener('blur', hide);
}

// Attach help to a node built elsewhere.
export function withHelp(node, help, title, source) {
  if (help) node.dataset.help = help;
  if (title) node.dataset.helpTitle = title;
  if (source) node.dataset.helpSource = source;
  return node;
}
