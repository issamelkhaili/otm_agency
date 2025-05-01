// OTM Agency - Server
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '/')));

// Store contacts in a JSON file
const contactsFile = path.join(__dirname, 'data', 'contacts.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// Initialize contacts file if it doesn't exist
if (!fs.existsSync(contactsFile)) {
  fs.writeFileSync(contactsFile, JSON.stringify([], null, 2));
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint to handle contact form submissions
app.post('/api/contact', (req, res) => {
  try {
    const { name, email, phone, service, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez remplir tous les champs obligatoires'
      });
    }

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

    // Read existing contacts
    const contacts = JSON.parse(fs.readFileSync(contactsFile));

    // Add new contact
    contacts.push(newContact);

    // Save back to file
    fs.writeFileSync(contactsFile, JSON.stringify(contacts, null, 2));

    return res.status(200).json({
      success: true,
      message: 'Votre message a été envoyé avec succès. Nous vous contacterons bientôt!',
      contact: newContact
    });
  } catch (error) {
    console.error('Error saving contact:', error);
    return res.status(500).json({
      success: false,
      message: 'Une erreur est survenue lors de l\'envoi du message. Veuillez réessayer.'
    });
  }
});

// API endpoint to get services
app.get('/api/services', (req, res) => {
  const services = [
    {
      id: 'orientation',
      title: 'Orientation et Sélection de Cursus',
      description: 'Analyse de vos aspirations académiques, recherche personnalisée d\'établissements, et conseils sur les parcours adaptés à votre profil.',
      icon: 'fa-graduation-cap'
    },
    {
      id: 'admission',
      title: 'Préparation du Dossier d\'Admission',
      description: 'Assistance avec votre compte Campus France, rédaction de lettres de motivation, et préparation des documents requis pour votre candidature.',
      icon: 'fa-file-alt'
    },
    {
      id: 'tests',
      title: 'Préparation aux Tests et Entretiens',
      description: 'Coaching pour les tests de langue (DELF/DALF/TCF), simulations d\'entretiens d\'admission, et techniques de gestion du stress.',
      icon: 'fa-comments'
    },
    {
      id: 'visa',
      title: 'Préparation du Dossier Visa',
      description: 'Assistance pour la plateforme consulaire, constitution des documents justificatifs, et préparation pour l\'entretien visa.',
      icon: 'fa-passport'
    },
    {
      id: 'logement',
      title: 'Recherche de Logement',
      description: 'Aide à la recherche d\'appartements ou de chambres, conseils sur les quartiers universitaires, et assistance pour les contrats de location.',
      icon: 'fa-building'
    },
    {
      id: 'juridique',
      title: 'Assistance Juridique',
      description: 'Accompagnement pour les procédures administratives, renouvellement de titres de séjour, et contentieux juridiques par nos avocats spécialisés.',
      icon: 'fa-gavel'
    }
  ];

  res.json(services);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
