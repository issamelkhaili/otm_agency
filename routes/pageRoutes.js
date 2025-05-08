const express = require('express');
const router = express.Router();
const path = require('path');

// Admin login page route (hidden from normal navigation)
router.get('/adminlogin', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/adminlogin.html'));
});

module.exports = router; 