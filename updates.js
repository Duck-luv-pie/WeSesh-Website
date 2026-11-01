// "Get updates": the button opens an email field; submitting posts to Netlify Forms without leaving the page.
(() => {
  const form = document.querySelector('form.updates');
  if (!form) return;
  const btn = form.querySelector('.updates-btn'), label = form.querySelector('.ub-label');
  const input = form.querySelector('input[type=email]'), msg = form.querySelector('.updates-msg');

  const open = () => {
    form.classList.add('open');
    btn.type = 'submit';
    label.textContent = 'Subscribe';
    input.tabIndex = 0;
    setTimeout(() => input.focus(), 150);
  };

  // The header's "Get updates" scrolls up to the form and opens it.
  document.querySelectorAll('[data-open-updates]').forEach(link => link.addEventListener('click', e => {
    e.preventDefault();
    form.closest('.hero').scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!form.classList.contains('done')) open();
  }));

  btn.addEventListener('click', e => {
    if (!form.classList.contains('open')) { e.preventDefault(); open(); }
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!input.checkValidity()) { input.reportValidity(); return; }
    btn.disabled = true; label.textContent = 'Subscribing…';
    try {
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString(),
      });
      if (!res.ok) throw new Error(res.status);
      form.classList.add('done');
      msg.textContent = "You're on the list. We'll email you when there's news.";
    } catch {
      btn.disabled = false; label.textContent = 'Subscribe';
      msg.textContent = 'Something went wrong. Please try again.';
      msg.classList.add('err');
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && form.classList.contains('open') && !form.classList.contains('done') && !input.value) {
      form.classList.remove('open'); btn.type = 'button'; label.textContent = 'Get updates'; input.tabIndex = -1; msg.textContent = '';
    }
  });
})();
