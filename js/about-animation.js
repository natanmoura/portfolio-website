(() => {
  const hand = document.getElementById('waveHand');
  if (!hand) return;

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function resetAnim(el) {
    el.style.animation = 'none';
    el.offsetWidth; // force reflow
  }

  async function run() {
    // ── 0. Hide hand until its cue ──────────────────────────────────────────
    hand.style.opacity = '0';

    // ── 1. Split heading into letter spans and bounce left → right (2 s) ───
    const h2       = hand.closest('h2');
    const textNode = h2.firstChild;                      // "Nice to meet you! "
    const text     = textNode.textContent.trimEnd();     // "Nice to meet you!"

    const STAGGER    = 40;   // ms between each character start
    const BOUNCE_DUR = 360;  // ms per individual letter bounce
    // Last char index 16 × 40ms delay + 360ms = 1000ms total ✓

    const frag      = document.createDocumentFragment();
    const letterEls = [];
    let word = null; // current word wrapper, so words never break mid-letter
    const flushWord = () => { if (word) { frag.appendChild(word); word = null; } };

    [...text].forEach((ch, i) => {
      if (ch === ' ') {
        flushWord();                                     // close word at the space
        frag.appendChild(document.createTextNode(' '));  // breakable gap between words
      } else {
        if (!word) {
          word = document.createElement('span');
          word.style.whiteSpace = 'nowrap';              // keep the whole word on one line
        }
        const s = document.createElement('span');
        s.style.display = 'inline-block';
        s.textContent   = ch;
        letterEls.push({ el: s, idx: i });
        word.appendChild(s);
      }
    });
    flushWord();                                         // flush the final word
    frag.appendChild(document.createTextNode(' ')); // gap before hand span
    textNode.replaceWith(frag);

    // Fire all letter bounces at once — delay handles the stagger
    letterEls.forEach(({ el, idx }) => {
      el.style.animation = `letter-bounce ${BOUNCE_DUR}ms ${idx * STAGGER}ms forwards`;
    });

    await sleep(1000);

    // ── 2. Fist bounces in 2× (0.9 s) ──────────────────────────────────────
    hand.textContent    = '✊';
    hand.style.opacity  = '1';
    resetAnim(hand);
    hand.style.animation = 'slay-bounce2 0.9s forwards';
    await sleep(792); // bounce lands at 684ms + half the original hold (108ms)
    resetAnim(hand);

    // ── 3. Wave for 2.5 s ───────────────────────────────────────────────────
    hand.textContent     = '🖐️';
    hand.style.animation = '';        // clear inline so CSS class applies
    hand.classList.add('is-waving');
    await sleep(2500);
    hand.classList.remove('is-waving');
    resetAnim(hand);

    // ── 4. Back to fist for 0.2 s ───────────────────────────────────────────
    hand.textContent = '✊';
    await sleep(200);

    // ── 5. Peace sign bounces 3× (1.3 s) ────────────────────────────────────
    hand.textContent     = '✌️';
    resetAnim(hand);
    hand.style.animation = 'slay-bounce3 1.3s forwards';
    await sleep(1300);
    resetAnim(hand);

    // ── 6. Hold 0.2 s then fade out over 2 s ────────────────────────────────
    await sleep(200);
    hand.style.transition = 'opacity 2s ease';
    hand.style.opacity    = '0';
  }

  run();
})();
