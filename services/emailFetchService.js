// services/emailFetchService.js
const Imap = require('node-imap');
const { simpleParser } = require('mailparser');
const { addEmailResponse } = require('./contactService');
require('dotenv').config();

let emailFetchingActive = false;
let fetchInterval = null;

// Configure IMAP with fallbacks and validation
const imapConfig = {
  user: process.env.EMAIL_USER,
  password: process.env.EMAIL_PASSWORD,
  host: process.env.EMAIL_HOST || 'ssl0.ovh.net',
  port: parseInt(process.env.EMAIL_IMAP_PORT || '993', 10),
  tls: true,
  tlsOptions: { rejectUnauthorized: false }
};

// Validate required configuration
if (!imapConfig.user || !imapConfig.password) {
  console.error('EMAIL_USER and EMAIL_PASSWORD environment variables must be set for email fetching');
}

function extractEmailAddress(email) {
  if (!email) return null;
  
  // Handle different email formats
  if (typeof email === 'object' && email.text) {
    email = email.text;
  }
  
  const match = String(email).match(/<(.+)>/);
  return match ? match[1] : String(email);
}

function extractOriginalMessageId(references) {
  if (!references) return null;
  
  // If references is an array, convert to string
  if (Array.isArray(references)) {
    references = references.join(' ');
  }
  
  // Parse references string to extract message IDs
  const refs = String(references).split(/\s+/);
  return refs.length > 0 ? refs[refs.length - 1] : null;
}

async function processEmail(mail) {
  try {
    const parsed = await simpleParser(mail);
    
    // Extract email data
    const from = extractEmailAddress(parsed.from);
    const subject = parsed.subject || 'No Subject';
    const content = parsed.text || parsed.html || 'No Content';
    const messageId = parsed.messageId;
    const references = parsed.references || parsed.inReplyTo;
    const originalMessageId = extractOriginalMessageId(references);
    const date = parsed.date || new Date();

    console.log(`Processing email "${subject}" from ${from}`);
    
    if (!from) {
      console.error('Email missing sender address, skipping');
      return;
    }

    // Add the email response to the contact system
    await addEmailResponse({
      from,
      subject,
      content,
      messageId,
      originalMessageId,
      timestamp: date.toISOString()
    });

    console.log(`Successfully processed email from ${from}`);
  } catch (error) {
    console.error('Error processing email:', error);
  }
}

function fetchEmails() {
  if (!imapConfig.user || !imapConfig.password) {
    console.error('Cannot fetch emails: EMAIL_USER and EMAIL_PASSWORD must be set');
    return;
  }

  const imap = new Imap(imapConfig);

  imap.once('ready', () => {
    console.log('Connected to IMAP server');
    
    imap.openBox('INBOX', false, (err, box) => {
      if (err) {
        console.error('Error opening inbox:', err);
        imap.end();
        return;
      }

      // Search for unread emails
      imap.search(['UNSEEN'], (err, results) => {
        if (err) {
          console.error('Error searching emails:', err);
          imap.end();
          return;
        }

        if (results.length === 0) {
          console.log('No new emails found');
          imap.end();
          return;
        }

        console.log(`Found ${results.length} new emails`);
        const fetch = imap.fetch(results, { bodies: '', markSeen: true });
        
        fetch.on('message', (msg, seqno) => {
          console.log(`Processing message #${seqno}`);
          
          msg.on('body', (stream) => {
            let buffer = '';
            stream.on('data', (chunk) => {
              buffer += chunk.toString('utf8');
            });
            
            stream.once('end', () => {
              processEmail(buffer);
            });
          });
          
          msg.once('attributes', (attrs) => {
            console.log(`Message attributes:`, attrs.uid);
          });
        });

        fetch.once('error', (err) => {
          console.error('Error fetching emails:', err);
        });

        fetch.once('end', () => {
          console.log('Done fetching emails');
          imap.end();
        });
      });
    });
  });

  imap.once('error', (err) => {
    console.error('IMAP connection error:', err);
  });

  imap.once('end', () => {
    console.log('IMAP connection ended');
  });

  imap.connect();
}

function startEmailFetching(interval = 5) {
  if (emailFetchingActive) {
    console.log('Email fetching already active');
    return;
  }
  
  // Validate configuration
  if (!imapConfig.user || !imapConfig.password) {
    console.error('Cannot start email fetching: EMAIL_USER and EMAIL_PASSWORD must be set');
    return;
  }
  
  console.log(`Starting email fetching service (interval: ${interval} minutes)`);
  emailFetchingActive = true;
  
  // Fetch emails immediately
  fetchEmails();
  
  // Then set up interval
  const intervalMs = interval * 60 * 1000;
  fetchInterval = setInterval(fetchEmails, intervalMs);
  
  return true;
}

function stopEmailFetching() {
  if (!emailFetchingActive) return false;
  
  if (fetchInterval) {
    clearInterval(fetchInterval);
    fetchInterval = null;
  }
  
  emailFetchingActive = false;
  console.log('Email fetching service stopped');
  return true;
}

module.exports = {
  startEmailFetching,
  stopEmailFetching,
  fetchEmails // Export for manual fetching
};