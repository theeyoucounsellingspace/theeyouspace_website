require('dotenv').config({ path: './backend/.env' });
const { syncSlotsFromSheet } = require('./backend/src/services/googleSheets.service');
const AvailabilitySlot = require('./backend/src/models/AvailabilitySlot');

async function check() {
    console.log('--- Checking Sheet Sync ---');
    const result = await syncSlotsFromSheet();
    console.log('Sync Result:', result);
    
    const slots = AvailabilitySlot.getAllIncludingBooked();
    console.log('\n--- Internal Slots Cache ---');
    slots.forEach(s => {
        console.log(`[${s.available ? 'AVAIL' : 'BOOKED'}] Pro: "${s.professional}", Date: "${s.date}", Time: "${s.time}"`);
    });
}

check().catch(console.error);
