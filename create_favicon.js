// This script will create a simple favicon for OTM Education
const fs = require('fs');
const { createCanvas } = require('canvas');

// Create a 32x32 canvas for the favicon
const canvas = createCanvas(32, 32);
const ctx = canvas.getContext('2d');

// Fill the background with a blue gradient
const gradient = ctx.createLinearGradient(0, 0, 32, 32);
gradient.addColorStop(0, '#003f88');  // Dark blue
gradient.addColorStop(1, '#00b4d8');  // Light blue
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 32, 32);

// Add "OTM" text
ctx.fillStyle = 'white';
ctx.font = 'bold 14px Arial';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('OTM', 16, 16);

// Create a data URL of the favicon
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('favicon.ico', buffer);

console.log('Favicon created successfully!'); 