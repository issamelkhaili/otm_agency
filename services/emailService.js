const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'ssl0.ovh.net',
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

function generateMessageId() {
    return `<${Date.now()}.${Math.random().toString(36).substring(2)}@otmeducation.com>`;
}

// Test email configuration
async function testEmailConfig() {
  try {
    const info = await transporter.sendMail({
      from: `"OTM Education" <${process.env.EMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL,
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

// Function to send an email
async function sendEmail(to, subject, text, html, messageId = null) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject,
        text,
        html,
        messageId: messageId || generateMessageId()
    };

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

    return sendEmail(process.env.ADMIN_EMAIL, subject, text, html, contact.messageId);
}

// Send an auto-response to the user
async function sendContactAutoResponse(contact) {
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

    return sendEmail(contact.email, subject, text, html);
}

// Send a response to a contact
async function sendContactResponse(contact, response) {
    const subject = 'Re: Your message to OTM Education';
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

    return sendEmail(contact.email, subject, text, html);
}

module.exports = {
    sendEmail,
    sendContactNotification,
    sendContactAutoResponse,
    sendContactResponse,
    testEmailConfig
}; 