(function () {
  "use strict";

  const form = document.getElementById("contactForm");
  const thankYou = document.getElementById("thankYou");

  // Fields to validate
  const fields = ["name", "email", "message"];

  function showError(field, message) {
    const input = document.getElementById(field);
    const hint = document.querySelector(`[data-error="${field}"]`);
    if (hint) hint.textContent = message || "Champ obligatoire.";
    input.setAttribute("aria-invalid", "true");
  }

  function clearError(field) {
    const input = document.getElementById(field);
    const hint = document.querySelector(`[data-error="${field}"]`);
    if (hint) hint.textContent = "";
    input.removeAttribute("aria-invalid");
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  function validate() {
    let valid = true;

    fields.forEach((field) => clearError(field));

    // Name
    const name = form.name.value.trim();
    if (name.length < 1) {
      showError("name");
      valid = false;
    }

    // Email
    const email = form.email.value.trim();
    if (!isValidEmail(email)) {
      showError("email", "Adresse email invalide.");
      valid = false;
    }

    // Message
    const message = form.message.value.trim();
    if (message.length < 1) {
      showError("message");
      valid = false;
    }

    if (valid) {
      // Reset form and show thank-you message
      form.reset();
      thankYou.textContent = "Merci ! Votre message a bien été envoyé. 🥐";
      thankYou.style.display = "block";
      thankYou.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    return valid;
  }

  // Clear errors while typing
  fields.forEach((field) => {
    const input = document.getElementById(field);
    input.addEventListener("input", () => clearError(field));
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (validate()) {
      event.target.reset();
    }
  });
})();
