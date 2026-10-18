// Form submission handler - shows thank-you message without reloading
const form = document.getElementById('contact-form');
const thankYou = document.getElementById('thank-you');

form.addEventListener('submit', function(e) {
  e.preventDefault();

  // Simple validation (HTML5 already handles required fields)
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const message = document.getElementById('message').value.trim();

  if (!name || !email || !message) {
    alert('Veuillez remplir tous les champs.');
    return;
  }

  // Show thank-you message
  thankYou.classList.remove('hidden');
  form.reset();

  // Optional: scroll to top after submission
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
