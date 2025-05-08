require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { encrypt, decrypt, isEncrypted } = require('../services/encryptionService');

const CONTACTS_FILE = path.join(__dirname, '../data/contacts.json');
const REPORT_FILE = path.join(__dirname, '../data/contact-diagnosis.log');

// Ensure data directory exists
async function ensureDataDirectory() {
    const dataDir = path.dirname(REPORT_FILE);
    try {
        await fs.access(dataDir);
    } catch {
        await fs.mkdir(dataDir, { recursive: true });
    }
}

async function writeToReport(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(message);
    await fs.appendFile(REPORT_FILE, logMessage);
}

async function inspectContacts() {
    await ensureDataDirectory();
    await writeToReport('Starting contact diagnosis...');
    
    // Check if contacts file exists
    try {
        await fs.access(CONTACTS_FILE);
    } catch (err) {
        await writeToReport(`ERROR: Contacts file not found at ${CONTACTS_FILE}`);
        return;
    }
    
    // Read and parse contacts
    try {
        const data = await fs.readFile(CONTACTS_FILE, 'utf8');
        const { contacts } = JSON.parse(data);
        
        await writeToReport(`Found ${contacts.length} contacts in database`);
        
        // Statistics
        let encryptedEmails = 0;
        let encryptedMessages = 0;
        let totalResponses = 0;
        let encryptedResponses = 0;
        let htmlResponses = 0;
        let serviceProviderEmails = 0;
        let displayContentCount = 0;
        
        // Group by different email providers
        const emailDomains = {};
        
        for (let i = 0; i < contacts.length; i++) {
            const contact = contacts[i];
            await writeToReport(`\nContact #${i+1} (ID: ${contact.id})`);
            await writeToReport(`Name: ${contact.name}`);
            
            // Check email encryption
            let emailDecrypted = contact.email;
            const isEmailEncrypted = isEncrypted(contact.email);
            if (isEmailEncrypted) {
                encryptedEmails++;
                try {
                    emailDecrypted = decrypt(contact.email);
                    await writeToReport(`Email: ${emailDecrypted} (encrypted)`);
                } catch (err) {
                    await writeToReport(`Email: DECRYPTION ERROR (${err.message})`);
                }
            } else {
                await writeToReport(`Email: ${contact.email} (not encrypted)`);
            }
            
            // Track email domains
            try {
                const domain = emailDecrypted.split('@')[1].toLowerCase();
                emailDomains[domain] = (emailDomains[domain] || 0) + 1;
                
                // Check for common service provider domains
                const serviceProviders = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];
                if (serviceProviders.includes(domain)) {
                    serviceProviderEmails++;
                }
            } catch (err) {
                await writeToReport(`Could not extract domain from ${emailDecrypted}`);
            }
            
            // Check message encryption
            let messageDecrypted = contact.message;
            const isMessageEncrypted = isEncrypted(contact.message);
            if (isMessageEncrypted) {
                encryptedMessages++;
                try {
                    messageDecrypted = decrypt(contact.message);
                    await writeToReport(`Message encryption: YES`);
                } catch (err) {
                    await writeToReport(`Message: DECRYPTION ERROR (${err.message})`);
                }
            } else {
                await writeToReport(`Message encryption: NO`);
            }
            
            // Check for HTML in message
            if (messageDecrypted && typeof messageDecrypted === 'string' && messageDecrypted.includes('<html')) {
                await writeToReport(`Message content: Contains HTML`);
            }
            
            // Status & Timestamp
            await writeToReport(`Status: ${contact.status || 'Unknown'}`);
            await writeToReport(`Created: ${contact.createdAt}`);
            
            // Check responses
            if (contact.responses && contact.responses.length > 0) {
                totalResponses += contact.responses.length;
                
                await writeToReport(`Responses: ${contact.responses.length}`);
                
                // Examine individual responses
                for (let j = 0; j < contact.responses.length; j++) {
                    const response = contact.responses[j];
                    await writeToReport(`  Response #${j+1}:`);
                    await writeToReport(`    From: ${response.from}`);
                    await writeToReport(`    Time: ${response.timestamp}`);
                    
                    // Check for displayContent field
                    if (response.displayContent) {
                        displayContentCount++;
                        await writeToReport(`    Has displayContent: YES`);
                    } else {
                        await writeToReport(`    Has displayContent: NO`);
                    }
                    
                    // Check for readable content or any content encryption
                    if (response.readableContent) {
                        await writeToReport(`    Has readableContent: YES`);
                    } else {
                        await writeToReport(`    Has readableContent: NO`);
                    }
                    
                    // Check content encryption
                    if (isEncrypted(response.content)) {
                        encryptedResponses++;
                        await writeToReport(`    Content encryption: YES`);
                        
                        try {
                            const decryptedContent = decrypt(response.content);
                            // Check for HTML
                            if (decryptedContent && typeof decryptedContent === 'string' && 
                                (decryptedContent.includes('<html') || decryptedContent.startsWith('<'))) {
                                htmlResponses++;
                                await writeToReport(`    Content type: Contains HTML`);
                            }
                        } catch (err) {
                            await writeToReport(`    Content: DECRYPTION ERROR (${err.message})`);
                        }
                    } else {
                        await writeToReport(`    Content encryption: NO`);
                        
                        // Check for HTML directly
                        if (response.content && typeof response.content === 'string' && 
                            (response.content.includes('<html') || response.content.startsWith('<'))) {
                            htmlResponses++;
                            await writeToReport(`    Content type: Contains HTML`);
                        }
                    }
                }
            } else {
                await writeToReport(`Responses: None`);
            }
        }
        
        // Summary statistics
        await writeToReport('\n===== SUMMARY =====');
        await writeToReport(`Total Contacts: ${contacts.length}`);
        await writeToReport(`Contacts with encrypted emails: ${encryptedEmails} (${Math.round(encryptedEmails/contacts.length*100)}%)`);
        await writeToReport(`Contacts with encrypted messages: ${encryptedMessages} (${Math.round(encryptedMessages/contacts.length*100)}%)`);
        await writeToReport(`Total responses: ${totalResponses}`);
        await writeToReport(`Responses with encrypted content: ${encryptedResponses} (${totalResponses ? Math.round(encryptedResponses/totalResponses*100) : 0}%)`);
        await writeToReport(`Responses with HTML content: ${htmlResponses} (${totalResponses ? Math.round(htmlResponses/totalResponses*100) : 0}%)`);
        await writeToReport(`Responses with displayContent field: ${displayContentCount} (${totalResponses ? Math.round(displayContentCount/totalResponses*100) : 0}%)`);
        await writeToReport(`Contacts with service provider emails (gmail, etc): ${serviceProviderEmails} (${Math.round(serviceProviderEmails/contacts.length*100)}%)`);
        
        // Email domain distribution
        await writeToReport('\nEmail Domain Distribution:');
        const sortedDomains = Object.entries(emailDomains).sort((a, b) => b[1] - a[1]);
        for (const [domain, count] of sortedDomains) {
            await writeToReport(`  ${domain}: ${count} (${Math.round(count/contacts.length*100)}%)`);
        }
        
        await writeToReport('\nDiagnosis complete - check data/contact-diagnosis.log for full report');
    } catch (err) {
        await writeToReport(`ERROR: ${err.message}`);
        console.error(err);
    }
}

// Run the diagnostic
inspectContacts().catch(err => {
    console.error('Error running diagnosis:', err);
}); 