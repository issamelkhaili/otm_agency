const express = require('express');
const router = express.Router();
const { verifyAdmin, generateToken } = require('../services/adminService');

// Admin login route
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

    const token = generateToken(username);
    res.json({
      success: true,
      token,
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Protected route example
router.get('/dashboard', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to admin dashboard'
  });
});

module.exports = router; 