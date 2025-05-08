// services/contactService.js
const fs = require('fs').promises;
const path = require('path');
const { encrypt, decrypt, isEncrypted } = require('./encryptionService');
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
    
    // Check if a contact with this email already exists
    let existingContact = null;
    
    // Find existing contact by email (case insensitive)
    existingContact = contacts.find(c => {
        try {
            // Get stored email (may be encrypted or not)
            let storedEmail = c.email;
            
            // Decrypt if needed
            if (isEncrypted(storedEmail)) {
                storedEmail = decrypt(storedEmail);
            }
            
            // Normalize and compare emails
            return storedEmail.toLowerCase() === contact.email.toLowerCase();
        } catch (error) {
            console.log(`Error comparing emails for contact ID ${c.id}:`, error.message);
            return false;
        }
    });
    
    // If an existing contact is found, add this message as a response
    if (existingContact) {
        console.log(`Found existing contact with email ${contact.email}, adding as response`);
        
        // Create a response object from the new contact message
        const response = {
            id: Date.now().toString(),
            from: contact.email,
            content: contact.message,
            timestamp: new Date().toISOString(),
            messageId: contact.messageId || `<new-message-${Date.now()}@otmeducation.com>`
        };
        
        // Initialize responses array if it doesn't exist
        existingContact.responses = existingContact.responses || [];
        
        // Encrypt response content
        response.content = encrypt(response.content);
        
        // Add response to existing contact
        existingContact.responses.push(response);
        
        // Update status to new
        existingContact.status = 'new';
        
        // Update the file
        await fs.writeFile(CONTACTS_FILE, JSON.stringify({ contacts }, null, 2));
        
        // Send email notifications with unencrypted data
        try {
            // Create a plainContact with unencrypted values for email notifications
            const plainContact = {
                ...existingContact,
                email: contact.email,
                message: contact.message
            };
            
            await sendContactNotification(plainContact);
            await sendContactAutoResponse(plainContact);
        } catch (error) {
            console.error('Error sending email notifications:', error);
        }
        
        return existingContact;
    }
    
    // If no existing contact, create a new one as before
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

    // Store unencrypted copies for email sending
    const plainContact = { ...newContact };

    // Encrypt sensitive data for storage
    newContact.email = encrypt(newContact.email);
    newContact.message = encrypt(newContact.message);

    contacts.push(newContact);
    await fs.writeFile(CONTACTS_FILE, JSON.stringify({ contacts }, null, 2));

    // Send email notifications with unencrypted data
    try {
        await sendContactNotification(plainContact);
        await sendContactAutoResponse(plainContact);
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
    
    // Log the incoming email data
    console.log('Processing email response:', {
        from: emailData.from,
        subject: emailData.subject,
        messageId: emailData.messageId,
        originalMessageId: emailData.originalMessageId,
        contentType: emailData.rawHtml ? 'html' : 
                    (typeof emailData.content === 'string' && emailData.content.startsWith('<') ? 'html' : 'text')
    });
    
    // Find the original contact by message ID or email
    let originalContact = null;
    
    // First try to find by originalMessageId (in-reply-to)
    if (emailData.originalMessageId) {
        originalContact = contacts.find(contact => {
            if (contact.messageId) {
                return contact.messageId.includes(emailData.originalMessageId);
            }
            
            // Also check if any response has this messageId
            if (contact.responses && contact.responses.length > 0) {
                return contact.responses.some(r => 
                    r.messageId && r.messageId.includes(emailData.originalMessageId)
                );
            }
            
            return false;
        });
    }
    
    // If not found by originalMessageId, try by email
    if (!originalContact) {
        originalContact = contacts.find(contact => {
            try {
                // Get stored email (may be encrypted or not)
                let storedEmail = contact.email;
                
                // Decrypt if needed
                if (isEncrypted(storedEmail)) {
                    storedEmail = decrypt(storedEmail);
                }
                
                // Normalize emails and compare
                return storedEmail.toLowerCase() === emailData.from.toLowerCase();
            } catch (error) {
                console.log(`Error comparing emails for contact ID ${contact.id}:`, error.message);
                return false;
            }
        });
    }

    if (!originalContact) {
        console.log('No matching contact found for email response from:', emailData.from);
        // Create a new contact if no matching one is found
        const newContactData = {
            name: emailData.from.split('@')[0], // Use email username as name
            email: emailData.from,
            message: emailData.subject + '\n\n' + emailData.content,
            messageId: emailData.messageId
        };
        await addContact(newContactData);
        return null;
    }

    console.log(`Found matching contact ID ${originalContact.id} for email from ${emailData.from}`);
    
    // Prepare content for display
    // 1. If raw HTML is available, use that for enhanced display
    // 2. Otherwise use the plain content
    // Note: The emailFetchService already creates a plain text version from HTML if needed
    
    // Create a readable copy of the content that will work well in the admin interface
    let displayContent = emailData.content;
    let isHtml = false;
    
    // If raw HTML was provided (from the email parser), use that as the primary content
    if (emailData.rawHtml) {
        isHtml = true;
        console.log('Using raw HTML for display');
    } 
    // Otherwise check if the content itself is HTML
    else if (typeof emailData.content === 'string' && emailData.content.startsWith('<')) {
        isHtml = true;
        console.log('Content appears to be HTML');
    }
    
    const response = {
        id: Date.now().toString(),
        from: emailData.from,
        content: emailData.content, // Store plain content
        rawHtml: emailData.rawHtml, // Store raw HTML if available
        isHtml: isHtml, // Flag to indicate if the content is HTML
        displayContent: displayContent, // Content optimized for display
        timestamp: emailData.timestamp || new Date().toISOString(),
        messageId: emailData.messageId
    };

    // Encrypt the response data
    response.content = encrypt(response.content);
    if (response.rawHtml) {
        response.rawHtml = encrypt(response.rawHtml);
    }
    if (response.displayContent) {
        response.displayContent = encrypt(response.displayContent);
    }

    // Add response to the contact
    originalContact.responses = originalContact.responses || [];
    originalContact.responses.push(response);
    originalContact.status = 'responded';

    await fs.writeFile(CONTACTS_FILE, JSON.stringify({ contacts }, null, 2));
    return { ...response, contactId: originalContact.id };
}

// Merge all contacts from the same email address into the oldest contact
async function mergeContactsByEmail() {
    await ensureDataDirectory();
    await initializeContactsFile();

    const data = await fs.readFile(CONTACTS_FILE, 'utf8');
    let { contacts } = JSON.parse(data);
    
    // Create a map to group contacts by email
    const emailMap = new Map();
    
    // First pass: Decrypt all emails and map them to contact IDs
    for (const contact of contacts) {
        try {
            // Decrypt email if encrypted
            let email = contact.email;
            if (isEncrypted(email)) {
                email = decrypt(email);
            }
            
            // Normalize email to lowercase
            const normalizedEmail = email.toLowerCase();
            
            // Add to map (array of contacts with this email)
            if (!emailMap.has(normalizedEmail)) {
                emailMap.set(normalizedEmail, []);
            }
            emailMap.get(normalizedEmail).push(contact);
        } catch (error) {
            console.error(`Error processing contact ID ${contact.id}:`, error.message);
        }
    }
    
    // Track if we made any changes
    let changesApplied = false;
    
    // Second pass: Merge contacts with the same email
    for (const [email, contactsWithSameEmail] of emailMap.entries()) {
        // Skip if only one contact has this email
        if (contactsWithSameEmail.length <= 1) continue;
        
        console.log(`Found ${contactsWithSameEmail.length} contacts with email ${email}, merging...`);
        changesApplied = true;
        
        // Sort contacts by creation date, oldest first
        contactsWithSameEmail.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        // Use the oldest contact as the primary contact
        const primaryContact = contactsWithSameEmail[0];
        primaryContact.responses = primaryContact.responses || [];
        
        // Process each additional contact
        for (let i = 1; i < contactsWithSameEmail.length; i++) {
            const contactToMerge = contactsWithSameEmail[i];
            
            // Add the initial message as a response
            try {
                // Decrypt the message if encrypted
                let messageToAdd = contactToMerge.message;
                if (isEncrypted(messageToAdd)) {
                    messageToAdd = decrypt(messageToAdd);
                }
                
                // Add as a response
                primaryContact.responses.push({
                    id: `merged-${contactToMerge.id}`,
                    from: email,
                    content: encrypt(messageToAdd),
                    timestamp: contactToMerge.createdAt,
                    messageId: contactToMerge.messageId || `merged-${Date.now()}`
                });
                
                // Add any responses from the contact being merged
                if (contactToMerge.responses && contactToMerge.responses.length > 0) {
                    primaryContact.responses.push(...contactToMerge.responses);
                }
            } catch (error) {
                console.error(`Error merging message from contact ID ${contactToMerge.id}:`, error.message);
            }
        }
        
        // Sort all responses by timestamp
        primaryContact.responses.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Set status to the most urgent status from all contacts
        // Priority: new > responded > archived
        if (contactsWithSameEmail.some(c => c.status === 'new')) {
            primaryContact.status = 'new';
        } else if (contactsWithSameEmail.some(c => c.status === 'responded')) {
            primaryContact.status = 'responded';
        }
        
        // Filter out the merged contacts from the original array
        contacts = contacts.filter(c => 
            c.id === primaryContact.id || 
            !contactsWithSameEmail.slice(1).find(merged => merged.id === c.id)
        );
    }
    
    // Save changes if any were made
    if (changesApplied) {
        await fs.writeFile(CONTACTS_FILE, JSON.stringify({ contacts }, null, 2));
        console.log('Merged contacts saved successfully');
    } else {
        console.log('No contacts needed to be merged');
    }
    
    return changesApplied;
}

// Get all contacts
async function getContacts() {
    await ensureDataDirectory();
    await initializeContactsFile();
    
    // First, merge any contacts with the same email
    await mergeContactsByEmail();

    const data = await fs.readFile(CONTACTS_FILE, 'utf8');
    const { contacts } = JSON.parse(data);

    // Decrypt sensitive data
    return contacts.map(contact => {
        try {
            // Handle email field
            let emailDecrypted = contact.email;
            if (isEncrypted(contact.email)) {
                emailDecrypted = decrypt(contact.email);
            }
            
            // Handle message field
            let messageDecrypted = contact.message;
            if (isEncrypted(contact.message)) {
                messageDecrypted = decrypt(contact.message);
            }
            
            return {
                ...contact,
                email: emailDecrypted,
                message: messageDecrypted,
                responses: (contact.responses || []).map(response => {
                    try {
                        // First check if content is encrypted before trying to decrypt
                        let contentDecrypted = response.content;
                        if (isEncrypted(response.content)) {
                            contentDecrypted = decrypt(response.content);
                        }
                        
                        // Handle display content
                        let displayContentDecrypted = response.displayContent;
                        if (response.displayContent && isEncrypted(response.displayContent)) {
                            displayContentDecrypted = decrypt(response.displayContent);
                        }
                        
                        // Handle raw HTML if present
                        let rawHtmlDecrypted = response.rawHtml;
                        if (response.rawHtml && isEncrypted(response.rawHtml)) {
                            rawHtmlDecrypted = decrypt(response.rawHtml);
                        }
                        
                        return {
                            ...response,
                            content: contentDecrypted,
                            displayContent: displayContentDecrypted || contentDecrypted,
                            rawHtml: rawHtmlDecrypted
                        };
                    } catch (error) {
                        console.log(`Error processing response content for contact ID ${contact.id}:`, error.message);
                        return {
                            ...response,
                            content: response.content || 'Error processing content',
                            displayContent: 'Error processing content'
                        };
                    }
                })
            };
        } catch (error) {
            console.log(`Error processing contact ID ${contact.id}:`, error.message);
            return {
                ...contact,
                email: contact.email || 'Error processing email',
                message: contact.message || 'Error processing message',
                responses: (contact.responses || [])
            };
        }
    });
}

// Update contact status and optionally add admin response
async function updateContactStatus(id, status, responseText = null) {
    await ensureDataDirectory();
    await initializeContactsFile();

    const data = await fs.readFile(CONTACTS_FILE, 'utf8');
    const { contacts } = JSON.parse(data);
    
    const contact = contacts.find(c => c.id === id);
    if (!contact) {
        return null;
    }
    
    contact.status = status;
    
    // If a response was provided, add it to the contact's responses
    if (responseText) {
        const messageId = `<admin-response-${Date.now()}@otmeducation.com>`;
        
        const response = {
            id: Date.now().toString(),
            from: 'Admin',
            content: encrypt(responseText), // Encrypt the response
            timestamp: new Date().toISOString(),
            messageId: messageId
        };
        
        // Initialize responses array if it doesn't exist
        if (!contact.responses) {
            contact.responses = [];
        }
        
        contact.responses.push(response);
    }
    
    await fs.writeFile(CONTACTS_FILE, JSON.stringify({ contacts }, null, 2));
    
    // Return decrypted contact for immediate UI update
    // First handle email field
    let emailDecrypted = contact.email;
    if (isEncrypted(contact.email)) {
        emailDecrypted = decrypt(contact.email);
    }
    
    // Handle message field
    let messageDecrypted = contact.message;
    if (isEncrypted(contact.message)) {
        messageDecrypted = decrypt(contact.message);
    }
    
    return {
        ...contact,
        email: emailDecrypted,
        message: messageDecrypted,
        responses: (contact.responses || []).map(response => {
            try {
                // Check if content is encrypted before trying to decrypt
                let contentDecrypted = response.content;
                if (isEncrypted(response.content)) {
                    contentDecrypted = decrypt(response.content);
                }
                
                return {
                    ...response,
                    content: contentDecrypted
                };
            } catch (error) {
                return {
                    ...response,
                    content: response.content || 'Error processing content'
                };
            }
        })
    };
}

// Debug function to check for issues in the contacts file
async function diagnoseContacts() {
    try {
        const data = await fs.readFile(CONTACTS_FILE, 'utf8');
        const { contacts } = JSON.parse(data);
        
        console.log(`Found ${contacts.length} contacts`);
        
        contacts.forEach(contact => {
            console.log(`\nContact ID: ${contact.id}`);
            console.log(`Name: ${contact.name}`);
            console.log(`Email encryption check: ${isEncrypted(contact.email) ? 'Encrypted' : 'Not encrypted'}`);
            console.log(`Message encryption check: ${isEncrypted(contact.message) ? 'Encrypted' : 'Not encrypted'}`);
            
            if (contact.responses && contact.responses.length > 0) {
                console.log(`Has ${contact.responses.length} responses`);
                contact.responses.forEach((response, idx) => {
                    console.log(`  Response ${idx+1} from: ${response.from}`);
                    console.log(`  Response ${idx+1} content encryption check: ${
                        isEncrypted(response.content) ? 'Encrypted' : 'Not encrypted'
                    }`);
                });
            } else {
                console.log('No responses');
            }
        });
        
        return 'Diagnosis complete';
    } catch (error) {
        console.error('Error diagnosing contacts:', error);
        return 'Error in diagnosis';
    }
}

// Expose a function to manually trigger contact merging
async function mergeChatsWithSameEmail() {
    try {
        const merged = await mergeContactsByEmail();
        return {
            success: true,
            message: merged 
                ? 'Successfully merged chats with the same email address' 
                : 'No chats needed to be merged'
        };
    } catch (error) {
        console.error('Error merging chats:', error);
        return {
            success: false,
            message: 'Error merging chats: ' + error.message
        };
    }
}

module.exports = {
    addContact,
    getContacts,
    updateContactStatus,
    addEmailResponse,
    diagnoseContacts,
    mergeChatsWithSameEmail
};