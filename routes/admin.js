const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/config');
const { verifyAdmin } = require('../services/adminService');
const { getContacts, updateContactStatus } = require('../services/contactService');
const { testEmailConfig } = require('../services/emailService');

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'No token provided'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                message: 'Invalid token'
            });
        }
        req.user = user;
        next();
    });
};

// Login route
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const isValid = await verifyAdmin(username, password);

        if (!isValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Create session token
        const token = jwt.sign(
            { username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            message: 'Login successful'
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Get admin info
router.get('/me', authenticateToken, (req, res) => {
    res.json({
        success: true,
        data: {
            username: req.user.username
        }
    });
});

// Get all contacts
router.get('/contacts', authenticateToken, async (req, res) => {
    try {
        const contacts = await getContacts();
        res.json(contacts);
    } catch (error) {
        console.error('Error getting contacts:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching contacts'
        });
    }
});

// Get a single contact
router.get('/contacts/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const contacts = await getContacts();
        const contact = contacts.find(c => c.id === id);
        
        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }

        res.json(contact);
    } catch (error) {
        console.error('Error getting contact:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching contact'
        });
    }
});

// Update contact status
router.post('/contacts/:id/status', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, response } = req.body;
        
        const updatedContact = await updateContactStatus(id, status, response);
        res.json({ success: true, contact: updatedContact });
    } catch (error) {
        console.error('Error updating contact:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating contact'
        });
    }
});

// Logout route
router.post('/logout', authenticateToken, (req, res) => {
    res.json({ success: true, message: 'Logged out successfully' });
});

// Test email configuration
router.post('/test-email', authenticateToken, async (req, res) => {
    try {
        const success = await testEmailConfig();
        if (success) {
            res.json({
                success: true,
                message: 'Test email sent successfully'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to send test email'
            });
        }
    } catch (error) {
        console.error('Error testing email:', error);
        res.status(500).json({
            success: false,
            message: 'Error testing email configuration'
        });
    }
});

module.exports = router; 