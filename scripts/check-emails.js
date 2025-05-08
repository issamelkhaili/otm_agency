require('dotenv').config();
const Imap = require('node-imap');
const { simpleParser } = require('mailparser');
const fs = require('fs');
const path = require('path');

// Configure IMAP with environment variables
const imapConfig = {
  user: process.env.EMAIL_USER,
  password: process.env.EMAIL_PASSWORD,
  host: process.env.EMAIL_HOST || 'ssl0.ovh.net',
  port: parseInt(process.env.EMAIL_IMAP_PORT || '993', 10),
  tls: true,
  tlsOptions: { rejectUnauthorized: false }
};

// Validate configuration
if (!imapConfig.user || !imapConfig.password) {
  console.error('ERROR: EMAIL_USER and EMAIL_PASSWORD environment variables must be set for email fetching');
  process.exit(1);
}

console.log(`Connecting to email server: ${imapConfig.host}:${imapConfig.port} as ${imapConfig.user}`);

// Log results to a file for analysis
const logFile = path.join(__dirname, '../data/email-debug.log');
const outputDir = path.join(__dirname, '../data/emails');

// Create directories if they don't exist
if (!fs.existsSync(path.dirname(logFile))) {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
}
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Setup logging functions
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message);
  fs.appendFileSync(logFile, logMessage);
}

// Extract email address from different formats
function extractEmailAddress(email) {
  if (!email) return null;
  
  // Handle different email formats
  if (typeof email === 'object') {
    if (email.text) {
      return email.text;
    } else if (email.value && email.value.length > 0 && email.value[0].address) {
      return email.value[0].address;
    }
  }
  
  const match = String(email).match(/<(.+)>/);
  return (match ? match[1] : String(email)).trim();
}

// Process a single email
async function processEmail(mail, seqno) {
  try {
    const parsed = await simpleParser(mail);
    
    // Get email details
    const from = extractEmailAddress(parsed.from);
    const to = Array.isArray(parsed.to) 
      ? parsed.to.map(t => extractEmailAddress(t)).join(', ')
      : extractEmailAddress(parsed.to);
    const subject = parsed.subject || 'No Subject';
    const date = parsed.date || new Date();
    const messageId = parsed.messageId;
    
    // Log basic info
    log(`Email #${seqno}: "${subject}" from ${from}`);
    log(`  Date: ${date.toISOString()}`);
    log(`  Message-ID: ${messageId}`);
    log(`  To: ${to}`);
    
    // Check for HTML content
    const hasHtml = Boolean(parsed.html);
    const hasText = Boolean(parsed.text);
    log(`  Content types: ${hasHtml ? 'HTML' : ''}${hasHtml && hasText ? ' and ' : ''}${hasText ? 'Text' : ''}`);
    
    // Log references and in-reply-to for threading
    if (parsed.references) {
      log(`  References: ${parsed.references}`);
    }
    if (parsed.inReplyTo) {
      log(`  In-Reply-To: ${parsed.inReplyTo}`);
    }
    
    // Save email content to files for inspection
    const emailDir = path.join(outputDir, `email-${seqno}-${Date.now()}`);
    fs.mkdirSync(emailDir, { recursive: true });
    
    // Save email metadata
    fs.writeFileSync(path.join(emailDir, 'metadata.json'), JSON.stringify({
      from,
      to,
      subject,
      date: date.toISOString(),
      messageId,
      references: parsed.references,
      inReplyTo: parsed.inReplyTo,
      hasHtml,
      hasText,
      headers: parsed.headers
    }, null, 2));
    
    // Save content
    if (hasHtml) {
      fs.writeFileSync(path.join(emailDir, 'content.html'), parsed.html);
    }
    if (hasText) {
      fs.writeFileSync(path.join(emailDir, 'content.txt'), parsed.text);
    }
    
    log(`  Saved email details to: ${emailDir}`);
    log('  ------------------------');
    
    return {
      from,
      to,
      subject,
      date,
      messageId
    };
  } catch (error) {
    log(`Error processing email #${seqno}: ${error.message}`);
    return null;
  }
}

// Main function to fetch emails
function fetchAllEmails() {
  log('Starting email fetch test operation...');
  
  const imap = new Imap(imapConfig);
  
  // Track emails fetched
  const emails = [];
  
  imap.once('ready', () => {
    log('Connected to IMAP server');
    
    imap.getBoxes((err, boxes) => {
      if (err) {
        log(`Error getting mailboxes: ${err.message}`);
        return;
      }
      
      log('Available mailboxes:');
      Object.keys(boxes).forEach(box => {
        log(`- ${box}`);
      });
      
      // Open INBOX
      imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          log(`Error opening inbox: ${err.message}`);
          imap.end();
          return;
        }
        
        log(`INBOX opened successfully with ${box.messages.total} total messages`);
        
        // Search for ALL messages, not just unseen
        // Use a recent timeframe (30 days) to avoid too many emails
        const searchDate = new Date();
        searchDate.setDate(searchDate.getDate() - 30);
        const formattedDate = searchDate.toISOString().split('T')[0];
        
        // Use different search criteria than the main app - we want all messages
        const searchCriteria = ['ALL', ['SINCE', formattedDate]];
        
        log(`Searching for emails since ${formattedDate}...`);
        
        imap.search(searchCriteria, (err, results) => {
          if (err) {
            log(`Error searching emails: ${err.message}`);
            imap.end();
            return;
          }
          
          if (results.length === 0) {
            log('No emails found matching criteria');
            imap.end();
            return;
          }
          
          log(`Found ${results.length} emails`);
          
          // To avoid memory issues, limit to the last 50 emails if there are many
          if (results.length > 50) {
            log(`Limiting to the last 50 emails for performance`);
            results = results.slice(-50);
          }
          
          const fetch = imap.fetch(results, { 
            bodies: '',
            markSeen: false // Don't mark as seen to avoid disrupting normal app behavior
          });
          
          fetch.on('message', (msg, seqno) => {
            log(`Processing message #${seqno}`);
            
            msg.on('body', (stream) => {
              let buffer = '';
              stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
              });
              
              stream.once('end', async () => {
                log(`Message #${seqno} body received, processing...`);
                const email = await processEmail(buffer, seqno);
                if (email) emails.push(email);
              });
            });
            
            msg.once('attributes', (attrs) => {
              log(`Message #${seqno} attributes: uid=${attrs.uid}, flags=${attrs.flags}`);
            });
          });
          
          fetch.once('error', (err) => {
            log(`Error fetching emails: ${err.message}`);
          });
          
          fetch.once('end', () => {
            log('Done fetching emails');
            
            // Log summary
            log(`\nEmail Summary - ${emails.length} emails processed`);
            emails.forEach((email, index) => {
              log(`${index + 1}. "${email.subject}" from ${email.from} - ${email.date.toISOString()}`);
            });
            
            log(`\nDetailed log saved to: ${logFile}`);
            log(`Email contents saved to: ${outputDir}`);
            
            imap.end();
          });
        });
      });
    });
  });
  
  imap.once('error', (err) => {
    log(`IMAP connection error: ${err.message}`);
  });
  
  imap.once('end', () => {
    log('IMAP connection ended');
  });
  
  // Connect with error handling
  try {
    imap.connect();
  } catch (err) {
    log(`Error connecting to IMAP server: ${err.message}`);
  }
}

// Run the email fetching process
fetchAllEmails(); 