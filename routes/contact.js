// routes/contact.js
const express = require('express');
const router = express.Router();
const { addContact } = require('../services/contactService');
const { sendContactNotification, sendContactAutoResponse } = require('../services/emailService');

// Contact form submission endpoint
router.post('/', async (req, res) => {
  try {
    console.log('Contact form submission received:', req.body);
    
    const { name, email, message, subject } = req.body;
    
    // Validate required fields
    if (!name || !email || !message) {
      console.log('Missing required fields in contact form submission');
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and message'
      });
    }
    
    // Log the contact data before processing
    console.log('Processing contact form submission:', { name, email, subject });
    
    // Add contact to database
    const newContact = await addContact({
      name,
      email,
      message,
      subject: subject || 'Contact Form Submission'
    });
    
    console.log('Contact added to database, sending notifications...');
    
    // Manually send email notifications (in case they failed in addContact)
    try {
      await sendContactNotification(newContact);
      console.log('Admin notification email sent successfully');
      
      await sendContactAutoResponse(newContact);
      console.log('Auto-response to user sent successfully');
    } catch (emailError) {
      console.error('Error sending notification emails:', emailError);
      // Don't fail the request just because emails failed
    }
    
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