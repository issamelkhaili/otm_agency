require('dotenv').config();
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

// Paths
const REPORT_DIR = path.join(__dirname, '../data');
const FINAL_REPORT = path.join(REPORT_DIR, 'email-diagnosis-report.txt');

// Make sure the report directory exists
async function ensureReportDir() {
    try {
        await fs.access(REPORT_DIR);
    } catch (error) {
        await fs.mkdir(REPORT_DIR, { recursive: true });
    }
}

// Execute a script and return the output
function executeScript(scriptPath) {
    return new Promise((resolve, reject) => {
        console.log(`Executing: ${scriptPath}`);
        
        const child = exec(`node ${scriptPath}`, {
            cwd: path.dirname(scriptPath)
        });
        
        let output = '';
        
        child.stdout.on('data', (data) => {
            output += data;
            process.stdout.write(data);
        });
        
        child.stderr.on('data', (data) => {
            output += data;
            process.stderr.write(data);
        });
        
        child.on('close', (code) => {
            if (code === 0) {
                resolve(output);
            } else {
                reject(new Error(`Script execution failed with code ${code}`));
            }
        });
    });
}

// Main function to run all diagnostics
async function runDiagnostics() {
    try {
        await ensureReportDir();
        
        // Write header to final report
        await fs.writeFile(FINAL_REPORT, `Email System Diagnosis Report
Generated: ${new Date().toISOString()}
==============================================\n\n`);
        
        // Step 1: Run contact diagnostics
        await appendToReport('STEP 1: Analyzing existing contacts in database');
        await appendToReport('Running contact analysis...');
        try {
            await executeScript(path.join(__dirname, 'check-stored-contacts.js'));
            await appendToReport('Contact analysis completed successfully.');
        } catch (error) {
            await appendToReport(`Error in contact analysis: ${error.message}`);
        }
        
        // Step 2: Check email server
        await appendToReport('\nSTEP 2: Checking email server connection');
        try {
            await executeScript(path.join(__dirname, 'check-emails.js'));
            await appendToReport('Email server check completed successfully.');
        } catch (error) {
            await appendToReport(`Error in email server check: ${error.message}`);
        }
        
        // Step 3: Combine results and analyze
        await appendToReport('\nSTEP 3: Generating final analysis');
        
        // Read logs
        const contactLogPath = path.join(REPORT_DIR, 'contact-diagnosis.log');
        const emailDebugPath = path.join(REPORT_DIR, 'email-debug.log');
        
        let contactLog = '';
        let emailDebug = '';
        
        try {
            contactLog = await fs.readFile(contactLogPath, 'utf8');
        } catch (error) {
            await appendToReport('Could not read contact diagnosis log.');
        }
        
        try {
            emailDebug = await fs.readFile(emailDebugPath, 'utf8');
        } catch (error) {
            await appendToReport('Could not read email debug log.');
        }
        
        // Extract and analyze issues
        const issues = [];
        
        // Look for potential issues in contact log
        if (contactLog) {
            // Check for encryption-related issues
            if (contactLog.includes('DECRYPTION ERROR')) {
                issues.push('CRITICAL: Decryption errors found in stored contacts');
            }
            
            // Check for HTML content handling issues
            if (contactLog.includes('Content type: Contains HTML') && 
                !contactLog.includes('Has displayContent: YES')) {
                issues.push('HIGH: HTML content found but no displayContent field - may indicate improper rendering');
            }
            
            // Check for encryption consistency
            if (contactLog.includes('Content encryption: NO')) {
                issues.push('MEDIUM: Some responses are not encrypted');
            }
            
            // Check for service provider emails
            if (contactLog.includes('gmail.com')) {
                const gmailPercentage = contactLog.match(/gmail\.com: (\d+) \((\d+)%\)/);
                if (gmailPercentage && Number(gmailPercentage[2]) > 0) {
                    issues.push(`INFO: ${gmailPercentage[1]} Gmail users (${gmailPercentage[2]}% of contacts)`);
                }
            }
        }
        
        // Look for issues in email debug log
        if (emailDebug) {
            // Check for connection issues
            if (emailDebug.includes('IMAP connection error')) {
                issues.push('CRITICAL: IMAP connection errors detected');
            }
            
            // Check for HTML content
            if (emailDebug.includes('Content types: HTML')) {
                issues.push('MEDIUM: HTML content detected in emails');
            }
            
            // Check for email format parsing issues
            if (emailDebug.includes('Error processing email')) {
                issues.push('HIGH: Email processing errors detected');
            }
        }
        
        // Write analysis to report
        if (issues.length > 0) {
            await appendToReport('\nPOTENTIAL ISSUES DETECTED:');
            for (const issue of issues) {
                await appendToReport(`- ${issue}`);
            }
        } else {
            await appendToReport('\nNo significant issues detected.');
        }
        
        // Add recommendations
        await appendToReport('\nRECOMMENDATIONS:');
        await appendToReport('1. Check if email encryption services are properly configured');
        await appendToReport('2. Ensure HTML content is properly processed for display');
        await appendToReport('3. Verify email credentials and server settings');
        await appendToReport('4. Make sure the renderMessage function displays email content correctly');
        await appendToReport('5. Confirm that displayContent field is being set for all responses');
        
        await appendToReport('\nDiagnosis complete. See the following files for detailed logs:');
        await appendToReport(`- Contact analysis: ${contactLogPath}`);
        await appendToReport(`- Email server check: ${emailDebugPath}`);
        await appendToReport(`- Combined report: ${FINAL_REPORT}`);
        
        console.log(`\nDiagnosis complete. Full report saved to: ${FINAL_REPORT}`);
    } catch (error) {
        console.error('Error running diagnostics:', error);
    }
}

// Helper to append to the final report
async function appendToReport(text) {
    console.log(text);
    await fs.appendFile(FINAL_REPORT, text + '\n');
}

// Run the diagnostics
runDiagnostics(); 