require('dotenv').config({ path: './backend/.env' });
const Booking = require('./backend/src/models/Booking');
const { restoreBookingsFromSheet } = require('./backend/src/services/sheetWriteback.service');

async function check() {
    console.log('Bookings in memory:', Booking.getAll().length);
    const count = await restoreBookingsFromSheet();
    console.log('Restored count:', count);
    console.log('Total bookings after restore:', Booking.getAll().length);
    const all = Booking.getAll();
    if (all.length > 0) {
        console.log('Sample Booking:', JSON.stringify(all[0], null, 2));
    }
}

check().catch(e => console.error(e));
