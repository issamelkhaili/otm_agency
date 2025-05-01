// Netlify function to handle contact form submissions
exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method not allowed' })
    };
  }

  try {
    // Parse the request body
    const data = JSON.parse(event.body);
    const { name, email, phone, service, message } = data;

    // Validate required fields
    if (!name || !email || !message) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: 'Veuillez remplir tous les champs obligatoires'
        })
      };
    }

    // In a real-world scenario, you'd store the contact information in a database
    // or send an email. For this example, we'll just return a success response.

    // Create contact object with timestamp
    const newContact = {
      id: Date.now().toString(),
      name,
      email,
      phone: phone || 'Non spécifié',
      service: service || 'Non spécifié',
      message,
      timestamp: new Date().toISOString()
    };

    // Log the contact (would be saved to database in production)
    console.log('New contact:', newContact);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Votre message a été envoyé avec succès. Nous vous contacterons bientôt!',
        contact: newContact
      })
    };
  } catch (error) {
    console.error('Error processing contact form:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: 'Une erreur est survenue lors de l\'envoi du message. Veuillez réessayer.'
      })
    };
  }
};
