// services/contactService.js
const fs = require('fs').promises;
const path = require('path');
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
        await fs.writeFile(CONTACTS_FILE, JSON.stringify({ contacts: [] }, null, 2));
    }
}

// Generate message ID for email tracking
function generateMessageId() {
    return `${Date.now()}.${Math.random().toString(36).substring(2)}@otmeducation.com`;
}

// Add a new contact
async function addContact(contact) {
    await ensureDataDirectory();
    await initializeContactsFile();

    try {
        const data = await fs.readFile(CONTACTS_FILE, 'utf8');
        let { contacts } = JSON.parse(data);
        
        // Generate a message ID for email tracking
        const messageId = generateMessageId();
        
        const newContact = {
            id: Date.now().toString(),
            name: contact.name,
            email: contact.email,
            message: contact.message,
            subject: contact.subject || 'Contact Form Submission',
            status: 'new',
            createdAt: new Date().toISOString(),
            responses: [],
            messageId
        };

        contacts.push(newContact);
        await fs.writeFile(CONTACTS_FILE, JSON.stringify({ contacts }, null, 2));

        // Send email notifications
        try {
            await sendContactNotification({...newContact});
            await sendContactAutoResponse({...newContact});
            console.log(`Contact notifications sent for ${newContact.email}`);
        } catch (error) {
            console.error('Error sending email notifications:', error);
            // Continue even if email fails - the contact is still saved
        }

        return newContact;
    } catch (error) {
        console.error('Error adding contact:', error);
        throw error;
    }
}

// Add an email response to a contact
async function addEmailResponse(emailData) {
    await ensureDataDirectory();
    await initializeContactsFile();

    try {
        const data = await fs.readFile(CONTACTS_FILE, 'utf8');
        let { contacts } = JSON.parse(data);
        
        // Find the original contact by message ID or email
        const originalContact = contacts.find(contact => {
            // Check message ID first if available
            if (emailData.originalMessageId && contact.messageId === emailData.originalMessageId) {
                return true;
            }
            
            // Otherwise try to match by email
            return contact.email === emailData.from;
        });

        if (!originalContact) {
            console.log('No matching contact found for email response from:', emailData.from);
            return null;
        }

        const response = {
            id: Date.now().toString(),
            from: emailData.from,
            content: emailData.content,
            subject: emailData.subject,
            timestamp: emailData.timestamp || new Date().toISOString(),
            messageId: emailData.messageId
        };

        // Add response to the contact
        originalContact.responses = originalContact.responses || [];
        originalContact.responses.push(response);
        originalContact.status = 'responded';
        originalContact.lastUpdated = new Date().toISOString();

        await fs.writeFile(CONTACTS_FILE, JSON.stringify({ contacts }, null, 2));
        console.log(`Added response to contact ${originalContact.id}`);
        return originalContact;
    } catch (error) {
        console.error('Error adding email response:', error);
        throw error;
    }
}

// Get all contacts
async function getContacts() {
    await ensureDataDirectory();
    await initializeContactsFile();

    try {
        const data = await fs.readFile(CONTACTS_FILE, 'utf8');
        const { contacts } = JSON.parse(data);
        
        // Sort contacts by date (most recent first)
        return contacts.sort((a, b) => {
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
    } catch (error) {
        console.error('Error getting contacts:', error);
        return [];
    }
}

// Update contact status
async function updateContactStatus(id, status, responseText = null) {
    await ensureDataDirectory();
    await initializeContactsFile();

    try {
        const data = await fs.readFile(CONTACTS_FILE, 'utf8');
        let { contacts } = JSON.parse(data);
        
        const contactIndex = contacts.findIndex(c => c.id === id);
        if (contactIndex === -1) {
            throw new Error(`Contact with ID ${id} not found`);
        }
        
        const contact = contacts[contactIndex];
        contact.status = status;
        contact.lastUpdated = new Date().toISOString();
        
        // If response is provided, add it to the responses
        if (responseText) {
            const response = {
                id: Date.now().toString(),
                from: 'Admin',
                content: responseText,
                timestamp: new Date().toISOString()
            };
            
            contact.responses = contact.responses || [];
            contact.responses.push(response);
        }
        
        await fs.writeFile(CONTACTS_FILE, JSON.stringify({ contacts }, null, 2));
        return contact;
    } catch (error) {
        console.error('Error updating contact status:', error);
        throw error;
    }
}

// Delete a contact
async function deleteContact(id) {
    await ensureDataDirectory();
    await initializeContactsFile();

    try {
        const data = await fs.readFile(CONTACTS_FILE, 'utf8');
        let { contacts } = JSON.parse(data);
        
        const newContacts = contacts.filter(c => c.id !== id);
        
        if (newContacts.length === contacts.length) {
            throw new Error(`Contact with ID ${id} not found`);
        }
        
        await fs.writeFile(CONTACTS_FILE, JSON.stringify({ contacts: newContacts }, null, 2));
        return true;
    } catch (error) {
        console.error('Error deleting contact:', error);
        throw error;
    }
}

module.exports = {
    addContact,
    getContacts,
    updateContactStatus,
    addEmailResponse,
    deleteContact
};