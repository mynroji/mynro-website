const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.primary-nav');
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  nav.classList.toggle('open', open);
  document.body.classList.toggle('menu-open', open);
});
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  nav.classList.remove('open'); menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Open navigation'); document.body.classList.remove('menu-open');
}));

const revealItems = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('in-view'); observer.unobserve(entry.target); }
  }), { threshold: 0.12 });
  revealItems.forEach(item => observer.observe(item));
} else revealItems.forEach(item => item.classList.add('in-view'));

document.querySelector('#year').textContent = new Date().getFullYear();

const form = document.querySelector('#quote-form');
const feedback = document.querySelector('#form-feedback');
form.addEventListener('submit', event => {
  event.preventDefault();
  feedback.textContent = '';
  if (!form.reportValidity()) return;
  const values = new FormData(form);
  const fields = [
    ['Name', 'name'], ['WhatsApp', 'phone'], ['Email', 'email'], ['Service', 'service'],
    ['Number of videos', 'count'], ['Approx. duration', 'duration'], ['Project description', 'description'],
    ['Reference video', 'reference'], ['Desired delivery date', 'date'], ['Additional requirements', 'requirements']
  ];
  const message = ['Hello MYNRO, I would like to request a custom quote.', '', ...fields
    .filter(([, key]) => String(values.get(key) || '').trim())
    .map(([label, key]) => `${label}: ${String(values.get(key)).trim()}`)
  ].join('\n');
  const url = `https://wa.me/917990540850?text=${encodeURIComponent(message)}`;
  const popup = window.open(url, '_blank', 'noopener,noreferrer');
  if (!popup) window.location.href = url;
});
