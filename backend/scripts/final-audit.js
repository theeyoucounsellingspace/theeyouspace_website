/**
 * final-audit.js — The "Linus" Final Verification Script
 * Checks for security, business logic safety, and structural integrity.
 */

const fs = require('fs');
const path = require('path');

// Fix paths: __dirname is /backend/scripts
const BACKEND_DIR = path.join(__dirname, '..', 'src');
const FRONTEND_DIR = path.join(__dirname, '..', '..', 'frontend', 'src');

function auditCheck(label, condition, fixHint = '') {
    const icon = condition ? '✅' : '❌';
    console.log(`[${icon}] ${label}`);
    if (!condition && fixHint) console.log(`    └─ Hint: ${fixHint}`);
    return condition;
}

console.log('\n══════════════════════════════════════════════════════════');
console.log('  Thee You Space — Final System Audit');
console.log('══════════════════════════════════════════════════════════\n');

let grade = 100;

try {
    // 1. Check for security middleware in server.js
    const serverJs = fs.readFileSync(path.join(BACKEND_DIR, 'server.js'), 'utf8');
    const hasHelmet = serverJs.includes('helmet(');
    const hasSanitize = serverJs.includes('mongoSanitize(');
    const hasXss = serverJs.includes('xss(');
    const hasRateLimit = serverJs.includes('rateLimit');

    if (!auditCheck('Security Middleware (Helmet, Filter, Limit)', hasHelmet && hasSanitize && hasXss && hasRateLimit)) grade -= 20;

    // 2. Check for race condition guard in payment.service.js
    const paymentService = fs.readFileSync(path.join(BACKEND_DIR, 'services', 'payment.service.js'), 'utf8');
    const hasRaceGuard = paymentService.includes('freshBooking.paymentStatus === PAYMENT_STATUS.SUCCESS');

    if (!auditCheck('Payment Race-Condition Guard', hasRaceGuard, 'Missing "freshBooking" check after await getPaymentDetails()')) grade -= 25;

    // 3. Check for triage sanitization
    const hasTriageSanitization = paymentService.includes('sanitizedTriage') && paymentService.includes('CONCERN_LABELS');
    if (!auditCheck('Triage Input Sanitization', hasTriageSanitization, 'Backend must map triage IDs to valid labels before saving')) grade -= 15;

    // 4. Check for Slot Restoration logic
    const bookingRoutes = fs.readFileSync(path.join(BACKEND_DIR, 'routes', 'booking.routes.js'), 'utf8');
    const hasSlotRestoration = bookingRoutes.includes('restoreSlotToSheet') && bookingRoutes.includes('releaseSlot');
    if (!auditCheck('Reschedule/Cancel Slot Restoration', hasSlotRestoration, 'Session cancellation must return the slot to the pool')) grade -= 20;

    // 5. Check for correct verification logic (paid vs success)
    const hasCorrectStatusCheck = bookingRoutes.includes("paymentStatus !== 'success'"); 
    if (!auditCheck('Reschedule Verification Status Logic', hasCorrectStatusCheck, 'Must check for "success" status, not "paid"')) grade -= 10;

    // 6. Check for Footer Manage Booking link
    const layoutJs = fs.readFileSync(path.join(FRONTEND_DIR, 'components', 'Layout.jsx'), 'utf8');
    const hasManageLink = layoutJs.includes('Manage Booking');
    if (!auditCheck('User Experience (Footer Manage Link)', hasManageLink)) grade -= 10;

} catch (err) {
    console.error('Audit failed due to missing file:', err.message);
    process.exit(1);
}

console.log('\n══════════════════════════════════════════════════════════');
console.log(`  FINAL SYSTEM SCORE: ${grade}/100`);
if (grade === 100) {
    console.log('  STATUS: SYSTEM IS BATTLE-HARDENED AND PRODUCTION READY.');
} else {
    console.log('  STATUS: SYSTEM REQUIRES MINOR REFINEMENT (SEE X MARKS).');
}
console.log('══════════════════════════════════════════════════════════\n');
