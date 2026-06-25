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
