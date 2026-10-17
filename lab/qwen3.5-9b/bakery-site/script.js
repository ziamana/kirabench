document.addEventListener('DOMContentLoaded', function() {
    const contactForm = document.getElementById('contactForm');
    const thankYouMessage = document.getElementById('thankYouMessage');

    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();

        // Get form data
        const formData = {
            name: document.getElementById('name').value.trim(),
            email: document.getElementById('email').value.trim(),
            message: document.getElementById('message').value.trim()
        };

        // Simple validation
        if (formData.name.length === 0) {
            alert('Veuillez entrer votre nom.');
            return;
        }

        if (formData.email.length === 0) {
            alert('Veuillez entrer votre email.');
            return;
        }

        if (formData.message.length === 0) {
            alert('Veuillez entrer un message.');
            return;
        }

        // Simple email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            alert('Veuillez entrer un email valide.');
            return;
        }

        // Simulate form submission
        const submitBtn = contactForm.querySelector('.submit-btn');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Envoi en cours...';
        submitBtn.disabled = true;

        // Simulate server delay
        setTimeout(function() {
            // Hide form and show thank you message
            contactForm.style.display = 'none';
            thankYouMessage.style.display = 'block';

            // Reset form for future submissions
            contactForm.reset();

            // Restore submit button text (in case user wants to resubmit)
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }, 1000);
    });

    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});
