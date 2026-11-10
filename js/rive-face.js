(() => {
  const canvas = document.getElementById("riveFace");
  if (!canvas || !window.rive) return;

  const face = new rive.Rive({
    src: "assets/natan-face.riv?v=2",
    canvas,
    artboard: "Profile",
    stateMachines: "State Machine",
    autoplay: true,
    autoBind: true,
    // Rive otherwise calls preventDefault on touchmove, which kills page scroll.
    isTouchScrollEnabled: true,
    onLoad: () => face.resizeDrawingSurfaceToCanvas(),
  });

  new ResizeObserver(() => face.resizeDrawingSurfaceToCanvas()).observe(canvas);

  const hint = document.querySelector(".tap-me");
  if (!hint) return;
  let start = null;
  canvas.addEventListener("pointerdown", (e) => { start = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener("pointerup", (e) => {
    if (!start) return;
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    start = null;
    if (moved < 10) hint.classList.add("is-hidden");
  });
})();
