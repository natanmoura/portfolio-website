/* ═══════════════════════════════════════════════════════════════
   Cross-page fade — index.html and recipe.html are separate
   documents, so a normal <a> jump is an instant hard cut. This fades
   the outgoing page out before the browser navigates, and fades the
   incoming page in, so moving between them feels like one app.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function revealPage() {
    if (reduceMotion) {
      document.documentElement.classList.remove('pf-loading');
      return;
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        document.documentElement.classList.remove('pf-loading');
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', revealPage);
  } else {
    revealPage();
  }

  // Any same-origin link to a different page fades out first.
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;

    var url;
    try { url = new URL(a.href, location.href); } catch (err) { return; }
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname) return; // in-page hash/tab nav — no page transition needed

    if (reduceMotion) return; // let it navigate immediately

    e.preventDefault();
    document.documentElement.classList.add('pf-leaving');
    setTimeout(function () { location.href = a.href; }, 200);
  });
})();
