// OTM Agency main JavaScript file

// Initialize AOS animation library
    AOS.init({
        duration: 800,
        once: false,
        offset: 100,  // Makes elements animate 100px earlier when scrolling down
        delay: 50,    // Small delay for smoother transitions
        mirror: true, // Enables animations when scrolling back up
        anchorPlacement: 'top-bottom' // Trigger animation when the top of the element hits the bottom of the viewport
});

// Hero Slider Functionality
document.addEventListener('DOMContentLoaded', function() {
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.slider-dot');
    const prevBtn = document.querySelector('.slider-arrow.prev');
    const nextBtn = document.querySelector('.slider-arrow.next');
    const progressBar = document.querySelector('.slider-progress');
    const sliderCurrentElement = document.querySelector('.slider-current');
    const sliderTotalElement = document.querySelector('.slider-total');
    let currentSlide = 0;
    let isAnimating = false;
    let slideInterval;
    let progressBarInterval;

    // Initialize the slider
    function initSlider() {
        // Show the first slide
        slides[0].classList.add('active');
        slides[0].style.opacity = '1';
        
        // Update the counter
        if (sliderTotalElement) {
            sliderTotalElement.textContent = slides.length;
        }
        
        if (sliderCurrentElement) {
            sliderCurrentElement.textContent = currentSlide + 1;
        }
        
        // Start progress bar
        if (progressBar) {
            progressBar.classList.add('active');
        }
        
        // Zoom in the active slide image
        const activeImage = slides[0].querySelector('.slide-image');
        if (activeImage) {
            activeImage.style.transform = 'scale(1.05)';
        }
        
        // Auto-advance slides every 6 seconds
        startSlideInterval();
        
        // Add event listeners
        dots.forEach(dot => {
            dot.addEventListener('click', handleDotClick);
        });
        
        prevBtn.addEventListener('click', () => {
            if (isAnimating) return;
            goToPrevSlide();
        });
        
        nextBtn.addEventListener('click', () => {
            if (isAnimating) return;
            goToNextSlide();
        });
        
        // Pause auto-advance on hover
        const slider = document.querySelector('.slider');
        slider.addEventListener('mouseenter', () => {
            clearInterval(slideInterval);
            if (progressBar) {
                progressBar.style.transitionDuration = '0s';
                progressBar.classList.remove('active');
            }
        });
        
        slider.addEventListener('mouseleave', () => {
            startSlideInterval();
            if (progressBar) {
                progressBar.style.transitionDuration = '6s';
                progressBar.classList.add('active');
            }
        });
        
        // Add keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                if (isAnimating) return;
                goToPrevSlide();
            } else if (e.key === 'ArrowRight') {
                if (isAnimating) return;
                goToNextSlide();
            }
        });
        
        // Add swipe gestures for mobile
        let touchStartX = 0;
        let touchEndX = 0;
        
        slider.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, false);
        
        slider.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, false);
        
        function handleSwipe() {
            if (isAnimating) return;
            
            if (touchEndX < touchStartX - 50) {
                // Swiped left, go to next slide
                goToNextSlide();
            } else if (touchEndX > touchStartX + 50) {
                // Swiped right, go to previous slide
                goToPrevSlide();
            }
        }
    }
    
    function startSlideInterval() {
        clearInterval(slideInterval);
        slideInterval = setInterval(() => {
            goToNextSlide();
        }, 6000);
        
        // Reset and start progress bar
        if (progressBar) {
            progressBar.style.width = '0';
            progressBar.style.transition = 'none';
            
            // Small delay to ensure CSS transition works
            setTimeout(() => {
                progressBar.style.transition = 'width 6s linear';
                progressBar.style.width = '100%';
            }, 50);
        }
    }
    
    function handleDotClick(e) {
        if (isAnimating) return;
        
        const index = parseInt(e.target.getAttribute('data-index'));
        if (index !== currentSlide) {
            goToSlide(index);
        }
    }
    
    function goToNextSlide() {
        const nextIndex = (currentSlide + 1) % slides.length;
        goToSlide(nextIndex);
    }
    
    function goToPrevSlide() {
        const prevIndex = (currentSlide - 1 + slides.length) % slides.length;
        goToSlide(prevIndex);
    }
    
    function goToSlide(index) {
        if (isAnimating) return;
        isAnimating = true;
        
        // Reset progress bar
        if (progressBar) {
            progressBar.style.width = '0';
            progressBar.style.transition = 'none';
        }
        
        // Update current slide indicator
        if (sliderCurrentElement) {
            sliderCurrentElement.textContent = index + 1;
        }
        
        // Update dots
        dots.forEach(dot => {
            dot.classList.remove('active');
            dot.style.width = '0.75rem'; // 3px in rem
            dot.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
        });
        
        dots[index].classList.add('active');
        dots[index].style.width = '2rem'; // 8px in rem
        dots[index].style.backgroundColor = 'rgba(255, 255, 255, 1)';
        
        // Reset transforms on the current slide's image
        const currentImage = slides[currentSlide].querySelector('.slide-image');
        if (currentImage) {
            currentImage.style.transition = 'transform 0.5s ease';
            currentImage.style.transform = 'scale(1)';
        }
        
        // Fade out current slide
        slides[currentSlide].style.opacity = '0';
        slides[currentSlide].classList.remove('active');
        
        // Wait for fade out to complete then fade in new slide
        setTimeout(() => {
            // Update current slide
            currentSlide = index;
            
            // Fade in new slide
            slides[currentSlide].style.opacity = '1';
            slides[currentSlide].classList.add('active');
            
            // Reset slide content visibility and prepare for animation
            const slideContent = slides[currentSlide].querySelectorAll('.slide-content > *');
            slideContent.forEach((element, i) => {
                element.style.opacity = '0';
                element.style.transform = 'translateY(20px)';
                
                // Stagger the animations
                setTimeout(() => {
                    element.style.opacity = '1';
                    element.style.transform = 'translateY(0)';
                }, 300 + (i * 200));
            });
            
            // Start the progress bar for the new slide
            if (progressBar) {
                setTimeout(() => {
                    progressBar.style.transition = 'width 6s linear';
                    progressBar.style.width = '100%';
                }, 50);
            }
            
            // Zoom in the new slide's image
            const newImage = slides[currentSlide].querySelector('.slide-image');
            if (newImage) {
                setTimeout(() => {
                    newImage.style.transition = 'transform 8s ease-out';
                    newImage.style.transform = 'scale(1.05)';
                }, 50);
            }
            
            isAnimating = false;
        }, 700);
    }
    
    // Initialize the slider
    if (slides.length > 0) {
        initSlider();
    }
    
    // Services functionality
    function initServiceFilters() {
        const categoryButtons = document.querySelectorAll('#services .category-btn');
        const serviceCards = document.querySelectorAll('.service-card');
        
        if (categoryButtons.length > 0) {
            // Set first button as active
            categoryButtons[0].classList.add('category-button-active');
            
            categoryButtons.forEach(button => {
                button.addEventListener('click', function(e) {
                    e.preventDefault();
                    
                    // Remove active class from all buttons
                    categoryButtons.forEach(btn => {
                        btn.classList.remove('category-button-active');
                    });
                    
                    // Add active class to clicked button
                    this.classList.add('category-button-active');
                    
                    // Get the category from the button's data attribute
                    const category = this.getAttribute('data-category');
                    
                    // Handle filtering
                    if (category === 'all') {
                        // Show all services with animation
                        serviceCards.forEach(card => {
                            card.style.display = 'block';
                            setTimeout(() => {
                                card.style.opacity = '1';
                                card.style.transform = 'translateY(0)';
                            }, 50);
                        });
                    } else {
                        // Show matching services and hide others with animation
                        serviceCards.forEach(card => {
                            const cardCategory = card.getAttribute('data-category');
                            
                            if (cardCategory === category) {
                                card.style.display = 'block';
                                setTimeout(() => {
                                    card.style.opacity = '1';
                                    card.style.transform = 'translateY(0)';
                                }, 50);
                            } else {
                                card.style.opacity = '0';
                                card.style.transform = 'translateY(20px)';
                                setTimeout(() => {
                                    card.style.display = 'none';
                                }, 300);
                            }
                        });
                    }
                });
            });
            
            // Enhance service card hover effects
            serviceCards.forEach(card => {
                // Fix opacity issues with hover elements
                const hoverElement = card.querySelector('a.mt-6');
                if (hoverElement) {
                    hoverElement.style.opacity = '0';
                    
                    card.addEventListener('mouseenter', function() {
                        hoverElement.style.opacity = '1';
                    });
                    
                    card.addEventListener('mouseleave', function() {
                        hoverElement.style.opacity = '0';
                    });
                }
                
                // Add pulsing effect to circle icon on hover
                const iconCircle = card.querySelector('.bg-gradient-to-r');
                if (iconCircle) {
                    card.addEventListener('mouseenter', function() {
                        iconCircle.classList.add('animate-pulse');
                    });
                    
                    card.addEventListener('mouseleave', function() {
                        iconCircle.classList.remove('animate-pulse');
                    });
                }
            });
        }
    }
    
    // Mobile menu functionality
    const menuToggle = document.getElementById('menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }
    
    // Back to top button functionality
    const backToTopButton = document.getElementById('back-to-top');
    
    if (backToTopButton) {
        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 300) {
                backToTopButton.classList.remove('opacity-0', 'invisible');
                backToTopButton.classList.add('opacity-100', 'visible');
            } else {
                backToTopButton.classList.remove('opacity-100', 'visible');
                backToTopButton.classList.add('opacity-0', 'invisible');
            }
        });
        
        backToTopButton.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
    
    // FAQ Accordion functionality
    const faqQuestions = document.querySelectorAll('.faq-question');
    
    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            const answer = question.nextElementSibling;
            const icon = question.querySelector('.faq-icon');
            
            // Toggle active state for the question
            question.classList.toggle('active');
            
            // Toggle rotation for icon
            if (question.classList.contains('active')) {
                icon.classList.remove('rotate-0');
                icon.classList.add('rotate-180');
                
                // Show the answer
                answer.style.maxHeight = answer.scrollHeight + "px";
                answer.style.opacity = 1;
            } else {
                icon.classList.remove('rotate-180');
                icon.classList.add('rotate-0');
                
                // Hide the answer
                answer.style.maxHeight = null;
                answer.style.opacity = 0;
            }
        });
    });
    
    // Initialize service filters
    initServiceFilters();
    
    // Smooth scrolling for navigation links
    const navLinks = document.querySelectorAll('a[href^="#"]');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // Only prevent default if the link actually points to an anchor
            if (this.getAttribute('href').startsWith('#') && this.getAttribute('href').length > 1) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
                const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                    // Add offset for fixed header
                    const headerOffset = 80;
                    const elementPosition = targetElement.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                    
                    window.scrollTo({
                        top: offsetPosition,
                    behavior: 'smooth'
                });
                
                // Close mobile menu if open
                if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
                    mobileMenu.classList.add('hidden');
                    }
                }
            }
        });
    });
});
