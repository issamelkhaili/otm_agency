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

// Output directory for HTML content
const outputDir = path.join(__dirname, '../data/html-test');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
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
    
    console.log(`\nEmail #${seqno}: "${subject}" from ${from}`);
    console.log(`Date: ${date.toISOString()}`);
    console.log(`To: ${to}`);
    
    // Save both formats
    const emailPath = path.join(outputDir, `email-${seqno}`);
    
    if (parsed.html) {
      console.log('HTML content found');
      fs.writeFileSync(`${emailPath}.html`, parsed.html);
      console.log(`HTML content saved to: ${emailPath}.html`);
      
      // Save a text version for comparison
      const textContent = parsed.text || '';
      fs.writeFileSync(`${emailPath}.txt`, textContent);
      console.log(`Text content saved to: ${emailPath}.txt`);
      
      // Save a debug HTML file that shows both versions
      const debugHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Email Test: ${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
            .email-header { border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 20px; }
            .email-header h1 { margin-top: 0; }
            .email-header p { margin: 5px 0; color: #666; }
            .container { display: flex; }
            .column { flex: 1; padding: 10px; }
            .html-view { border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
            pre { background: #f5f5f5; padding: 15px; overflow: auto; white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <div class="email-header">
            <h1>${subject}</h1>
            <p><strong>From:</strong> ${from}</p>
            <p><strong>To:</strong> ${to}</p>
            <p><strong>Date:</strong> ${date.toISOString()}</p>
          </div>
          
          <div class="container">
            <div class="column">
              <h2>HTML Content</h2>
              <div class="html-view">
                ${parsed.html}
              </div>
            </div>
            <div class="column">
              <h2>Plain Text Content</h2>
              <pre>${parsed.text || 'No text content'}</pre>
            </div>
          </div>
          
          <div>
            <h2>Raw HTML Code</h2>
            <pre>${parsed.html ? parsed.html.replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'No HTML content'}</pre>
          </div>
        </body>
        </html>
      `;
      
      fs.writeFileSync(`${emailPath}-debug.html`, debugHtml);
      console.log(`Debug view saved to: ${emailPath}-debug.html`);
      
      return { 
        from,
        subject,
        hasHtml: true,
        path: emailPath 
      };
    } else if (parsed.text) {
      console.log('Text content found (no HTML)');
      fs.writeFileSync(`${emailPath}.txt`, parsed.text);
      console.log(`Text content saved to: ${emailPath}.txt`);
      
      return { 
        from,
        subject,
        hasHtml: false,
        path: emailPath 
      };
    } else {
      console.log('No content found');
      return null;
    }
  } catch (error) {
    console.error(`Error processing email #${seqno}:`, error.message);
    return null;
  }
}

// Fetch the most recent email
function fetchLatestEmail() {
  console.log('Fetching the most recent email...');
  
  const imap = new Imap(imapConfig);
  let emailInfo = null;
  
  imap.once('ready', () => {
    console.log('Connected to IMAP server');
    
    imap.openBox('INBOX', false, (err, box) => {
      if (err) {
        console.error('Error opening inbox:', err.message);
        imap.end();
        return;
      }
      
      console.log(`INBOX opened successfully with ${box.messages.total} total messages`);
      
      // Get the most recent email
      const total = box.messages.total;
      if (total === 0) {
        console.log('No messages in inbox');
        imap.end();
        return;
      }
      
      // Fetch the most recent message
      const fetch = imap.fetch(total, { 
        bodies: '',
        markSeen: false // Don't mark as seen
      });
      
      fetch.on('message', (msg, seqno) => {
        console.log(`Processing message #${seqno}`);
        
        msg.on('body', (stream) => {
          let buffer = '';
          stream.on('data', (chunk) => {
            buffer += chunk.toString('utf8');
          });
          
          stream.once('end', async () => {
            console.log(`Message body received, processing...`);
            emailInfo = await processEmail(buffer, seqno);
          });
        });
      });
      
      fetch.once('error', (err) => {
        console.error('Error fetching email:', err.message);
      });
      
      fetch.once('end', () => {
        console.log('Done fetching email');
        
        // Display results
        if (emailInfo) {
          console.log('\nEmail Details:');
          console.log(`From: ${emailInfo.from}`);
          console.log(`Subject: ${emailInfo.subject}`);
          console.log(`Contains HTML: ${emailInfo.hasHtml ? 'Yes' : 'No'}`);
          
          if (emailInfo.hasHtml) {
            console.log(`\nYou can view the HTML content by opening: ${emailInfo.path}-debug.html`);
          }
        } else {
          console.log('No email was processed');
        }
        
        imap.end();
      });
    });
  });
  
  imap.once('error', (err) => {
    console.error('IMAP connection error:', err.message);
  });
  
  imap.once('end', () => {
    console.log('IMAP connection ended');
  });
  
  // Connect with error handling
  try {
    imap.connect();
  } catch (err) {
    console.error('Error connecting to IMAP server:', err.message);
  }
}

// Run the email fetching process
fetchLatestEmail(); 