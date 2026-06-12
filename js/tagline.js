(() => {
  const snippets = [
    "Animator & Designer ✏️",
    "Emmy award-winner 🏆",
    "Curious tinkerer 🧠",
    "Born Brazilian, raised Canadian 🌎",
    "Boy dad ❤️",
    "Will mention being vegetarian 🌿",
    "Dungeon crawler 🎲",
    "Sunset-walking romantic 🌅",
    "Weak for mangos 🥭",
    "Critiques horror movie victims 💀",
    "Bike lane violator 🚲",
  ];

  const textEl    = document.getElementById('taglineText');
  const highlight = document.getElementById('taglineHighlight');
  const taglineEl = document.querySelector('.logo-tagline');
  const logoEl    = document.querySelector('.logo');
  const logoGroup = document.querySelector('.logo-group');

  if (!textEl || !highlight || !taglineEl) return;

  // ── Measure widest snippet ──────────────────────────────────────────────
  // Create a hidden probe element styled like the tagline text
  const probe = document.createElement('span');
  probe.style.cssText = [
    'position:absolute',
    'top:-9999px',
    'left:-9999px',
    'visibility:hidden',
    'white-space:nowrap',
    'font-size:0.75rem',
    'font-weight:400',
    'font-style:normal',
    'font-family:inherit',
  ].join(';');
  document.body.appendChild(probe);

  let maxSnippetW = 0;
  for (const s of snippets) {
    probe.textContent = s;
    maxSnippetW = Math.max(maxSnippetW, probe.offsetWidth);
  }
  probe.remove();

  // ── Show / hide tagline based on available space ────────────────────────
  // "available" = logo-group width minus logo width minus gap (~10px)
  function updateTaglineVisibility() {
    if (!logoGroup || !logoEl) return;
    const available = logoGroup.offsetWidth - logoEl.offsetWidth - 10;
    taglineEl.style.visibility = available >= maxSnippetW ? 'visible' : 'hidden';
  }

  // Start hidden, reveal once measured
  taglineEl.style.visibility = 'hidden';
  updateTaglineVisibility();

  const ro = new ResizeObserver(updateTaglineVisibility);
  ro.observe(logoGroup || document.querySelector('.site-header'));

  // ── Typewriter ──────────────────────────────────────────────────────────
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function typeText(str) {
    for (const ch of str) {
      textEl.textContent += ch;
      const delay = 25 + Math.random() * 40 + (Math.random() < 0.1 ? 80 : 0);
      await sleep(delay);
    }
  }

  async function selectAndDelete() {
    const w = textEl.getBoundingClientRect().width;
    // Hide cursor, start highlight sweep
    taglineEl.classList.add('is-selecting');
    highlight.style.transition = 'none';
    highlight.style.width = '0';
    highlight.offsetWidth; // force reflow
    highlight.style.transition = 'width 0.25s linear';
    highlight.style.width = w + 'px';
    await sleep(260);   // wait for sweep
    await sleep(100);   // hold 0.1s before erasing
    // Erase
    highlight.style.transition = 'none';
    highlight.style.width = '0';
    textEl.textContent = '';
    taglineEl.classList.remove('is-selecting');
  }

  // Average time one snippet occupies: typing (~45ms/char avg) + 2000ms hold
  // + 260ms select-delete + 400ms pause. Use a fixed average so every page
  // load at the same clock time lands on the same snippet — feels always-on.
  const AVG_SNIPPET_MS = 3600;
  const elapsed = Date.now() % (snippets.length * AVG_SNIPPET_MS);
  let idx = Math.floor(elapsed / AVG_SNIPPET_MS);

  async function run() {
    while (true) {
      await typeText(snippets[idx]);
      idx = (idx + 1) % snippets.length;
      await sleep(3000);        // hold with blinking cursor
      await selectAndDelete();  // sweep-select then delete
      await sleep(400);         // pause before next
    }
  }

  setTimeout(run, 800);
})();
