const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const CONTACTS_FILE = path.join(__dirname, '../data/contacts.json');
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'otm-education-secure-key-32-bytes!!';
const IV_LENGTH = 16;

// Helper function to ensure key is exactly 32 bytes
function getKey() {
    // Use SHA-256 to get exactly 32 bytes
    return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
}

// Encryption functions
function encrypt(text) {
    if (!text) return null;
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getKey();
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text.toString());
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    if (!text) return null;
    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const key = getKey();
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (error) {
        console.error('Decryption error:', error);
        return text; // Return original text if decryption fails
    }
}

// Contact operations
async function addContact(contact) {
    try {
        const data = await fs.readFile(CONTACTS_FILE, 'utf8');
        const contacts = JSON.parse(data);
        
        // Encrypt sensitive data
        const encryptedContact = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            name: encrypt(contact.name),
            email: encrypt(contact.email),
            phone: contact.phone ? encrypt(contact.phone) : null,
            message: encrypt(contact.message),
            status: 'new',
            response: null
        };
        
        contacts.contacts.push(encryptedContact);
        await fs.writeFile(CONTACTS_FILE, JSON.stringify(contacts, null, 2));
        return encryptedContact;
    } catch (error) {
        console.error('Error adding contact:', error);
        throw error;
    }
}

async function getContacts() {
    try {
        const data = await fs.readFile(CONTACTS_FILE, 'utf8');
        const contacts = JSON.parse(data);
        
        // Decrypt sensitive data
        return contacts.contacts.map(contact => {
            try {
                return {
                    ...contact,
                    name: decrypt(contact.name),
                    email: decrypt(contact.email),
                    phone: contact.phone ? decrypt(contact.phone) : null,
                    message: decrypt(contact.message),
                    response: contact.response ? decrypt(contact.response) : null
                };
            } catch (decryptError) {
                console.error('Error decrypting contact:', decryptError);
                // Return the contact with original encrypted data if decryption fails
                return contact;
            }
        });
    } catch (error) {
        console.error('Error getting contacts:', error);
        throw error;
    }
}

async function updateContactStatus(id, status, response = null) {
    try {
        const data = await fs.readFile(CONTACTS_FILE, 'utf8');
        const contacts = JSON.parse(data);
        
        const contactIndex = contacts.contacts.findIndex(c => c.id === id);
        if (contactIndex === -1) {
            throw new Error('Contact not found');
        }
        
        contacts.contacts[contactIndex].status = status;
        if (response) {
            contacts.contacts[contactIndex].response = encrypt(response);
        }
        
        await fs.writeFile(CONTACTS_FILE, JSON.stringify(contacts, null, 2));
        return contacts.contacts[contactIndex];
    } catch (error) {
        console.error('Error updating contact:', error);
        throw error;
    }
}

module.exports = {
    addContact,
    getContacts,
    updateContactStatus
}; 