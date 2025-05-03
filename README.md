# OTM Education Website

Website for OTM Education, providing services for international students in France.

## Project Structure

This is a static website with a simple Express server for Heroku deployment:

- `index.html` - Main website content
- `assets/` - Static assets (CSS, JavaScript, images)
- `server.js` - Express server for deployment
- `favicon.ico` - Basic favicon

## Favicon

A basic favicon has been added to the website. To improve it:

1. Create a better quality favicon:
   - Use a tool like [favicon.io](https://favicon.io/) or [RealFaviconGenerator](https://realfavicongenerator.net/)
   - Upload your logo/icon
   - Download the generated favicon package
   - Replace the existing favicon.ico file
   - Replace apple-touch-icon.png (needs to be created)

2. For a full favicon set with different sizes and formats:
   - Generate a complete set including:
     - favicon.ico
     - apple-touch-icon.png
     - android-chrome-192x192.png
     - android-chrome-512x512.png
     - favicon-16x16.png
     - favicon-32x32.png
     - site.webmanifest
   - Add the appropriate HTML tags to index.html

## Deployment

This site is configured for deployment on Heroku:

1. The Express server (server.js) serves the static files
2. Procfile tells Heroku how to run the application
3. package.json defines the dependencies and Node.js version

## Local Development

To run the site locally:

```bash
npm install
npm start
```

Then visit http://localhost:3000 in your browser. 