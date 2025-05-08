const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/config');

const ADMIN_FILE = path.join(__dirname, '../data/admin.json');

const readAdminData = async () => {
  try {
    const data = await fs.readFile(ADMIN_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading admin data:', error);
    return null;
  }
};

const writeAdminData = async (data) => {
  try {
    await fs.writeFile(ADMIN_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing admin data:', error);
    return false;
  }
};

const verifyAdmin = async (username, password) => {
  const data = await readAdminData();
  if (!data || !data.admin) return false;

  const isMatch = await bcrypt.compare(password, data.admin.password);
  if (!isMatch) return false;

  // Update last login
  data.admin.lastLogin = new Date().toISOString();
  await writeAdminData(data);

  return true;
};

const generateToken = (username) => {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
};

module.exports = {
  verifyAdmin,
  generateToken
}; 