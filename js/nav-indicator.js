(function () {
  const header = document.querySelector('.site-header');
  const nav = header && header.querySelector('nav');
  if (!nav) return;

  const links = [...nav.querySelectorAll('a')];

  const path = window.location.pathname;
  let activeIndex = -1;
  if      (path.includes('projects')) activeIndex = links.findIndex(l => l.href.includes('projects'));
  else if (path.includes('about'))    activeIndex = links.findIndex(l => l.href.includes('about'));
  else if (path.includes('contact'))  activeIndex = links.findIndex(l => l.href.includes('contact'));

  const activeLink = activeIndex >= 0 ? links[activeIndex] : null;
  if (activeLink) activeLink.classList.add('nav-active');

  // Center of the text node only (excludes emoji span)
  function getTextCenter(link) {
    const textNode = link.lastChild;
    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
      const text = textNode.textContent;
      const leading = text.length - text.trimStart().length;
      const r = document.createRange();
      r.setStart(textNode, leading);
      r.setEnd(textNode, text.length);
      const rect = r.getBoundingClientRect();
      return rect.left + rect.width / 2;
    }
    const rect = link.getBoundingClientRect();
    return rect.left + rect.width / 2;
  }

  // Build a 7-point polygon with a triangular notch cut from the bottom edge.
  // When cx is null, returns a plain rectangle (no notch).
  function buildClipPath(cx) {
    const w = document.documentElement.clientWidth;
    const h = header.offsetHeight;
    const tw = 6; // half base width
    const th = 6; // notch depth
    if (cx === null) {
      // Degenerate — same 7 points but all notch points collapse to one spot
      // so it can still animate to a real notch without changing point count
      const mid = w / 2;
      return `polygon(0px 0px, ${w}px 0px, ${w}px ${h}px, ${mid}px ${h}px, ${mid}px ${h}px, ${mid}px ${h}px, 0px ${h}px)`;
    }
    return `polygon(0px 0px, ${w}px 0px, ${w}px ${h}px, ${cx + tw}px ${h}px, ${cx}px ${h - th}px, ${cx - tw}px ${h}px, 0px ${h}px)`;
  }

  const MOBILE_BP = 720;
  const isMobile = () => window.innerWidth <= MOBILE_BP;

  function applyClipPath(cx, instant) {
    if (isMobile()) {
      header.style.transition = 'none';
      header.style.clipPath = '';
      return;
    }
    if (instant) {
      header.style.transition = 'none';
      header.style.clipPath = buildClipPath(cx);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        header.style.transition = 'clip-path 0.2s cubic-bezier(0.45, 0, 0.55, 1)';
      }));
    } else {
      header.style.clipPath = buildClipPath(cx);
    }
  }

  if (activeLink) {
    const prevIndex = parseInt(sessionStorage.getItem('navActiveIndex') ?? '-1', 10);
    const prevLink  = prevIndex >= 0 && prevIndex !== activeIndex ? links[prevIndex] : null;

    if (prevLink) {
      // Start at previous notch position, then slide to current
      applyClipPath(getTextCenter(prevLink), true);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        header.style.transition = 'clip-path 0.2s cubic-bezier(0.45, 0, 0.55, 1)';
        if (!isMobile()) header.style.clipPath = buildClipPath(getTextCenter(activeLink));
      }));
    } else {
      applyClipPath(getTextCenter(activeLink), true);
    }

    sessionStorage.setItem('navActiveIndex', activeIndex);
  } else {
    // Home page — no notch
    applyClipPath(null, true);
    sessionStorage.removeItem('navActiveIndex');
  }

  window.addEventListener('resize', () => {
    header.style.transition = 'none';
    header.style.clipPath = isMobile() ? '' : buildClipPath(activeLink ? getTextCenter(activeLink) : null);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      header.style.transition = 'clip-path 0.2s cubic-bezier(0.45, 0, 0.55, 1)';
    }));
  });
})();
