// server.js
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { PORT } = require('./config/config');
const { startEmailFetching } = require('./services/emailFetchService');
const { validateEmailConfig } = require('./services/emailService');

// Import routes
const adminRoutes = require('./routes/admin');
const contactRoutes = require('./routes/contact');

// Initialize express app
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

// Static files - serve from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// API Routes
app.use('/api/admin', adminRoutes);
app.use('/api/contact', contactRoutes);

// Admin Login Route - Serve EJS template
app.get('/adminlogin', (req, res) => {
    res.render('adminlogin');
});

// Admin Dashboard Route - Serve EJS template
app.get('/admin/dashboard', (req, res) => {
    res.render('dashboard');
});

// Main website route - Serve the static HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Catch-all route for frontend - Serve the static HTML file for all other routes
app.get('*', (req, res) => {
    // Check if request is for admin routes
    if (req.path.startsWith('/admin')) {
        return res.redirect('/adminlogin');
    }
    
    // Otherwise serve the main website
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    res.status(500).send('Something went wrong!');
});

// Start server
async function startServer() {
    try {
        // Validate email configuration
        const emailConfigValid = await validateEmailConfig();
        
        // Start server
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
            console.log(`Website available at: http://localhost:${PORT}`);
            
            // Start email fetching service if email config is valid
            if (emailConfigValid) {
                console.log('Starting email fetching service...');
                startEmailFetching();
            } else {
                console.warn('Email configuration is invalid. Email fetching service will not start.');
                console.warn('Please check your .env file and ensure EMAIL_USER and EMAIL_PASSWORD are properly set.');
            }
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer();