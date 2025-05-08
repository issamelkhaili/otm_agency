// routes/admin.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/config');
const { verifyAdmin } = require('../services/adminService');
const { getContacts, updateContactStatus } = require('../services/contactService');
const { testEmailConfig, sendContactResponse } = require('../services/emailService');
const { fetchEmails } = require('../services/emailFetchService');

// Authentication middleware
const authenticateToken = (req, res, next) => {
    // Check for token in Authorization header or in cookies
    const authHeader = req.headers['authorization'];
    const tokenFromHeader = authHeader && authHeader.split(' ')[1];
    const tokenFromCookie = req.cookies && req.cookies.token;
    const token = tokenFromHeader || tokenFromCookie;

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
                message: 'Invalid or expired token'
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
        
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide username and password'
            });
        }
        
        const isValid = await verifyAdmin(username, password);

        if (!isValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Create session token
        const token = jwt.sign(
            { username, role: 'admin' },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Set token in cookie and return in response
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        res.json({
            success: true,
            token,
            message: 'Login successful',
            user: { username }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Check authentication status
router.get('/check-auth', authenticateToken, (req, res) => {
    res.json({
        success: true,
        authenticated: true,
        user: { username: req.user.username }
    });
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
        res.json({
            success: true,
            contacts
        });
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

        res.json({
            success: true,
            contact
        });
    } catch (error) {
        console.error('Error getting contact:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching contact'
        });
    }
});

// Update contact status and optionally send a response
router.post('/contacts/:id/status', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, response } = req.body;
        
        // Get contacts to find the current one
        const contacts = await getContacts();
        const contact = contacts.find(c => c.id === id);
        
        if (!contact) {
            return res.status(404).json({
                success: false, 
                message: 'Contact not found'
            });
        }
        
        // Update contact status
        const updatedContact = await updateContactStatus(id, status, response);
        
        // If response is provided, send email response
        if (response && response.trim() !== '') {
            try {
                await sendContactResponse(contact, response);
                console.log(`Email response sent to ${contact.email}`);
            } catch (emailError) {
                console.error('Failed to send email response:', emailError);
                // Don't fail the whole request if just the email fails
            }
        }
        
        res.json({ 
            success: true, 
            contact: updatedContact,
            message: response ? 'Status updated and response sent' : 'Status updated' 
        });
    } catch (error) {
        console.error('Error updating contact:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating contact'
        });
    }
});

// Manually trigger email fetching
router.post('/fetch-emails', authenticateToken, async (req, res) => {
    try {
        // Trigger email fetching
        fetchEmails();
        res.json({
            success: true,
            message: 'Email fetching initiated'
        });
    } catch (error) {
        console.error('Error fetching emails:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching emails'
        });
    }
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

// Logout route
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ 
        success: true, 
        message: 'Logged out successfully' 
    });
});

// Admin dashboard route (serve HTML)
router.get('/dashboard', (req, res) => {
    res.render('dashboard');
});

module.exports = router;