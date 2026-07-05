(() => {
  const snippets = [
    "Animator & Designer ✏️",
    "Emmy award-winner 🏆",
    "Curious tinkerer 🧠",
    "Born Brazilian, raised Canadian 🌎",
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

  // Tagline now sits on its own line below the name, so it always has room —
  // keep it visible at every width (it clips gracefully if a snippet is wide).
  taglineEl.style.visibility = 'visible';

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

  // If the intro takeover animation is still on screen, wait for it to
  // finish (and fade away) before the first snippet starts typing —
  // otherwise the wizard overlay hides it.
  const introOverlay = document.getElementById('introOverlay');
  if (introOverlay) {
    document.addEventListener('introDone', () => setTimeout(run, 800), { once: true });
  } else {
    setTimeout(run, 800);
  }
})();
