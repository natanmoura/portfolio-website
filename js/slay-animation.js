(() => {
  const stage      = document.getElementById('slayStage');
  if (!stage) return;

  const wizardEl    = document.getElementById('slayWizard');
  const elfEl       = document.getElementById('slayElf');
  const exclaim1El  = document.getElementById('slayExclaim1');
  const exclaim2El  = document.getElementById('slayExclaim2');
  const weaponWrap  = document.getElementById('slayWeaponWrap');
  const weaponEl    = document.getElementById('slayWeapon');
  const monsterEl   = document.getElementById('slayMonster');

  const monsters = ['🐉', '🕷️', '🦇'];
  const weapons  = ['🗡️', '🪓', '🪃'];

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function resetAnim(el) {
    el.style.animation = 'none';
    el.offsetWidth; // force reflow so next assignment triggers fresh animation
  }

  let round = 0;

  async function runSequence() {
    while (true) {
      const monsterEmoji = monsters[round % 3];
      const weaponEmoji  = weapons[round % 3];
      round++;

      // ── 1. Monster appears, bounces 3×  (1.3 s) ────────────────────────
      monsterEl.textContent = monsterEmoji;
      monsterEl.style.transform = '';
      monsterEl.style.opacity = '1';
      resetAnim(monsterEl);
      monsterEl.style.animation = 'slay-bounce3 1.3s forwards';
      await sleep(1300); // exact match — bounces fully complete

      // ── 2. Two exclamations flash 3× above each hero  (1.5 s) ──────────
      resetAnim(exclaim1El);
      resetAnim(exclaim2El);
      exclaim1El.style.opacity = '1';
      exclaim2El.style.opacity = '1';
      exclaim1El.style.animation = 'slay-flash3 1.5s forwards';
      exclaim2El.style.animation = 'slay-flash3 1.5s forwards';
      await sleep(1500);
      resetAnim(exclaim1El);
      resetAnim(exclaim2El);
      exclaim1El.style.opacity = '0';
      exclaim2El.style.opacity = '0';

      // ── 3. Weapon flies + heroes lunge to throw, simultaneously ─────────
      const sr = stage.getBoundingClientRect();
      const er = elfEl.getBoundingClientRect();
      const mr = monsterEl.getBoundingClientRect();

      const startX = er.right  - sr.left + 6;
      const endX   = mr.left   - sr.left - 6;

      weaponEl.textContent = weaponEmoji;
      weaponWrap.style.transition = 'none';
      weaponWrap.style.left = startX + 'px';
      weaponWrap.style.opacity = '1';
      resetAnim(weaponEl);
      weaponEl.style.display = 'inline-block';
      weaponEl.style.animation = 'slay-weapon-spin 0.45s linear infinite';

      // Hero throw lunge fires at the same moment — 0.4 s, no await needed
      resetAnim(wizardEl);
      resetAnim(elfEl);
      wizardEl.style.animation = 'slay-throw 0.22s forwards';
      elfEl.style.animation    = 'slay-throw 0.22s 0.01s forwards';

      weaponWrap.offsetWidth; // reflow before transition
      weaponWrap.style.transition = 'left 1.2s linear';
      weaponWrap.style.left = endX + 'px';
      await sleep(1200);

      // ── 5. Weapon gone → explosion flashes 3×  (0.9 s) ─────────────────
      weaponWrap.style.opacity = '0';
      weaponWrap.style.transition = 'none';
      resetAnim(weaponEl);

      monsterEl.textContent = '💥';
      monsterEl.style.opacity = '1';
      resetAnim(monsterEl);
      monsterEl.style.animation = 'slay-flash3 0.9s forwards';
      await sleep(900);
      resetAnim(monsterEl);

      // ── 6. Skull floats up and fades (0.9 s) — fires concurrently ───────
      //    Heroes start celebrating at the same time
      monsterEl.textContent = '💀';
      monsterEl.style.opacity = '1';
      resetAnim(monsterEl);
      monsterEl.style.animation = 'slay-skull-exit 0.9s ease-out forwards';
      // No await — let skull exit play while heroes celebrate below

      // ── 7. Heroes celebrate  (10 × 0.38 s = 3.8 s, elf offset 0.17 s) ──
      resetAnim(wizardEl);
      resetAnim(elfEl);
      wizardEl.style.animation = 'slay-celebrate 0.38s ease-in-out 5';
      elfEl.style.animation    = 'slay-celebrate 0.38s ease-in-out 5 0.17s';
      // 5 cycles × 0.38 s = 1.9 s; elf finishes at 1.9 + 0.17 = 2.07 s
      await sleep(2150);
      resetAnim(wizardEl);
      resetAnim(elfEl);

      // ── 8. Pause then reset for next round ──────────────────────────────
      await sleep(500);
      monsterEl.style.opacity = '0';
      resetAnim(monsterEl);
    }
  }

  runSequence();
})();
