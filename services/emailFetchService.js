const Imap = require('node-imap');
const { simpleParser } = require('mailparser');
const { addEmailResponse } = require('./contactService');
require('dotenv').config();

const imapConfig = {
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    host: 'ssl0.ovh.net',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false }
};

function extractEmailAddress(email) {
    const match = email.match(/<(.+)>/);
    return match ? match[1] : email;
}

function extractOriginalMessageId(references) {
    if (!references) return null;
    const refs = references.split(' ');
    return refs[refs.length - 1];
}

async function processEmail(mail) {
    try {
        const parsed = await simpleParser(mail);
        const from = extractEmailAddress(parsed.from.text);
        const subject = parsed.subject;
        const content = parsed.text;
        const messageId = parsed.messageId;
        const references = parsed.references;
        const originalMessageId = extractOriginalMessageId(references);

        // Add the email response to the contact system
        await addEmailResponse({
            from,
            subject,
            content,
            messageId,
            originalMessageId,
            timestamp: parsed.date
        });

        console.log(`Processed email from ${from}`);
    } catch (error) {
        console.error('Error processing email:', error);
    }
}

function startEmailFetching() {
    const imap = new Imap(imapConfig);

    imap.once('ready', () => {
        console.log('Connected to OVH IMAP server');
        imap.openBox('INBOX', false, (err, box) => {
            if (err) {
                console.error('Error opening inbox:', err);
                return;
            }

            // Search for unread emails
            imap.search(['UNSEEN'], (err, results) => {
                if (err) {
                    console.error('Error searching emails:', err);
                    return;
                }

                if (results.length === 0) {
                    console.log('No new emails found');
                    imap.end();
                    return;
                }

                const fetch = imap.fetch(results, { bodies: '' });
                fetch.on('message', (msg) => {
                    msg.on('body', (stream) => {
                        let buffer = '';
                        stream.on('data', (chunk) => {
                            buffer += chunk.toString('utf8');
                        });
                        stream.once('end', () => {
                            processEmail(buffer);
                        });
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
        // Reconnect after 5 minutes
        setTimeout(startEmailFetching, 5 * 60 * 1000);
    });

    imap.connect();
}

module.exports = {
    startEmailFetching
}; 