const fs = require('fs').promises;
const path = require('path');
const { encrypt, decrypt } = require('./encryptionService');
const { sendContactNotification, sendContactAutoResponse } = require('./emailService');

const CONTACTS_FILE = path.join(__dirname, '../data/contacts.json');

// Ensure data directory exists
async function ensureDataDirectory() {
    const dataDir = path.dirname(CONTACTS_FILE);
    try {
        await fs.access(dataDir);
    } catch {
        await fs.mkdir(dataDir, { recursive: true });
    }
}

// Initialize contacts file if it doesn't exist
async function initializeContactsFile() {
    try {
        await fs.access(CONTACTS_FILE);
    } catch {
        await fs.writeFile(CONTACTS_FILE, JSON.stringify({ contacts: [] }));
    }
}

// Add a new contact
async function addContact(contact) {
    await ensureDataDirectory();
    await initializeContactsFile();

    const data = await fs.readFile(CONTACTS_FILE, 'utf8');
    const { contacts } = JSON.parse(data);
    
    const newContact = {
        id: Date.now().toString(),
        name: contact.name,
        email: contact.email,
        message: contact.message,
        status: 'new',
        createdAt: new Date().toISOString(),
        responses: [],
        messageId: contact.messageId // Store the message ID for email threading
    };

    // Encrypt sensitive data
    newContact.email = encrypt(newContact.email);
    newContact.message = encrypt(newContact.message);

    contacts.push(newContact);
    await fs.writeFile(CONTACTS_FILE, JSON.stringify({ contacts }, null, 2));

    // Send email notifications
    try {
        await sendContactNotification(newContact);
        await sendContactAutoResponse(newContact);
    } catch (error) {
        console.error('Error sending email notifications:', error);
    }

    return newContact;
}

// Add an email response to a contact
async function addEmailResponse(emailData) {
    await ensureDataDirectory();
    await initializeContactsFile();

    const data = await fs.readFile(CONTACTS_FILE, 'utf8');
    const { contacts } = JSON.parse(data);
    
    // Find the original contact by message ID or email
    const originalContact = contacts.find(contact => {
        // Check message ID first
        if (contact.messageId === emailData.originalMessageId) {
            return true;
        }
        
        // Safely try to decrypt email
        try {
            const decryptedEmail = decrypt(contact.email);
            return decryptedEmail === emailData.from;
        } catch (error) {
            console.log(`Error decrypting email for contact ID ${contact.id}:`, error.message);
            return false;
        }
    });

    if (!originalContact) {
        console.log('No matching contact found for email response');
        return null;
    }

    const response = {
        id: Date.now().toString(),
        from: emailData.from,
        content: emailData.content,
        timestamp: emailData.timestamp,
        messageId: emailData.messageId
    };

    // Encrypt the response content
    response.content = encrypt(response.content);

    // Add response to the contact
    originalContact.responses = originalContact.responses || [];
    originalContact.responses.push(response);
    originalContact.status = 'responded';

    await fs.writeFile(CONTACTS_FILE, JSON.stringify({ contacts }, null, 2));
    return response;
}

// Get all contacts
async function getContacts() {
    await ensureDataDirectory();
    await initializeContactsFile();

    const data = await fs.readFile(CONTACTS_FILE, 'utf8');
    const { contacts } = JSON.parse(data);

    // Decrypt sensitive data
    return contacts.map(contact => {
        try {
            return {
                ...contact,
                email: decrypt(contact.email),
                message: decrypt(contact.message),
                responses: (contact.responses || []).map(response => {
                    try {
                        return {
                            ...response,
                            content: decrypt(response.content)
                        };
                    } catch (error) {
                        console.log(`Error decrypting response content for contact ID ${contact.id}:`, error.message);
                        return {
                            ...response,
                            content: response.content || 'Decryption error'
                        };
                    }
                })
            };
        } catch (error) {
            console.log(`Error decrypting contact ID ${contact.id}:`, error.message);
            return {
                ...contact,
                email: contact.email || 'Decryption error',
                message: contact.message || 'Decryption error',
                responses: (contact.responses || [])
            };
        }
    });
}

// Update contact status
async function updateContactStatus(id, status) {
    await ensureDataDirectory();
    await initializeContactsFile();

    const data = await fs.readFile(CONTACTS_FILE, 'utf8');
    const { contacts } = JSON.parse(data);
    
    const contact = contacts.find(c => c.id === id);
    if (contact) {
        contact.status = status;
        await fs.writeFile(CONTACTS_FILE, JSON.stringify({ contacts }, null, 2));
        return contact;
    }
    
    return null;
}

module.exports = {
    addContact,
    getContacts,
    updateContactStatus,
    addEmailResponse
}; 