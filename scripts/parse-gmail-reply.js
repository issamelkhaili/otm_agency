require('dotenv').config();
const fs = require('fs');
const path = require('path');

/**
 * Parses a Gmail-style reply email to extract just the new content
 * 
 * @param {string} emailContent - The raw email content
 * @returns {string} The parsed message (just the new content)
 */
function parseGmailReply(emailContent) {
  if (!emailContent) return '';

  // Step 1: Split by the common Gmail reply markers
  const markers = [
    /On [A-Za-z]{3}, [A-Za-z]{3} \d+, \d{4}(,| at) \d+:\d+ (AM|PM)/i, // "On Thu, May 8, 2025 at 8:46 AM"
    /On [A-Za-z]{3}, [A-Za-z]{3} \d+, \d{4}, \d+:\d+ (AM|PM)/i,        // "On Thu, May 8, 2025, 8:46 AM"
    /On \d{4}-\d{2}-\d{2} \d+:\d+/i,                                   // "On 2025-05-08 8:46"
    /On \d{1,2}\/\d{1,2}\/\d{2,4} \d+:\d+/i,                           // "On 5/8/25 8:46"
    /On \d{1,2}\/\d{1,2}\/\d{2,4}, .* wrote:/i,                        // "On 5/8/25, OTM wrote:"
    /On .* wrote:/i                                                    // "On Thursday, OTM wrote:"
  ];

  // Try each marker pattern
  for (const marker of markers) {
    const parts = emailContent.split(marker);
    if (parts.length > 1) {
      // Return just the part before the marker, trimmed
      return parts[0].trim();
    }
  }

  // If we couldn't split by markers, look for standard Gmail quote indicators
  const lines = emailContent.split('\n');
  const newLines = [];
  let quoteStarted = false;

  for (const line of lines) {
    // Check for quote indicators (> at beginning of line, or standard Gmail quote)
    if (line.trim().startsWith('>') || line.includes('wrote:')) {
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

  // If all else fails, return the entire content but truncate after 500 chars
  if (emailContent.length > 500) {
    return emailContent.substring(0, 500).trim() + '...';
  }

  // Last resort: return the whole content
  return emailContent.trim();
}

/**
 * Formats a chat-style conversation for the admin panel
 * 
 * @param {Array} messages - Array of message objects
 * @returns {string} HTML-formatted chat conversation
 */
function formatChatConversation(messages) {
  // Sort messages by timestamp, newest first
  messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  let html = '<div class="chat-container">';
  
  // Add CSS styles
  html += `
  <style>
    .chat-container {
      font-family: Arial, sans-serif;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
      border-radius: 8px;
    }
    .message {
      margin-bottom: 16px;
      clear: both;
    }
    .message-bubble {
      padding: 12px;
      border-radius: 18px;
      max-width: 80%;
      position: relative;
      word-wrap: break-word;
    }
    .message-time {
      font-size: 11px;
      color: #888;
      margin-top: 4px;
    }
    .admin-message {
      float: right;
    }
    .admin-message .message-bubble {
      background-color: #dcf8c6;
      border-radius: 18px 18px 0 18px;
      margin-left: auto;
    }
    .user-message {
      float: left;
    }
    .user-message .message-bubble {
      background-color: white;
      border-radius: 18px 18px 18px 0;
    }
    .message-sender {
      font-weight: bold;
      margin-bottom: 4px;
    }
    .clearfix::after {
      content: "";
      clear: both;
      display: table;
    }
  </style>`;
  
  messages.forEach(msg => {
    const isAdmin = msg.from === 'Admin';
    const messageClass = isAdmin ? 'admin-message' : 'user-message';
    const formattedTime = formatRelativeTime(msg.timestamp);
    
    html += `
      <div class="message ${messageClass}">
        <div class="message-bubble">
          <div class="message-sender">${isAdmin ? 'OTM Education' : msg.from}</div>
          <div class="message-content">${msg.content.replace(/\n/g, '<br>')}</div>
          <div class="message-time">${formattedTime}</div>
        </div>
      </div>
      <div class="clearfix"></div>`;
  });
  
  html += '</div>';
  return html;
}

/**
 * Formats a timestamp as a relative time (e.g. "just now", "5 minutes ago")
 */
function formatRelativeTime(timestamp) {
  const now = new Date();
  const messageDate = new Date(timestamp);
  const diffSeconds = Math.floor((now - messageDate) / 1000);
  
  if (diffSeconds < 60) return 'Just now';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} minutes ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} hours ago`;
  if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)} days ago`;
  
  return messageDate.toLocaleDateString();
}

// Test function to demonstrate the parsing
function testGmailParsing() {
  const testEmail = `What's up dude

On Thu, May 8, 2025, 08:48 INSTAGRAM Team <elkhailiissam1@gmail.com> wrote:
Thank you for your response. 

On Thu, May 8, 2025 at 8:46 AM OTM Education <contact@otmeducation.com> wrote:
Re: Your message to OTM Education
Dear el khailiero issam,

helllo

Best regards,
OTM Education Team`;

  const parsedMessage = parseGmailReply(testEmail);
  console.log("Original Email:\n" + testEmail);
  console.log("\nParsed Message:\n" + parsedMessage);
  
  // Create a mock conversation
  const conversation = [
    {
      from: 'elkhailiissam1@gmail.com',
      content: parsedMessage,
      timestamp: new Date().toISOString()
    },
    {
      from: 'Admin',
      content: 'helllo',
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString() // 5 minutes ago
    },
    {
      from: 'elkhailiissam1@gmail.com',
      content: 'Thank you for your response.',
      timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString() // 2 minutes ago
    }
  ];
  
  // Generate the chat-style HTML
  const chatHtml = formatChatConversation(conversation);
  
  // Save as HTML file for viewing
  const outputDir = path.join(__dirname, '../data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputFile = path.join(outputDir, 'parsed-chat-example.html');
  fs.writeFileSync(outputFile, chatHtml);
  
  console.log(`\nChat view HTML saved to: ${outputFile}`);
  console.log('Open this file in a browser to see how the conversation would look');
}

// Run the test
testGmailParsing();

module.exports = {
  parseGmailReply,
  formatChatConversation
}; 