require('dotenv').config();
const fs = require('fs');
const { syncSlotsFromSheet } = require('./src/services/googleSheets.service');
const ProfessionalsService = require('./src/services/professionals.service');

async function run() {
  await syncSlotsFromSheet();
  const profs = ProfessionalsService.getProfessionals();
  fs.writeFileSync('profs.json', JSON.stringify(profs, null, 2));
}

run().catch(console.error);
