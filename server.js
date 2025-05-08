const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { PORT } = require('./config/config');

// Import routes
const adminRoutes = require('./routes/admin');
const pageRoutes = require('./routes/pageRoutes');
const contactRoutes = require('./routes/contact');

const app = express();

// CORS configuration - MUST BE BEFORE OTHER MIDDLEWARE
app.use(cors({
    origin: '*', // Allow all origins in development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// API Routes
app.use('/api/admin', adminRoutes);
app.use('/api/contact', contactRoutes);

// Page Routes
app.use('/', pageRoutes);

// Admin Dashboard Route
app.get('/admin/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/admin/dashboard.html'));
});

// Admin Login Route
app.get('/adminlogin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/adminlogin.html'));
});

// Catch-all route for frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Website available at: http://localhost:${PORT}`);
}); 