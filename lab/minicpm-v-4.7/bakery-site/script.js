document.addEventListener('DOMContentLoaded', function() {
    const contactForm = document.getElementById('contact-form');
    const thankYouMessage = document.getElementById('thank-you');

    contactForm.addEventListener('submit', function(event) {
        event.preventDefault(); // Prevent page reload

        // Get form values
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const message = document.getElementById('message').value;

        // Simple validation
        if (name && email && message) {
            // Hide the form and show the thank-you message
            contactForm.style.display = 'none';
            thankYouMessage.style.display = 'block';

            // Optional: Reset form values
            contactForm.reset();
        }
    });
});