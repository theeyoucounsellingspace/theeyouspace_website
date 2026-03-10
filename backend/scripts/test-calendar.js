/**
 * Smoke test: verify Google Calendar API is reachable and the service account
 * can create events on the configured calendar (GOOGLE_CALENDAR_ID).
 *
 * Usage: node backend/scripts/test-calendar.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') })
const { createMeetEvent } = require('../src/services/calendarMeet.service')
const Booking = require('../src/models/Booking')

async function main() {
    const calId = process.env.GOOGLE_CALENDAR_ID
    if (!calId) {
        console.error('❌ GOOGLE_CALENDAR_ID not set in .env')
        process.exit(1)
    }
    console.log(`📅 Calendar ID: ${calId}\n`)

    // Build a fake booking 1 hour from now
    const soon = new Date(Date.now() + 60 * 60 * 1000) // +1hr
    const day = soon.getDate()
    const month = soon.getMonth() + 1
    const year = soon.getFullYear()
    const hours = soon.getHours()
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const h12 = hours % 12 || 12
    const mins = String(soon.getMinutes()).padStart(2, '0')

    const fakeBooking = {
        id: 'TYS-TEST-001',
        name: 'Test Patient',
        email: process.env.SMTP_USER || 'test@example.com',
        sessionType: 'normal',
        professional: 'Jeevan KJ',
        meetUrl: null,
        selectedSlot: {
            date: `${day}/${month}/${year}`,
            time: `${h12}:${mins} ${ampm}`,
            professional: 'Jeevan KJ',
        },
    }

    console.log(`🧪 Creating test event for slot: ${fakeBooking.selectedSlot.date} @ ${fakeBooking.selectedSlot.time}`)
    console.log(`   Attendee email: ${fakeBooking.email}\n`)

    const meetUrl = await createMeetEvent(fakeBooking)

    if (meetUrl) {
        console.log('\n✅ SUCCESS!')
        console.log(`   Meet URL: ${meetUrl}`)
        console.log('\n   Check the calendar — you should see a test event. You can delete it.')
    } else {
        console.log('\n❌ createMeetEvent returned null — check the error logs above.')
        process.exit(1)
    }
}

main().catch(err => {
    console.error('\n❌ Uncaught error:', err.message)
    process.exit(1)
})
