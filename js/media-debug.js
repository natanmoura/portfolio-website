// ── Video diagnostics (any gallery page + ?mediadebug) ──
// A live readout of every video on the page, for finding out on a real
// phone why one is frozen. Screenshot it when something looks stuck.
(() => {
  const M = window.__media;
  if (!M) return;

  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:6px;right:6px;bottom:6px;z-index:9999;max-height:45vh;overflow:auto;' +
    'background:rgba(0,0,0,.85);color:#fff;font:10px/1.35 ui-monospace,Menlo,monospace;padding:6px 8px;border-radius:6px;white-space:pre-wrap;pointer-events:auto';
  document.body.appendChild(box);

  const RS = ['nothing', 'metadata', 'current', 'future', 'enough'];
  const NS = ['empty', 'idle', 'loading', 'no-source'];
  const last = new WeakMap();

  function row(v) {
    const t = v.currentTime || 0;
    const prev = last.get(v);
    const moving = prev != null && t !== prev;
    last.set(v, t);
    const state = v.ended ? 'ENDED' : v.paused ? 'paused' : moving ? 'playing' : 'FROZEN?';
    const err = v.error ? ' err' + v.error.code : '';
    const want = M.wantsPlay.has(v) ? '*' : ' ';
    return `${want}${M.name(v).padEnd(14).slice(0, 14)} ${state.padEnd(8)} ${t.toFixed(1).padStart(6)}s rs:${RS[v.readyState] || v.readyState} net:${NS[v.networkState] || v.networkState}${err}`;
  }

  function draw() {
    const vids = [...document.querySelectorAll('video, mux-player')].filter(v => v.tagName === 'MUX-PLAYER' || !v.closest('mux-player'));
    const head = [
      `autoplay: ${M.blocked ? 'BLOCKED (Low Power Mode or no tap yet)' : 'allowed'}`,
      `reduced motion: ${matchMedia('(prefers-reduced-motion: reduce)').matches}   tab: ${document.visibilityState}`,
      `videos on page: ${vids.length}   with a source: ${vids.filter(v => v.tagName === 'MUX-PLAYER' ? v.getAttribute('playback-id') : v.getAttribute('src')).length}   * = should be playing`,
      '',
    ];
    const rows = vids.filter(v => M.wantsPlay.has(v) || !v.paused).map(row);
    box.textContent = head.concat(rows.length ? rows : ['(nothing on screen)'], ['', '— events —'], M.log.slice(-12)).join('\n');
  }
  draw();
  setInterval(draw, 700);
})();
