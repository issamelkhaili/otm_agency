document.addEventListener('DOMContentLoaded', () => {
  // Mobile menu functionality
  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.nav-menu');

  hamburger?.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu?.classList.toggle('active');
  });

  // Close mobile menu when clicking on a nav link
  const navLinks = document.querySelectorAll('.nav-menu a');
  for (const link of navLinks) {
    link.addEventListener('click', () => {
      hamburger?.classList.remove('active');
      navMenu?.classList.remove('active');
    });
  }

  // Smooth scrolling for navigation links
  const anchors = document.querySelectorAll('a[href^="#"]');
  for (const anchor of anchors) {
    anchor.addEventListener('click', (e: Event) => {
      e.preventDefault();
      const element = anchor as HTMLAnchorElement;
      const href = element.getAttribute('href');
      if (!href) return;

      const target = document.querySelector(href);
      if (target) {
        window.scrollTo({
          top: target.getBoundingClientRect().top + window.scrollY - 80,
          behavior: 'smooth'
        });
      }
    });
  }

  // Sticky header on scroll
  const header = document.getElementById('header');
  const sticky = header?.offsetTop || 0;

  window.addEventListener('scroll', () => {
    if (window.scrollY > sticky + 100) {
      header?.classList.add('sticky');
    } else {
      header?.classList.remove('sticky');
    }
  });

  // Add active class to nav links on scroll
  const sections = document.querySelectorAll('section');

  window.addEventListener('scroll', () => {
    let current = '';

    for (const section of sections) {
      const sectionTop = section.offsetTop;

      if (window.scrollY >= sectionTop - 200) {
        current = section.getAttribute('id') || '';
      }
    }

    for (const link of navLinks) {
      link.classList.remove('active');
      const href = link.getAttribute('href');
      if (href && href.substring(1) === current) {
        link.classList.add('active');
      }
    }
  });

  // Contact form submission
  const contactForm = document.getElementById('contactForm') as HTMLFormElement;

  if (contactForm) {
    contactForm.addEventListener('submit', async (e: Event) => {
      e.preventDefault();

      // Get form data
      const formData = new FormData(contactForm);
      const formDataObj = Object.fromEntries(formData.entries());

      try {
        // Submit form data to API
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formDataObj),
        });

        const data = await response.json();

        // Create alert div
        const alertDiv = document.createElement('div');
        alertDiv.className = response.ok ? 'alert success' : 'alert error';
        alertDiv.textContent = data.message;

        // Add alert before the form
        contactForm.parentNode?.insertBefore(alertDiv, contactForm);

        // Reset form if successful
        if (response.ok) {
          contactForm.reset();

          // Remove alert after 5 seconds
          setTimeout(() => {
            alertDiv.remove();
          }, 5000);
        }
      } catch (error) {
        console.error('Error submitting form:', error);

        // Create error alert
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert error';
        alertDiv.textContent = 'Une erreur est survenue lors de l\'envoi du formulaire. Veuillez réessayer.';

        // Add alert before the form
        contactForm.parentNode?.insertBefore(alertDiv, contactForm);
      }
    });
  }

  // Add alert styles
  const style = document.createElement('style');
  style.textContent = `
    .alert {
      padding: 15px;
      margin-bottom: 20px;
      border-radius: 5px;
      font-weight: 500;
    }
    .alert.success {
      background-color: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }
    .alert.error {
      background-color: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }
  `;
  document.head.appendChild(style);
});
