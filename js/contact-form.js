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
    clearErrors();
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

  // ── Validation ──────────────────────────────────────────────────────────
  // The browser's own "Please fill out this field" bubble is drawn by the
  // browser and cannot be styled, so the form carries novalidate and this
  // stands in for it, in the card's own type and colours.
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Give every field its message slot up front. Paired with .form-error's
  // reserved height, that keeps the form's spacing identical whether or not
  // anything is being flagged.
  form.querySelectorAll('.form-field').forEach(function (field) {
    if (!field.querySelector('input, textarea')) return;
    const el = document.createElement('span');
    el.className = 'form-error';
    field.appendChild(el);
  });

  function setError(field, msg) {
    const el = field.querySelector('.form-error');
    if (el) el.textContent = msg || '';
    field.classList.toggle('is-invalid', !!msg);
  }

  function checkField(field) {
    const input = field.querySelector('input, textarea');
    if (!input || !input.required) return true;
    const value = input.value.trim();
    if (!value) { setError(field, "This one's required"); return false; }
    if (input.type === 'email' && !EMAIL_RE.test(value)) {
      setError(field, 'That email looks off');
      return false;
    }
    setError(field, '');
    return true;
  }

  function validate() {
    let firstBad = null;
    form.querySelectorAll('.form-field').forEach(function (field) {
      if (!checkField(field) && !firstBad) firstBad = field;
    });
    if (firstBad) {
      const input = firstBad.querySelector('input, textarea');
      if (input) input.focus();
      return false;
    }
    return true;
  }

  function clearErrors() {
    form.querySelectorAll('.form-field').forEach(function (f) { setError(f, ''); });
  }

  // Re-check a field once it has been flagged, so the message clears as the
  // person fixes it rather than only on the next submit.
  form.addEventListener('input', function (e) {
    const field = e.target.closest('.form-field');
    if (field && field.classList.contains('is-invalid')) checkField(field);
  });

  // Submit via Web3Forms without leaving the page.
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!validate()) return;
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
