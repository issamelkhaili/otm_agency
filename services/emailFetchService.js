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
  if (typeof email === 'object') {
    if (email.text) {
      email = email.text;
    } else if (email.value && email.value.length > 0 && email.value[0].address) {
      email = email.value[0].address;
    }
  }
  
  const match = String(email).match(/<(.+)>/);
  return (match ? match[1] : String(email)).trim().toLowerCase();
}

function extractOriginalMessageId(references, inReplyTo) {
  // First check inReplyTo which is more likely to be the direct parent
  if (inReplyTo) {
    return Array.isArray(inReplyTo) ? inReplyTo[0] : String(inReplyTo);
  }
  
  // Then check references
  if (!references) return null;
  
  // If references is an array, convert to string
  if (Array.isArray(references)) {
    references = references.join(' ');
  }
  
  // Parse references string to extract message IDs
  const refs = String(references).split(/\s+/);
  return refs.length > 0 ? refs[0] : null; // First reference is usually the original message
}

/**
 * Parses a Gmail-style reply email to extract just the new content
 */
function parseEmailReply(emailContent) {
  if (!emailContent) return emailContent;

  // Step 1: Split by the common Gmail reply markers
  const markers = [
    /On [A-Za-z]{3}, [A-Za-z]{3} \d+, \d{4}(,| at) \d+:\d+ (AM|PM)/i, // "On Thu, May 8, 2025 at 8:46 AM"
    /On [A-Za-z]{3}, [A-Za-z]{3} \d+, \d{4}, \d+:\d+ (AM|PM)/i,        // "On Thu, May 8, 2025, 8:46 AM"
    /On \d{4}-\d{2}-\d{2} \d+:\d+/i,                                   // "On 2025-05-08 8:46"
    /On \d{1,2}\/\d{1,2}\/\d{2,4} \d+:\d+/i,                           // "On 5/8/25 8:46"
    /On \d{1,2}\/\d{1,2}\/\d{2,4}, .* wrote:/i,                        // "On 5/8/25, OTM wrote:"
    /On .* wrote:/i,                                                   // "On Thursday, OTM wrote:"
    /^>.*/m                                                            // Standard email quote character
  ];

  // Try each marker pattern to find the original message
  for (const marker of markers) {
    const parts = emailContent.split(marker);
    if (parts.length > 1) {
      // Return just the part before the marker, trimmed
      return parts[0].trim();
    }
  }

  // If no markers found, try line-by-line analysis
  const lines = emailContent.split('\n');
  const newLines = [];
  let quoteStarted = false;

  for (const line of lines) {
    // Check for quote indicators
    if (line.trim().startsWith('>') || line.includes('wrote:') || line.includes(' wrote:')) {
      quoteStarted = true;
      continue;
    }

    // If we haven't hit a quote section yet, include the line
    if (!quoteStarted) {
      newLines.push(line);
    }
  }

  // If we found quoted content, return just the new content
  if (quoteStarted && newLines.length > 0) {
    return newLines.join('\n').trim();
  }

  // Last resort: return the original content
  return emailContent.trim();
}

async function processEmail(mail) {
  try {
    const parsed = await simpleParser(mail);
    
    // Log full headers for debugging
    console.log('Email headers:', JSON.stringify({
      messageId: parsed.messageId,
      references: parsed.references,
      inReplyTo: parsed.inReplyTo,
      subject: parsed.subject
    }));
    
    // Extract email data
    const from = extractEmailAddress(parsed.from);
    const subject = parsed.subject || 'No Subject';
    
    // IMPORTANT: We previously prioritized HTML over text, which causes issues
    // Let's use both formats but process HTML properly
    let content = '';
    let rawHtml = null;
    
    if (parsed.html) {
      // Store raw HTML for advanced display
      rawHtml = parsed.html;
      
      // Also create a simplified text version for backup
      // Simple HTML stripping - basic version
      content = parsed.html
        .replace(/<div>(.*?)<\/div>/gi, '$1\n')
        .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>?/gm, '');
      
      // Clean up excessive whitespace
      content = content
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();
      
      console.log(`HTML content detected, created plaintext version (length: ${content.length})`);
    } else if (parsed.text) {
      content = parsed.text;
    } else {
      content = 'No Content';
    }

    // Parse the content to extract just the user's new message (if it's a reply)
    if (parsed.inReplyTo || parsed.references) {
      console.log("Detected reply email, parsing to extract just the user's new message");
      const parsedContent = parseEmailReply(content);
      console.log(`Original content length: ${content.length}, Parsed content length: ${parsedContent.length}`);
      content = parsedContent;
    }
    
    const messageId = parsed.messageId;
    const originalMessageId = extractOriginalMessageId(parsed.references, parsed.inReplyTo);
    const date = parsed.date || new Date();

    console.log(`Processing email "${subject}" from ${from}`);
    console.log(`Message ID: ${messageId}, Original Message ID: ${originalMessageId}`);
    
    if (!from) {
      console.error('Email missing sender address, skipping');
      return;
    }

    // Check if this is our own message (sent by the system)
    if (from === imapConfig.user.toLowerCase()) {
      console.log('Skipping our own outgoing message');
      return;
    }

    // Add the email response to the contact system
    const result = await addEmailResponse({
      from,
      subject,
      content,
      rawHtml, // Add raw HTML for better display
      messageId,
      originalMessageId,
      timestamp: date.toISOString()
    });

    if (result) {
      console.log(`Successfully processed email from ${from} and added to contact ID: ${result.contactId}`);
    } else {
      console.log(`Created new contact from email from ${from}`);
    }
  } catch (error) {
    console.error('Error processing email:', error);
  }
}

function fetchEmails() {
  if (!imapConfig.user || !imapConfig.password) {
    console.error('Cannot fetch emails: EMAIL_USER and EMAIL_PASSWORD must be set');
    return;
  }

  console.log('Starting email fetch operation...');
  const imap = new Imap(imapConfig);

  imap.once('ready', () => {
    console.log('Connected to IMAP server');
    
    imap.openBox('INBOX', false, (err, box) => {
      if (err) {
        console.error('Error opening inbox:', err);
        imap.end();
        return;
      }

      console.log('INBOX opened successfully');
      
      // Search for ALL unseen messages to make sure we get everything
      const searchCriteria = ['UNSEEN'];
      
      imap.search(searchCriteria, (err, results) => {
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
        const fetch = imap.fetch(results, { 
          bodies: '',
          markSeen: true // Mark as seen after fetching
        });
        
        fetch.on('message', (msg, seqno) => {
          console.log(`Processing message #${seqno}`);
          
          msg.on('body', (stream) => {
            let buffer = '';
            stream.on('data', (chunk) => {
              buffer += chunk.toString('utf8');
            });
            
            stream.once('end', () => {
              console.log(`Message #${seqno} body received, processing...`);
              processEmail(buffer);
            });
          });
          
          msg.once('attributes', (attrs) => {
            console.log(`Message #${seqno} attributes:`, attrs.uid);
          });
          
          msg.once('end', () => {
            console.log(`Message #${seqno} processing complete`);
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

  // Connect with error handling
  try {
    imap.connect();
  } catch (err) {
    console.error('Error connecting to IMAP server:', err);
  }
}

function startEmailFetching(interval = 1) { // Check every minute for faster response
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