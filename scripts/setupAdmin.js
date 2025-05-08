const bcrypt = require('bcryptjs');
const fs = require('fs').promises;
const path = require('path');

const ADMIN_FILE = path.join(__dirname, '../data/admin.json');

async function setupAdmin() {
  try {
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    // Create admin data
    const adminData = {
      admin: {
        username: 'admin',
        password: hashedPassword,
        lastLogin: null
      }
    };

    // Write to file
    await fs.writeFile(ADMIN_FILE, JSON.stringify(adminData, null, 2));
    console.log('Admin password has been properly hashed and saved!');
  } catch (error) {
    console.error('Error setting up admin:', error);
  }
}

setupAdmin(); 