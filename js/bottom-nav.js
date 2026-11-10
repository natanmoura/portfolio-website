// ── Bottom dock navigation (trial) ──
// Replaces the top bar with a yellow strip pinned to the bottom of the
// screen, like an OS dock: one button per page, emoji over a small label.
// The emoji bounces once when tapped, and the page change waits for the top
// of that bounce so the tap visibly lands. Remove this script tag from a
// page to get the old top bar back.
(function () {
  const PAGES = [
    ['projects.html', '🪄', 'Projects'],
    ['lab.html', '🧪', 'Lab'],
    ['about.html', '🧙', 'About'],
    ['contact.html', '🔮', 'Contact'],
  ];
  const BOUNCE_PEAK_MS = 250;   // emoji-bounce is 0.5 s, up then down

  const here = location.pathname.split('/').pop() || 'projects.html';
  const dock = document.createElement('nav');
  dock.className = 'dock';
  dock.setAttribute('aria-label', 'Pages');
  dock.innerHTML = '<div class="dock-row">' + PAGES.map(([href, emoji, label]) =>
    `<a href="${href}" class="dock-link${href === here ? ' is-active' : ''}"${href === here ? ' aria-current="page"' : ''}>` +
    `<span class="dock-emoji">${emoji}</span><span class="dock-label">${label}</span></a>`
  ).join('') + '</div>';
  document.body.appendChild(dock);
  document.body.classList.add('has-dock');

  function bounce(emoji) {
    emoji.classList.remove('is-bouncing');
    void emoji.offsetWidth;        // restart the animation on repeat taps
    emoji.classList.add('is-bouncing');
  }

  dock.addEventListener('pointerdown', e => {
    const link = e.target.closest('.dock-link');
    if (link) bounce(link.querySelector('.dock-emoji'));
  });

  // The browser photographs this dock to hold on screen while the next page
  // loads. Settle any bounce first, or the photo keeps the emoji mid-air and
  // it drops into place when the live dock takes over.
  window.addEventListener('pageswap', () => {
    dock.querySelectorAll('.is-bouncing').forEach(el => el.classList.remove('is-bouncing'));
  });

  dock.addEventListener('animationend', e => {
    if (e.target.classList.contains('dock-emoji')) e.target.classList.remove('is-bouncing');
  });

  // Hold the page change until the bounce peaks, then hand over to the
  // same fade-out the rest of the site uses.
  dock.addEventListener('click', e => {
    const link = e.target.closest('.dock-link');
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (link.classList.contains('is-active')) return;
    // Show the destination as active right away. The page change keeps this
    // dock on screen until the next page is ready, so it must already match.
    dock.querySelectorAll('.dock-link').forEach(a => a.classList.toggle('is-active', a === link));
    setTimeout(() => {
      document.body.classList.add('page-leaving');
      const leave = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--page-leave-ms')) || 90;
      setTimeout(() => { location.href = link.href; }, leave);
    }, BOUNCE_PEAK_MS);
  });
})();
