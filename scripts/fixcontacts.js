// scripts/fixContacts.js
const fs = require('fs').promises;
const path = require('path');
const { encrypt, isEncrypted } = require('../services/encryptionService');

const CONTACTS_FILE = path.join(__dirname, '../data/contacts.json');

async function fixContacts() {
    try {
        console.log('Starting contacts fix...');
        
        // Read the contacts file
        const data = await fs.readFile(CONTACTS_FILE, 'utf8');
        const { contacts } = JSON.parse(data);
        
        console.log(`Found ${contacts.length} contacts to process`);
        let fixedCount = 0;
        
        // Process each contact
        contacts.forEach(contact => {
            let contactModified = false;
            
            // Fix email field if needed
            if (contact.email && !isEncrypted(contact.email)) {
                console.log(`Fixing unencrypted email for contact ${contact.id} (${contact.name})`);
                contact.email = encrypt(contact.email);
                contactModified = true;
            }
            
            // Fix message field if needed
            if (contact.message && !isEncrypted(contact.message)) {
                console.log(`Fixing unencrypted message for contact ${contact.id} (${contact.name})`);
                contact.message = encrypt(contact.message);
                contactModified = true;
            }
            
            // Fix response contents if needed
            if (contact.responses && contact.responses.length > 0) {
                contact.responses.forEach(response => {
                    if (response.content && !isEncrypted(response.content)) {
                        console.log(`Fixing unencrypted response content for contact ${contact.id}, response from ${response.from}`);
                        response.content = encrypt(response.content);
                        contactModified = true;
                    }
                });
            }
            
            if (contactModified) {
                fixedCount++;
            }
        });
        
        // Save the fixed contacts back to the file
        await fs.writeFile(CONTACTS_FILE, JSON.stringify({ contacts }, null, 2));
        
        console.log(`Fixed ${fixedCount} contacts. Process complete.`);
    } catch (error) {
        console.error('Error fixing contacts:', error);
    }
}

// Run the function
fixContacts();