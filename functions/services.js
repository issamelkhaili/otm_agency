// Netlify function to provide services data
exports.handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method not allowed' })
    };
  }

  try {
    // Return the services data
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

    return {
      statusCode: 200,
      body: JSON.stringify(services)
    };
  } catch (error) {
    console.error('Error retrieving services:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: 'Une erreur est survenue lors de la récupération des services.'
      })
    };
  }
};
