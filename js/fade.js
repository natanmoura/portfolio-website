// Page fade-in
document.addEventListener('DOMContentLoaded', () => {
  requestAnimationFrame(() => document.body.classList.add('page-loaded'));
});

// Observe .fade-in-item elements within a root and reveal them
function observeFadeItems(root) {
  const items = root.querySelectorAll('.fade-in-item');
  if (!items.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('fade-in-item--visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });

  items.forEach((el, i) => {
    el.style.transitionDelay = `${i * 70}ms`;
    observer.observe(el);
  });
}

// Auto-observe on static pages (about, contact, etc.)
document.addEventListener('DOMContentLoaded', () => observeFadeItems(document.body));

// ── Fade out before leaving for another page on this site ──
// The browser paints nothing while it fetches the next document, so without
// this the old page sits there and then snaps. Taking the content out first
// hands over to the new page's fade-in.
(function () {
  // Read the duration from the stylesheet so the wait here and the CSS
  // transition can never drift apart.
  const DURATION = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--page-leave-ms')
  ) || 90;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const a = e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;

    let url;
    try { url = new URL(a.href, location.href); } catch { return; }

    // Only this site, and only an actual page change — a hash link or a
    // project opening in place is handled by the page itself.
    if (url.origin !== location.origin) return;
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
    if (url.pathname === location.pathname && url.search === location.search) return;

    e.preventDefault();
    document.body.classList.add('page-leaving');
    setTimeout(() => { location.href = a.href; }, DURATION);
  });

  // Coming back via the browser's back button can restore this page from the
  // cache mid-fade; clear the class so it is not left invisible.
  window.addEventListener('pageshow', () => document.body.classList.remove('page-leaving'));
}());
