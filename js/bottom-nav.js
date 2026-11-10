// ── Bottom dock navigation (trial) ──
// On phones, a row of buttons pinned to the bottom of the screen replaces
// the top bar: one per page, emoji over a small tape label. The page you
// are on sits magnified, icon and label both.
// Every button keeps its own fixed spot whichever page is selected, so a
// tapped button grows exactly where it is and never slides. Its
// neighbours get kicked away from it, nearest hardest, then spring back
// into their own spots. Then the page changes, arriving with the same
// layout already in place.
// Remove this script tag from a page to get the old top bar back.
(function () {
  const PAGES = [
    ['projects.html', '🪄', 'Projects'],
    ['lab.html', '🧪', 'Lab'],
    ['about.html', '🧙', 'About'],
    ['contact.html', '🔮', 'Contact'],
  ];
  // How far a tap kicks the other buttons away from it, by distance in
  // buttons: 1 away, 2 away, 3 away (px).
  const KICK = [0, 12, 7, 3];
  const KICK_MS = 110;
  const SETTLE_MS = 300;        // then they spring back (matches style.css)
  const GROW_MS = KICK_MS + SETTLE_MS;

  const here = location.pathname.split('/').pop() || 'projects.html';
  const dock = document.createElement('nav');
  dock.className = 'dock';
  dock.setAttribute('aria-label', 'Pages');
  dock.innerHTML = '<div class="dock-row">' + PAGES.map(([href, emoji, label]) =>
    `<a href="${href}" class="dock-link${href === here ? ' is-active' : ''}"${href === here ? ' aria-current="page"' : ''}>` +
    `<span class="dock-emoji">${emoji}</span><span class="dock-label">${label}</span></a>`
  ).join('') + '</div>';
  // Behind the buttons: the page blurs progressively toward the bottom edge
  // so the buttons stay crisp over busy content. Sixteen nested capsules,
  // each adding a little blur, so it builds smoothly toward the middle.
  // Diagnostic switches for chasing the page-change flicker on a real phone.
  // ?noblur drops the blur, ?novt skips the browser's page transition,
  // ?reset clears both. They stick for the rest of the visit.
  const q = new URLSearchParams(location.search);
  try {
    if (q.has('reset')) { sessionStorage.removeItem('dockNoBlur'); sessionStorage.removeItem('dockNoVT'); }
    if (q.has('noblur')) sessionStorage.setItem('dockNoBlur', '1');
    if (q.has('novt')) sessionStorage.setItem('dockNoVT', '1');
  } catch (e) {}
  const flag = k => { try { return sessionStorage.getItem(k) === '1'; } catch (e) { return false; } };
  if (flag('dockNoVT')) {
    addEventListener('pageswap', e => { if (e.viewTransition) e.viewTransition.skipTransition(); });
    addEventListener('pagereveal', e => { if (e.viewTransition) e.viewTransition.skipTransition(); });
  }

  const blur = document.createElement('div');
  blur.className = 'dock-blur';
  blur.setAttribute('aria-hidden', 'true');
  blur.innerHTML = '<i></i>'.repeat(16);
  if (!flag('dockNoBlur')) document.body.appendChild(blur);
  document.body.appendChild(dock);
  document.body.classList.add('has-dock');

  const links = [...dock.querySelectorAll('.dock-link')];

  // Push every button away from the tapped one (which itself stays put),
  // or with tapped = -1, send them all home.
  function kick(tapped) {
    links.forEach((a, i) => {
      const d = i - tapped;
      const px = tapped < 0 || d === 0 ? 0 : Math.sign(d) * (KICK[Math.abs(d)] || 0);
      a.style.setProperty('--lean', px + 'px');
    });
  }

  requestAnimationFrame(() => requestAnimationFrame(() => dock.classList.add('is-ready')));

  dock.addEventListener('click', e => {
    const link = e.target.closest('.dock-link');
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const i = links.indexOf(link);
    // A tap on the current page still gets the kick, just no page change.
    links.forEach(a => a.classList.toggle('is-active', a === link));
    dock.classList.add('is-kicking');
    kick(i);
    setTimeout(() => { dock.classList.remove('is-kicking'); kick(-1); }, KICK_MS);
    if (link.getAttribute('aria-current') === 'page') return;
    // Then change page with the content fade-out the rest of the site uses.
    // The page change holds this dock on screen until the next page is
    // ready, and that page starts in the same settled layout.
    const leave = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--page-leave-ms')) || 90;
    setTimeout(() => document.body.classList.add('page-leaving'), GROW_MS - leave);
    setTimeout(() => { location.href = link.href; }, GROW_MS);
  });
})();
