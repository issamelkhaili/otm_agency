// routes/contact.js
const express = require('express');
const router = express.Router();
const { addContact } = require('../services/contactService');
const { sendContactNotification, sendContactAutoResponse } = require('../services/emailService');

// Contact form submission endpoint
router.post('/', async (req, res) => {
  try {
    const { name, email, message, subject } = req.body;
    
    // Validate required fields
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and message'
      });
    }
    
    // Add contact to database
    const newContact = await addContact({
      name,
      email,
      message,
      subject: subject || 'Contact Form Submission'
    });
    
    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      contact: {
        id: newContact.id,
        name: newContact.name,
        email: newContact.email,
        createdAt: newContact.createdAt
      }
    });
  } catch (error) {
    console.error('Error submitting contact form:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting contact form. Please try again later.'
    });
  }
});

module.exports = router;