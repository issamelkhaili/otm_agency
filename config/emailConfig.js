const nodemailer = require('nodemailer');
require('dotenv').config();

// Email configuration
const emailConfig = {
    host: process.env.EMAIL_HOST || 'ssl0.ovh.net',
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
};

// Create transporter
const transporter = nodemailer.createTransport(emailConfig);

// Verify transporter configuration
transporter.verify(function(error, success) {
    if (error) {
        console.error('Email configuration error:', error);
    } else {
        console.log('Email server is ready to send messages');
    }
});

module.exports = {
    transporter,
    emailConfig
}; 