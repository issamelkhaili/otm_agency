const express = require('express');
const router = express.Router();
const { addContact } = require('../services/contactService');

// Handle contact form submission
router.post('/', async (req, res) => {
    try {
        const { name, email, phone, message } = req.body;

        // Basic validation
        if (!name || !email || !message) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, and message are required'
            });
        }

        // Add contact to the system
        await addContact({ name, email, phone, message });

        res.json({
            success: true,
            message: 'Message sent successfully'
        });
    } catch (error) {
        console.error('Error processing contact form:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process your message'
        });
    }
});

module.exports = router; 