// ---------- mobile burger toggle
const burger = document.querySelector('.burger');
const nav = document.querySelector('#mainnav');
if (burger && nav) {
  burger.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}

// ---------- year in footer
const y = document.getElementById('year');
if (y) y.textContent = new Date().getFullYear();

// ---------- tiny toast helper
function toast(msg, ok = true) {
  const box = document.createElement('div');
  box.textContent = msg;
  Object.assign(box.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    padding: '10px 14px',
    background: ok ? '#2ecc71' : '#e74c3c',
    color: '#fff',
    borderRadius: '10px',
    boxShadow: '0 4px 12px rgba(0,0,0,.25)',
    zIndex: 1000,
    fontFamily: 'system-ui, sans-serif',
    transition: 'opacity .4s ease',
  });
  document.body.appendChild(box);
  setTimeout(() => { box.style.opacity = '0'; setTimeout(() => box.remove(), 400); }, 2500);
}

// ---------- contact form handler
const form = document.querySelector('.form');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
      name: form.querySelector('input[name="name"]').value.trim(),
      email: form.querySelector('input[name="email"]').value.trim(),
      message: form.querySelector('textarea[name="message"]').value.trim(),
    };
    if (!data.name || !data.email || !data.message) {
      toast('Please fill all fields.', false);
      return;
    }

    try {
      // If you open the site at http://localhost:5173, this relative URL is correct:
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      // If you prefer running Live Server (5500), use the absolute URL instead:
      // const res = await fetch('http://localhost:5173/api/contact', { ...same options... });

      if (!res.ok) throw new Error('Request failed');
      toast('✅ Message sent successfully!');
      form.reset();
    } catch (err) {
      console.error(err);
      toast('Sorry — could not send. Try again later.', false);
    }
  });
}
// --- category filters
const pills = document.querySelectorAll('.pill');
const cards = document.querySelectorAll('.product');
pills.forEach(p => {
  p.addEventListener('click', () => {
    pills.forEach(x => x.classList.remove('active'));
    p.classList.add('active');
    const f = p.dataset.filter;
    cards.forEach(c => {
      const show = f === 'all' || c.dataset.cat === f;
      c.style.display = show ? '' : 'none';
    });
  });
});
// Deep-link filtering (supports #gpu, #cooler, #coolers, #case, #cases)
(function () {
  const normalize = h => ({coolers:'cooler', cases:'case'}[h] || h);
  const hash = (location.hash || '').slice(1).toLowerCase();
  if (!hash) return;
  const target = normalize(hash);
  const pill = document.querySelector(`.pill[data-filter="${target}"]`);
  if (pill) pill.click();
})();
