const crypto = require('crypto');

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
    
    try {
        // Check if the text is already encrypted (has the format of iv:encryptedData)
        if (isEncrypted(text)) {
            console.log('Text appears to be already encrypted, skipping encryption');
            return text;
        }
        
        const iv = crypto.randomBytes(IV_LENGTH);
        const key = getKey();
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(text.toString());
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (error) {
        console.error('Encryption error:', error);
        // Return original text if encryption fails
        return text;
    }
}

function decrypt(text) {
    if (!text) return null;
    
    try {
        // Check if text has the expected format (iv:encryptedData)
        if (!isEncrypted(text)) {
            console.log('Text is not encrypted, returning as is:', text);
            return text; // Return original text if not encrypted
        }
        
        const textParts = text.split(':');
        // Make sure we have at least two parts (IV and encrypted data)
        if (textParts.length < 2) {
            console.log('Invalid encrypted format, not enough parts:', text);
            return text;
        }
        
        const iv = Buffer.from(textParts.shift(), 'hex');
        
        // Validate IV length
        if (iv.length !== IV_LENGTH) {
            console.log('Invalid IV length:', iv.length);
            return text;
        }
        
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

// Helper function to check if text is already encrypted
function isEncrypted(text) {
    if (typeof text !== 'string') return false;
    
    // Check if the text matches the pattern of hex:hex
    const parts = text.split(':');
    if (parts.length < 2) return false;
    
    const possibleIv = parts[0];
    
    // IV should be a hex string of the correct length (IV_LENGTH * 2 because hex)
    return /^[0-9a-f]+$/i.test(possibleIv) && possibleIv.length === IV_LENGTH * 2;
}

module.exports = {
    encrypt,
    decrypt,
    isEncrypted
};