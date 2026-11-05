// ── Header height CSS var ──
(function() {
  const hdr = document.querySelector('.site-header');
  function setH() { document.documentElement.style.setProperty('--header-h', hdr.offsetHeight + 'px'); }
  setH();
  window.addEventListener('resize', setH);
})();

const navToggle = document.getElementById('navToggle');
const navOverlay = document.getElementById('navOverlay');

function openNav() {
  navToggle.classList.add('is-open');
  navOverlay.classList.add('is-open');
  document.body.classList.add('nav-open');
}

function closeNav() {
  navToggle.classList.remove('is-open');
  navOverlay.classList.remove('is-open');
  document.body.classList.remove('nav-open');
}

navToggle.addEventListener('click', () => {
  navToggle.classList.contains('is-open') ? closeNav() : openNav();
});

// Deliberately not closing the menu here. These links leave the page, and
// fade.js holds the navigation for a moment first, so closing the menu would
// uncover the old page for that moment — you see where you just were, then it
// switches. Leaving the yellow panel up covers the whole handover instead, and
// the new document arrives with it already closed. (page-leaving in style.css
// excludes .nav-overlay for the same reason.)
//
// Coming back through the browser cache restores this page with the menu still
// open, so clear it on pageshow.
window.addEventListener('pageshow', closeNav);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeNav(); });

// Growing past the header breakpoint swaps the hamburger out for the inline
// nav, which leaves the full-screen menu stranded with nothing to close it.
// Reading the toggle's own display keeps the breakpoint in one place, the CSS.
window.addEventListener('resize', () => {
  if (navOverlay.classList.contains('is-open') &&
      getComputedStyle(navToggle).display === 'none') closeNav();
});

// ── Emoji bounce on nav hover ──
document.querySelectorAll('.site-header nav a').forEach(link => {
  const emoji = link.querySelector('.nav-emoji');
  if (!emoji) return;

  let hovered = false;

  link.addEventListener('mouseenter', () => {
    hovered = true;
    // Only start if not already mid-bounce
    if (!emoji.classList.contains('bouncing')) {
      emoji.classList.add('bouncing');
    }
  });

  link.addEventListener('mouseleave', () => {
    hovered = false;
    // Let the current bounce finish, then stop only if still not hovered
    emoji.addEventListener('animationiteration', () => {
      if (!hovered) emoji.classList.remove('bouncing');
    }, { once: true });
  });
});
