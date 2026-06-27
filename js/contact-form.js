// Contact form modal: open from the email button, submit via Web3Forms (AJAX).
(function () {
  const modal = document.getElementById('contactModal');
  const openBtn = document.getElementById('contactOpen');
  const form = document.getElementById('contactForm');
  const status = document.getElementById('formStatus');
  if (!modal || !openBtn || !form) return;

  let lastFocused = null;

  function openModal(e) {
    if (e) e.preventDefault();
    lastFocused = document.activeElement;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    const first = form.querySelector('input:not([type=hidden]):not([name=botcheck])');
    if (first) first.focus();
  }

  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocused) lastFocused.focus();
  }

  const card = modal.querySelector('.form-modal-card');

  // On success: shrink the box to just the thank-you message, hold, then close.
  function showComplete() {
    const startH = card.offsetHeight;
    card.classList.add('is-complete');      // hides form/title/cross, shows message
    const endH = card.offsetHeight;          // natural height of the small box
    card.style.height = startH + 'px';
    card.getBoundingClientRect();            // force reflow
    card.style.transition = 'height 0.35s ease';
    requestAnimationFrame(function () { card.style.height = endH + 'px'; });

    // shrink (0.35s) → hold 2s → fade out and reset
    setTimeout(function () {
      closeModal();
      setTimeout(resetCard, 260);            // after the modal's opacity fade
    }, 350 + 2000);
  }

  function resetCard() {
    card.classList.remove('is-complete');
    card.style.transition = '';
    card.style.height = '';
    status.className = 'form-status';
    status.textContent = '';
    const submitBtn = form.querySelector('.form-submit');
    if (submitBtn) submitBtn.disabled = false;
  }

  openBtn.addEventListener('click', openModal);

  // Close on backdrop / close-button click, or Escape.
  modal.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });

  // Submit via Web3Forms without leaving the page.
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const submitBtn = form.querySelector('.form-submit');
    status.className = 'form-status is-pending';
    status.textContent = 'Sending…';
    submitBtn.disabled = true;
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form),
      });
      const json = await res.json();
      if (json.success) {
        form.reset();
        showComplete();
      } else {
        status.className = 'form-status is-error';
        status.textContent = json.message || 'Something went wrong. Please try again.';
        submitBtn.disabled = false;
      }
    } catch (err) {
      status.className = 'form-status is-error';
      status.textContent = 'Network error. Please try again, or email me directly.';
      submitBtn.disabled = false;
    }
  });
})();
