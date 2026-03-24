#!/usr/bin/env node
/**
 * create-draft.js
 * Usage : node create-draft.js [nomEquipeBleu] [nomEquipeRouge]
 * Génère un lien bleu et rouge pour tester le draft sans le bot Discord.
 */
require('dotenv').config();

const teamBlueName = process.argv[2] || 'Équipe Bleue';
const teamRedName  = process.argv[3] || 'Équipe Rouge';
const BASE_URL     = process.env.DRAFT_BASE_URL || 'http://localhost:3000';

(async () => {
  let res;
  try {
    res = await fetch(`${BASE_URL}/api/draft/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamBlueName, teamRedName }),
    });
  } catch (err) {
    console.error('❌  Impossible de contacter le serveur. Lance d\'abord : npm start');
    console.error('   ', err.message);
    process.exit(1);
  }

  if (!res.ok) {
    console.error(`❌  Erreur API : ${res.status} ${res.statusText}`);
    process.exit(1);
  }

  const draft = await res.json();

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log(`║  Draft créé  —  ID : ${draft.draftId.slice(0, 8)}…`);
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  🔵 ${teamBlueName.padEnd(20)}`);
  console.log(`║     ${draft.blueUrl}`);
  console.log('║');
  console.log(`║  🔴 ${teamRedName.padEnd(20)}`);
  console.log(`║     ${draft.redUrl}`);
  console.log('║');
  console.log(`║  👁️  Spectateurs`);
  console.log(`║     ${draft.spectateUrl}`);
  console.log('║');
  console.log(`║  ⚙️  Admin (correction de draft)`);
  console.log(`║     ${draft.adminUrl}`);
  console.log('╚══════════════════════════════════════════════════╝\n');
})();
