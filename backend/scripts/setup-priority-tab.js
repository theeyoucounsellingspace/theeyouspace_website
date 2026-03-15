const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Manually load env from .env file
const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value.length) {
        process.env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
    }
});

async function getAccessToken() {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!email || !rawKey) throw new Error('Creds missing: ' + email + ' | ' + (rawKey ? 'key-present' : 'key-missing'));
    
    // Formatting key
    const privateKey = rawKey.replace(/\\n/g, '\n');
    
    const now = Math.floor(Date.now() / 1000);
    const payload = { iss: email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now };
    const h = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const b = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sign = crypto.createSign('RSA-SHA256').update(`${h}.${b}`);
    const jwt = `${h}.${b}.${sign.sign(privateKey, 'base64url')}`;
    const body = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }).toString();
    
    return new Promise((res, rej) => {
        const req = https.request({ hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }}, 
        r => { let d=''; r.on('data', c=>d+=c); r.on('end', () => res(JSON.parse(d).access_token))});
        req.on('error', rej); req.write(body); req.end();
    });
}

async function run() {
    console.log('--- CREATING PRIORITYSLOTS TAB ---');
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const token = await getAccessToken();

    // 1. Create the tab
    const createReq = { requests: [{ addSheet: { properties: { title: 'PrioritySlots' } } }] };
    console.log('Sending request to create PrioritySlots tab...');
    
    const res1 = await new Promise((res, rej) => {
        const req = https.request({ hostname: 'sheets.googleapis.com', path: `/v4/spreadsheets/${sheetId}:batchUpdate`, method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }}, 
        r => { let d=''; r.on('data', c=>d+=c); r.on('end', () => res(JSON.parse(d)))});
        req.write(JSON.stringify(createReq)); req.end();
    });
    
    if (res1.error && res1.error.message.includes('already exists')) {
        console.log('PrioritySlots tab already exists. Proceeding to update values.');
    } else if (res1.error) {
        console.error('Error creating tab:', res1.error.message);
    } else {
        console.log('Tab created successfully.');
    }

    // 2. Add Headers and Test Data
    const values = [
        ['Professional', 'Date', 'Time'],
        ['Nivetha Pandian', '2026-03-25', '11:00 AM']
    ];
    const updateReq = { values };
    
    console.log('Adding headers and test data...');
    const res2 = await new Promise((res, rej) => {
        const req = https.request({ hostname: 'sheets.googleapis.com', path: `/v4/spreadsheets/${sheetId}/values/PrioritySlots!A1?valueInputOption=RAW`, method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }}, 
        r => { let d=''; r.on('data', c=>d+=c); r.on('end', () => res(JSON.parse(d)))});
        req.write(JSON.stringify(updateReq)); req.end();
    });
    
    if (res2.error) {
        console.error('Error updating values:', res2.error.message);
    } else {
        console.log('Values updated successfully:', res2.updatedCells, 'cells updated.');
    }
    
    console.log('--- DONE ---');
}

run().catch(e => console.error('Fatal error:', e.message));
