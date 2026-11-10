// ── Haptic ticks ──
// haptic.tick() gives one short tick on phones that allow it from a web
// page:
//  - Android: the Vibration API. Works any time once the visitor has
//    touched the page, so the drum can tick for every row it passes.
//  - iPhone: Safari has no Vibration API. Since iOS 18, toggling a
//    switch-style checkbox plays the system's selection tick, so this
//    keeps one hidden and toggles it. iOS only allows it in direct
//    response to a touch (a tap, a finger lifting), never on its own, so
//    on iPhone ticks only happen on those. This leans on undocumented
//    behaviour: if a future iOS stops it, the page just goes quiet.
// Elsewhere it does nothing.
(function () {
  const canVibrate = typeof navigator.vibrate === 'function' && /Android/i.test(navigator.userAgent);
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const MIN_GAP_MS = 35;   // ticks closer together than this blur into a buzz
  let last = 0, label = null;

  function iosSwitch() {
    if (label) return label;
    label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    return label;
  }

  function tick() {
    const now = performance.now();
    if (now - last < MIN_GAP_MS) return;
    last = now;
    try {
      if (canVibrate) navigator.vibrate(8);
      else if (isIOS) iosSwitch().click();
    } catch (e) {}
  }

  // `anyTime`: true where ticks can fire outside a touch (Android), so
  // callers know whether per-row ticks during a coast will be felt.
  window.haptic = { tick, anyTime: canVibrate, ios: isIOS };
})();
