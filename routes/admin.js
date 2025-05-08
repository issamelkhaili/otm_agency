// routes/admin.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs').promises;
const path = require('path');
const { JWT_SECRET } = require('../config/config');
const { getContacts, updateContactStatus, diagnoseContacts, mergeChatsWithSameEmail } = require('../services/contactService');
const { testEmailConfig, sendContactResponse } = require('../services/emailService');
const { fetchEmails, startEmailFetching, stopEmailFetching } = require('../services/emailFetchService');

const ADMIN_FILE = path.join(__dirname, '../data/admin.json');

// Helper functions
const readAdminData = async () => {
  try {
    const data = await fs.readFile(ADMIN_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading admin data:', error);
    return null;
  }
};

const verifyAdmin = async (username, password) => {
  const data = await readAdminData();
  if (!data || !data.admin) return false;

  const isMatch = await bcrypt.compare(password, data.admin.password);
  if (!isMatch) return false;

  // Update last login
  data.admin.lastLogin = new Date().toISOString();
  await fs.writeFile(ADMIN_FILE, JSON.stringify(data, null, 2));

  return true;
};

// Authentication middleware - supports both header and cookie token
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
    
    // Update contact status and add admin response to chat history
    const updatedContact = await updateContactStatus(id, status, response);
    
    // If response is provided, send email response
    if (response && response.trim() !== '') {
      try {
        await sendContactResponse(contact, response);
        console.log(`Email response sent to ${contact.email}`);
      } catch (emailError) {
        console.error('Failed to send email response:', emailError);
        // Don't fail the whole request if just the email fails
        return res.json({ 
          success: true, 
          contact: updatedContact,
          message: 'Status updated but email failed to send',
          emailError: emailError.message
        });
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
    console.log('Manual email fetch initiated');
    fetchEmails();
    
    // Set a delay to allow fetching to complete before refreshing the UI
    setTimeout(async () => {
      try {
        const contacts = await getContacts();
        
        res.json({
          success: true,
          message: 'Email fetching initiated',
          contacts // Return the latest contacts to update the UI immediately
        });
      } catch (err) {
        console.error('Error fetching contacts after email fetch:', err);
        res.json({
          success: true,
          message: 'Email fetching initiated, but failed to fetch updated contacts'
        });
      }
    }, 3000); // 3 second delay to allow some emails to be processed
  } catch (error) {
    console.error('Error fetching emails:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching emails',
      error: error.message
    });
  }
});

// Restart email fetching service
router.post('/restart-email-service', authenticateToken, async (req, res) => {
  try {
    // Stop existing service if running
    stopEmailFetching();
    
    // Start the service again
    const interval = req.body.interval || 1; // Default to 1 minute
    const result = startEmailFetching(interval);
    
    res.json({
      success: true,
      message: `Email fetching service restarted with interval: ${interval} minute(s)`,
      result
    });
  } catch (error) {
    console.error('Error restarting email service:', error);
    res.status(500).json({
      success: false,
      message: 'Error restarting email service',
      error: error.message
    });
  }
});

// Diagnostic route for checking contacts
router.get('/diagnose', authenticateToken, async (req, res) => {
  try {
    const result = await diagnoseContacts();
    
    res.json({
      success: true,
      message: 'Diagnostic check complete',
      result
    });
  } catch (error) {
    console.error('Error running diagnostics:', error);
    res.status(500).json({
      success: false,
      message: 'Error running diagnostics',
      error: error.message
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
      message: 'Error testing email configuration',
      error: error.message
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

// Merge chats with the same email address
router.post('/merge-chats', authenticateToken, async (req, res) => {
  try {
    const result = await mergeChatsWithSameEmail();
    
    if (result.success) {
      // Return the updated contacts list
      const contacts = await getContacts();
      
      res.json({
        success: true,
        message: result.message,
        contacts
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Error merging chats:', error);
    res.status(500).json({
      success: false,
      message: 'Error merging chats: ' + error.message
    });
  }
});

// Delete a contact/conversation
router.delete('/contacts/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get contacts to find the current one
    const contacts = await getContacts();
    const contactIndex = contacts.findIndex(c => c.id === id);
    
    if (contactIndex === -1) {
      return res.status(404).json({
        success: false, 
        message: 'Contact not found'
      });
    }
    
    // Remove the contact from the array
    contacts.splice(contactIndex, 1);
    
    // Save the updated contacts
    const contactsFile = path.join(__dirname, '../data/contacts.json');
    await fs.writeFile(contactsFile, JSON.stringify(contacts, null, 2));
    
    res.json({ 
      success: true, 
      message: 'Contact deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting contact: ' + error.message
    });
  }
});

// Delete all messages from a conversation (keeping the initial message)
router.delete('/contacts/:id/messages', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get contacts to find the current one
    const contacts = await getContacts();
    const contactIndex = contacts.findIndex(c => c.id === id);
    
    if (contactIndex === -1) {
      return res.status(404).json({
        success: false, 
        message: 'Contact not found'
      });
    }
    
    // Clear responses but keep the initial message
    contacts[contactIndex].responses = [];
    
    // Save the updated contacts
    const contactsFile = path.join(__dirname, '../data/contacts.json');
    await fs.writeFile(contactsFile, JSON.stringify(contacts, null, 2));
    
    res.json({ 
      success: true, 
      contact: contacts[contactIndex],
      message: 'Messages deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting messages:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting messages: ' + error.message
    });
  }
});

module.exports = router;