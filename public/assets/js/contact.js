document.addEventListener('DOMContentLoaded', function() {
    const contactForm = document.getElementById('contact-form');
    
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Get form data
            const formData = {
                name: `${document.getElementById('nom').value} ${document.getElementById('prenom').value}`,
                email: document.getElementById('email').value,
                phone: document.getElementById('telephone').value,
                message: `Subject: ${document.getElementById('sujet').value}\n\n${document.getElementById('message').value}`
            };

            try {
                const response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });

                if (response.ok) {
                    // Show success message
                    const successMessage = document.createElement('div');
                    successMessage.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50';
                    successMessage.innerHTML = `
                        <div class="bg-white p-8 rounded-lg shadow-lg max-w-md w-full mx-4">
                            <div class="text-center">
                                <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                                    <i class="fas fa-check text-green-600 text-xl"></i>
                                </div>
                                <h3 class="text-lg font-medium text-gray-900 mb-2">Message Envoyé!</h3>
                                <p class="text-sm text-gray-500 mb-4">
                                    Merci de nous avoir contacté. Nous vous répondrons dans les plus brefs délais.
                                </p>
                                <button onclick="this.closest('.fixed').remove()" 
                                    class="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 transition duration-300">
                                    Retour à l'accueil
                                </button>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(successMessage);
                    
                    // Reset form
                    contactForm.reset();
                } else {
                    throw new Error('Failed to send message');
                }
            } catch (error) {
                console.error('Error sending message:', error);
                alert('Une erreur est survenue lors de l\'envoi du message. Veuillez réessayer.');
            }
        });
    }
}); 