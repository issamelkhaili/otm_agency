// services/emailService.js
const nodemailer = require('nodemailer');
require('dotenv').config();

// Initialize email configuration with fallbacks and validation
const EMAIL_HOST = process.env.EMAIL_HOST || 'ssl0.ovh.net';
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || '587', 10);
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || EMAIL_USER;

// Validate required configuration
if (!EMAIL_USER || !EMAIL_PASSWORD) {
  console.error('EMAIL_USER and EMAIL_PASSWORD environment variables must be set');
  // Don't throw error here to allow the app to start, but log this prominently
}

const transporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASSWORD
  }
});

// Validate transporter configuration on startup
async function validateEmailConfig() {
  if (!EMAIL_USER || !EMAIL_PASSWORD) return false;
  
  try {
    await transporter.verify();
    console.log('Email service is ready');
    return true;
  } catch (error) {
    console.error('Email configuration error:', error);
    return false;
  }
}

function generateMessageId() {
  return `<${Date.now()}.${Math.random().toString(36).substring(2)}@otmeducation.com>`;
}

// Test email configuration
async function testEmailConfig() {
  try {
    if (!EMAIL_USER || !EMAIL_PASSWORD) {
      console.error('Cannot send test email: EMAIL_USER and EMAIL_PASSWORD must be set');
      return false;
    }

    const info = await transporter.sendMail({
      from: `"OTM Education" <${EMAIL_USER}>`,
      to: ADMIN_EMAIL,
      subject: 'Test Email - OTM Education',
      text: 'This is a test email to verify the SMTP configuration.',
      html: '<p>This is a test email to verify the SMTP configuration.</p>'
    });
    
    console.log('Test email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('Test email failed:', error);
    return false;
  }
}

// Function to send an email with better error handling
async function sendEmail(to, subject, text, html, options = {}) {
  if (!EMAIL_USER || !EMAIL_PASSWORD) {
    console.error('Cannot send email: EMAIL_USER and EMAIL_PASSWORD must be set');
    throw new Error('Email service not configured');
  }

  const messageId = options.messageId || generateMessageId();
  const inReplyTo = options.inReplyTo || null;
  const references = options.references || null;

  const mailOptions = {
    from: `"OTM Education" <${EMAIL_USER}>`,
    to,
    subject,
    text,
    html,
    messageId
  };

  // Add optional email headers if provided
  if (inReplyTo) mailOptions.inReplyTo = inReplyTo;
  if (references) mailOptions.references = references;

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

// Send a notification when a new contact form is submitted
async function sendContactNotification(contact) {
  const subject = 'New Contact Form Submission';
  const text = `
    New contact form submission received:
    
    Name: ${contact.name}
    Email: ${contact.email}
    Message: ${contact.message}
    
    Timestamp: ${contact.createdAt}
  `;
  const html = `
    <h2>New Contact Form Submission</h2>
    <p><strong>Name:</strong> ${contact.name}</p>
    <p><strong>Email:</strong> ${contact.email}</p>
    <p><strong>Message:</strong> ${contact.message}</p>
    <p><strong>Timestamp:</strong> ${contact.createdAt}</p>
  `;

  return sendEmail(ADMIN_EMAIL, subject, text, html, { 
    messageId: contact.messageId || generateMessageId() 
  });
}

// Send an auto-response to the user
async function sendContactAutoResponse(contact) {
  const messageId = generateMessageId();
  const subject = 'Thank you for contacting OTM Education';
  const text = `
    Dear ${contact.name},
    
    Thank you for contacting OTM Education. We have received your message and will get back to you as soon as possible.
    
    Your message:
    ${contact.message}
    
    Best regards,
    OTM Education Team
  `;
  const html = `
    <h2>Thank you for contacting OTM Education</h2>
    <p>Dear ${contact.name},</p>
    <p>Thank you for contacting OTM Education. We have received your message and will get back to you as soon as possible.</p>
    <p><strong>Your message:</strong><br>${contact.message}</p>
    <p>Best regards,<br>OTM Education Team</p>
  `;

  // Store the message ID so we can track responses
  if (contact.messageId) {
    return sendEmail(contact.email, subject, text, html, {
      messageId,
      references: contact.messageId
    });
  } else {
    return sendEmail(contact.email, subject, text, html, { messageId });
  }
}

// Send a response to a contact
async function sendContactResponse(contact, response) {
  const messageId = generateMessageId();
  const subject = `Re: ${contact.subject || 'Your message to OTM Education'}`;
  const text = `
    Dear ${contact.name},
    
    ${response}
    
    Best regards,
    OTM Education Team
  `;
  const html = `
    <h2>Re: Your message to OTM Education</h2>
    <p>Dear ${contact.name},</p>
    <p>${response}</p>
    <p>Best regards,<br>OTM Education Team</p>
  `;

  // If we have the original message ID, add it to references
  const options = { messageId };
  if (contact.messageId) {
    options.inReplyTo = contact.messageId;
    options.references = contact.messageId;
  }

  return sendEmail(contact.email, subject, text, html, options);
}

// Initialize the email service when the module is loaded
validateEmailConfig().then(isValid => {
  if (!isValid) {
    console.warn('⚠️ Email service is not properly configured. Email functionality will be disabled.');
  }
});

module.exports = {
  sendEmail,
  sendContactNotification,
  sendContactAutoResponse,
  sendContactResponse,
  testEmailConfig,
  validateEmailConfig
};