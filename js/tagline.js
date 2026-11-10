(() => {
  const snippets = [
    "Animator & Creative Technologist ✏️",
    "Emmy award-winner 🏆",
    "Curious tinkerer 🧠",
    "Boy dad ❤️",
    "Vegetarian 🌱",
    "Dungeon crawler 🎲",
    "Sunset walker 🌅",
    "Weak for mangos 🥭",
    "Judging horror movie victims 💀",
    "Bike lane violator 🚲",
  ];

  const textEl    = document.getElementById('taglineText');
  const highlight = document.getElementById('taglineHighlight');
  const taglineEl = document.querySelector('.logo-tagline');

  if (!textEl || !highlight || !taglineEl) return;

  // Tagline sits on its own line below the name, so it always has room at any
  // width (it clips gracefully if a snippet is wide). While the intro is on
  // screen, hide it outright: the overlay fades to transparent before it is
  // removed, and a blinking cursor showing through that fade reads as the
  // tagline starting up behind the intro.
  const introOverlay = document.documentElement.classList.contains('no-intro') ? null : document.getElementById('introOverlay');
  taglineEl.style.visibility = introOverlay ? 'hidden' : 'visible';

  // ── Typewriter ──────────────────────────────────────────────────────────
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function typeText(str) {
    // Keep an emoji and its U+FE0F selector together so "✏️" isn't typed as two keystrokes.
    for (const ch of str.match(/[\s\S]️?/gu)) {
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

  // Show the cursor only once the yellow has gone and the wizard is off screen,
  // then give it a beat to blink before the first snippet types.
  function start() {
    taglineEl.style.visibility = 'visible';
    setTimeout(run, 800);
  }

  if (introOverlay) {
    document.addEventListener('introDone', start, { once: true });
  } else {
    start();
  }
})();
