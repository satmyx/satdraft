/* ── draft.js ──────────────────────────────────────────────────────────────── */
'use strict';

// ─── Champion roles map ────────────────────────────────────────────────────────
// champion DD id → primary roles (first = main)
const CHAMPION_ROLES = {
  Aatrox:['TOP'], Ahri:['MID'], Akali:['MID','TOP'], Akshan:['MID','ADC'],
  Alistar:['SUP'], Ambessa:['TOP'], Amumu:['JGL','SUP'], Anivia:['MID'],
  Annie:['MID','SUP'], Aphelios:['ADC'], Ashe:['ADC','SUP'], AurelionSol:['MID'],
  Aurora:['MID','TOP'], Azir:['MID'], Bard:['SUP'], BelVeth:['JGL'],
  Blitzcrank:['SUP'], Brand:['SUP','MID'], Braum:['SUP'], Briar:['JGL'],
  Caitlyn:['ADC'], Camille:['TOP'], Cassiopeia:['MID'], ChoGath:['TOP','SUP'],
  Corki:['MID'], Darius:['TOP'], Diana:['MID','JGL'], DrMundo:['TOP','JGL'],
  Draven:['ADC'], Ekko:['MID','JGL'], Elise:['JGL'], Evelynn:['JGL'],
  Ezreal:['ADC'], Fiddlesticks:['JGL','SUP'], Fiora:['TOP'], Fizz:['MID'],
  Galio:['MID','SUP'], Gangplank:['TOP'], Garen:['TOP'], Gnar:['TOP'],
  Gragas:['JGL','TOP'], Graves:['JGL'], Gwen:['TOP'], Hecarim:['JGL'],
  Heimerdinger:['MID','TOP'], Hwei:['MID','SUP'], Illaoi:['TOP'],
  Irelia:['TOP','MID'], Ivern:['JGL'], Janna:['SUP'], JarvanIV:['JGL'],
  Jax:['TOP','JGL'], Jayce:['TOP','MID'], Jhin:['ADC'], Jinx:['ADC'],
  KSante:['TOP'], Kaisa:['ADC'], Kalista:['ADC'], Karma:['SUP','MID'],
  Karthus:['JGL','MID'], Kassadin:['MID'], Katarina:['MID'], Kayle:['TOP','MID'],
  Kayn:['JGL'], Kennen:['TOP'], KhaZix:['JGL'], Kindred:['JGL'], Kled:['TOP'],
  KogMaw:['ADC'], LeBlanc:['MID'], LeeSin:['JGL'], Leona:['SUP'], Lillia:['JGL'],
  Lissandra:['MID'], Lucian:['ADC','MID'], Lulu:['SUP'], Lux:['SUP','MID'],
  Malphite:['TOP','SUP'], Malzahar:['MID'], Maokai:['TOP','SUP'],
  MasterYi:['JGL'], Mel:['MID'], Milio:['SUP'], MissFortune:['ADC'],
  MonkeyKing:['JGL','TOP'], Mordekaiser:['TOP'], Morgana:['SUP','MID'],
  Naafiri:['MID'], Nami:['SUP'], Nasus:['TOP'], Nautilus:['SUP'],
  Neeko:['MID','SUP'], Nidalee:['JGL'], Nilah:['ADC'], Nocturne:['JGL'],
  Nunu:['JGL'], Olaf:['JGL','TOP'], Orianna:['MID'], Ornn:['TOP'],
  Pantheon:['SUP','TOP','MID'], Poppy:['TOP','JGL'], Pyke:['SUP'],
  Qiyana:['MID'], Quinn:['TOP'], Rakan:['SUP'], Rammus:['JGL'],
  RekSai:['JGL'], Rell:['SUP'], RenataGlasc:['SUP'], Renekton:['TOP'],
  Rengar:['JGL','TOP'], Riven:['TOP'], Rumble:['TOP'], Ryze:['MID','TOP'],
  Samira:['ADC'], Sejuani:['JGL'], Senna:['SUP','ADC'], Seraphine:['SUP','MID'],
  Sett:['TOP','JGL'], Shaco:['JGL'], Shen:['TOP'], Shyvana:['JGL'],
  Singed:['TOP'], Sion:['TOP'], Sivir:['ADC'], Skarner:['JGL'],
  Smolder:['ADC'], Sona:['SUP'], Soraka:['SUP'], Swain:['SUP','MID'],
  Sylas:['MID','JGL'], Syndra:['MID'], TahmKench:['SUP','TOP'], Taliyah:['JGL','MID'],
  Talon:['MID','JGL'], Taric:['SUP'], Teemo:['TOP'], Thresh:['SUP'],
  Tristana:['ADC'], Trundle:['JGL','TOP'], Tryndamere:['TOP'],
  TwistedFate:['MID'], Twitch:['ADC'], Udyr:['JGL'], Urgot:['TOP'],
  Varus:['ADC'], Vayne:['ADC','TOP'], Veigar:['MID','SUP'], VelKoz:['SUP','MID'],
  Vex:['MID'], Vi:['JGL'], Viego:['JGL'], Viktor:['MID'], Vladimir:['MID','TOP'],
  Volibear:['TOP','JGL'], Warwick:['JGL'], Xayah:['ADC'], Xerath:['SUP','MID'],
  XinZhao:['JGL'], Yasuo:['MID','TOP'], Yone:['MID','TOP'], Yorick:['TOP'],
  Yuumi:['SUP'], Zac:['JGL'], Zed:['MID'], Zeri:['ADC'], Ziggs:['ADC','MID'],
  Zilean:['SUP'], Zoe:['MID'], Zyra:['SUP'],
};

// ─── Data Dragon helpers ──────────────────────────────────────────────────────
const DD_VERSION = '14.6.1';

let CHAMPIONS = []; // [{ id, name, key, tags, roles }]

async function fetchDDVersion() {
  try {
    const r = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
    const versions = await r.json();
    return versions[0];
  } catch { return DD_VERSION; }
}

async function fetchChampions(version) {
  const r = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/fr_FR/champion.json`);
  const json = await r.json();
  return Object.values(json.data).map(c => ({
    id:    c.id,
    name:  c.name,
    key:   c.key,
    tags:  c.tags || [],
    roles: CHAMPION_ROLES[c.id] || tagsToRoles(c.tags || []),
  })).sort((a, b) => a.name.localeCompare(b.name));
}

// Fallback: derive roles from Data Dragon tags for unlisted champions
function tagsToRoles(tags) {
  const r = new Set();
  if (!tags.length) return ['TOP'];
  const [p, s] = tags;
  if (p === 'Marksman') r.add('ADC');
  if (p === 'Support' || s === 'Support') r.add('SUP');
  if (p === 'Mage') { r.add('MID'); if (s === 'Support') r.add('SUP'); }
  if (p === 'Assassin') { r.add('MID'); r.add('JGL'); }
  if (p === 'Fighter') { r.add('TOP'); r.add('JGL'); }
  if (p === 'Tank') { r.add('TOP'); if (s === 'Support') r.add('SUP'); }
  return r.size ? [...r] : ['TOP'];
}

function champIcon(id, version) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${id}.png`;
}
function champSplash(id) {
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${id}_0.jpg`;
}

// ─── URL params ──────────────────────────────────────────────────────────────
const urlParams  = new URLSearchParams(window.location.search);
const draftId    = window.location.pathname.split('/draft/')[1];
const myToken    = urlParams.get('token') || '';
const myTeam     = urlParams.get('team')  || 'spectator';

// ─── State ───────────────────────────────────────────────────────────────────
let draftState    = null;
let selectedChamp = null;
let ddVersion     = DD_VERSION;
let ws            = null;
let myReady       = false;
let activeRole    = 'ALL';
let searchQuery   = '';
const animatedSlots = new Set();
const SVG_BAN_X = `<svg viewBox="0 0 20 20" fill="none" stroke="rgba(230,30,30,.95)" stroke-width="3.5" stroke-linecap="round" width="22" height="22" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15"/></svg>`;

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const overlay       = document.getElementById('overlay');
const overlayStatus = document.getElementById('overlay-status');
const teamBadge     = document.getElementById('team-badge');
const btnReady      = document.getElementById('btn-ready');
const waitingMsg    = document.getElementById('waiting-msg');
const appEl         = document.getElementById('app');

const blueTeamNameEl = document.getElementById('blue-team-name');
const redTeamNameEl  = document.getElementById('red-team-name');
const phaseLabel     = document.getElementById('phase-label');
const timerDisplay   = document.getElementById('timer-display');
const currentAction  = document.getElementById('current-action');

const blueBansRow    = document.getElementById('blue-bans-row');
const redBansRow     = document.getElementById('red-bans-row');
const bluePicksCol   = document.getElementById('blue-picks-col');
const redPicksCol    = document.getElementById('red-picks-col');
const championGrid   = document.getElementById('champion-grid');
const searchInput    = document.getElementById('search-input');
const btnLock        = document.getElementById('btn-lock');
const hoverName      = document.getElementById('hover-name');
const hoverPreview   = document.getElementById('hover-preview-footer');

// ─── Init ─────────────────────────────────────────────────────────────────────
(async () => {
  if (myTeam === 'blue') {
    teamBadge.textContent = '🔵 Équipe Bleue';
    teamBadge.className   = 'blue';
  } else if (myTeam === 'red') {
    teamBadge.textContent = '🔴 Équipe Rouge';
    teamBadge.className   = 'red';
  } else {
    teamBadge.textContent = '👁️ Spectateur';
  }

  overlayStatus.textContent = 'Chargement des champions…';
  try {
    ddVersion = await fetchDDVersion();
    CHAMPIONS = await fetchChampions(ddVersion);
    buildChampionGrid();
  } catch (err) {
    overlayStatus.textContent = 'Erreur chargement champions. Recharge la page.';
    console.error(err);
    return;
  }

  buildBanSlots();
  buildPickSlots();
  connectWebSocket();
})();

// ─── WebSocket ────────────────────────────────────────────────────────────────
function connectWebSocket() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const wsUrl  = `${proto}://${location.host}?draftId=${encodeURIComponent(draftId)}&token=${encodeURIComponent(myToken)}`;
  ws = new WebSocket(wsUrl);

  ws.addEventListener('open', () => {
    overlayStatus.textContent = 'Connecté !';
    if (myTeam !== 'spectator') {
      btnReady.classList.remove('hidden');
    } else {
      waitingMsg.textContent = 'Vous regardez en tant que spectateur…';
      waitingMsg.classList.remove('hidden');
    }
  });

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    handleServerMessage(msg);
  });

  ws.addEventListener('close', (ev) => {
    overlayStatus.textContent = `Déconnecté (${ev.code}). Rechargement…`;
    setTimeout(() => location.reload(), 3000);
  });

  ws.addEventListener('error', () => {
    overlayStatus.textContent = 'Erreur WebSocket. Rechargement…';
  });
}

function wsSend(obj) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

// ─── Server message handler ───────────────────────────────────────────────────
function handleServerMessage(msg) {
  if (msg.type === 'state') {
    draftState = msg.state;
    renderState();
    if (draftState.status === 'active')   hideOverlay();
    if (draftState.status === 'finished') { hideOverlay(); showFinished(); }
  }
  if (msg.type === 'hover') renderHover(msg.team, msg.champion);
  if (msg.type === 'timer') {
    timerDisplay.textContent = msg.value;
    timerDisplay.classList.toggle('urgent', msg.value <= 10);
  }
}

// ─── Render state ─────────────────────────────────────────────────────────────
function renderState() {
  if (!draftState) return;

  blueTeamNameEl.textContent = draftState.teamBlueName;
  redTeamNameEl.textContent  = draftState.teamRedName;

  const step = draftState.sequence[draftState.step];
  if (step) {
    const stepIdx = draftState.step;
    let phaseTxt;
    if      (stepIdx <  6) phaseTxt = 'Phase 1 — Bans';
    else if (stepIdx < 12) phaseTxt = 'Phase 1 — Picks';
    else if (stepIdx < 16) phaseTxt = 'Phase 2 — Bans';
    else                   phaseTxt = 'Phase 2 — Picks';

    phaseLabel.textContent   = phaseTxt;
    const teamLabel = step.team === 'blue' ? draftState.teamBlueName : draftState.teamRedName;
    const actionTxt = step.phase === 'ban' ? '— BAN' : '— PICK';
    currentAction.textContent = `${teamLabel} ${actionTxt}`;
    timerDisplay.textContent  = draftState.timerValue;
    timerDisplay.classList.toggle('urgent', draftState.timerValue <= 10);
  } else {
    phaseLabel.textContent    = 'Draft terminé';
    currentAction.textContent = '';
  }

  renderBanSlots();
  renderPickSlots();
  updateChampionAvailability();
  updateLockButton();
}

// ─── Build DOM – ban slots ────────────────────────────────────────────────────
function buildBanSlots() {
  // Blue bans label + row
  blueBansRow.innerHTML = `<div class="bans-label">Bans ${draftState ? draftState.teamBlueName : 'Bleus'}</div><div class="bans-row" id="blue-ban-icons"></div>`;
  for (let i = 0; i < 5; i++) {
    const div = document.createElement('div');
    div.className = 'ban-slot';
    div.id = `slot-ban-blue-${i}`;
    document.getElementById('blue-ban-icons')?.appendChild(div) || blueBansRow.appendChild(div);
  }

  redBansRow.innerHTML = `<div class="bans-label">Bans ${draftState ? draftState.teamRedName : 'Rouges'}</div><div class="bans-row" id="red-ban-icons"></div>`;
  for (let i = 0; i < 5; i++) {
    const div = document.createElement('div');
    div.className = 'ban-slot';
    div.id = `slot-ban-red-${i}`;
    document.getElementById('red-ban-icons')?.appendChild(div) || redBansRow.appendChild(div);
  }
}

function renderBanSlots() {
  if (!draftState) return;
  const step = draftState.sequence[draftState.step];

  // Update labels if team names known
  const blueLabel = blueBansRow.querySelector('.bans-label');
  const redLabel  = redBansRow.querySelector('.bans-label');
  if (blueLabel) blueLabel.textContent = `Bans ${draftState.teamBlueName}`;
  if (redLabel)  redLabel.textContent  = `Bans ${draftState.teamRedName}`;

  document.querySelectorAll('.ban-slot').forEach(el => {
    el.classList.remove('active', 'filled');
    el.innerHTML = '';
  });

  for (const [slotKey, slotData] of Object.entries(draftState.slots)) {
    if (!slotKey.startsWith('ban-')) continue;
    const parts = slotKey.split('-');
    const el = document.getElementById(`slot-ban-${parts[1]}-${parts[2]}`);
    if (!el) continue;
    el.classList.add('filled');
    const champ = findChamp(slotData.champion);
    if (champ) {
      el.innerHTML = `<img src="${champIcon(champ.id, ddVersion)}" alt="${champ.name}" title="${champ.name}" /><div class="ban-x">${SVG_BAN_X}</div>`;
    } else {
      el.innerHTML = `<div class="ban-x">${SVG_BAN_X}</div>`;
    }
    // Animate if newly banned
    if (!animatedSlots.has(slotKey)) {
      animatedSlots.add(slotKey);
      el.classList.add('ban-in');
      el.addEventListener('animationend', () => el.classList.remove('ban-in'), { once: true });
      const champEl = championGrid.querySelector(`[data-id="${slotData.champion}"]`);
      if (champEl) {
        champEl.classList.add('banned-anim');
        champEl.addEventListener('animationend', () => champEl.classList.remove('banned-anim'), { once: true });
      }
    }
  }

  if (step && step.phase === 'ban') {
    const parts = step.slot.split('-');
    const el = document.getElementById(`slot-ban-${parts[1]}-${parts[2]}`);
    if (el && !el.classList.contains('filled')) el.classList.add('active');
  }
}

// ─── Build DOM – pick slots ───────────────────────────────────────────────────
function buildPickSlots() {
  bluePicksCol.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const div = document.createElement('div');
    div.className = 'pick-slot blue';
    div.id = `slot-pick-blue-${i}`;
    div.innerHTML = `<div class="pick-number">${i + 1}</div><div class="empty-label">Pick ${i + 1}</div>`;
    bluePicksCol.appendChild(div);
  }
  redPicksCol.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const div = document.createElement('div');
    div.className = 'pick-slot red';
    div.id = `slot-pick-red-${i}`;
    div.innerHTML = `<div class="pick-number">${i + 1}</div><div class="empty-label">Pick ${i + 1}</div>`;
    redPicksCol.appendChild(div);
  }
}

function renderPickSlots() {
  if (!draftState) return;
  const step = draftState.sequence[draftState.step];

  document.querySelectorAll('.pick-slot').forEach(el => {
    el.classList.remove('active');
    const idx  = el.id.split('-')[3];
    el.innerHTML = `<div class="pick-number">${Number(idx) + 1}</div><div class="empty-label">Pick ${Number(idx) + 1}</div>`;
  });

  for (const [slotKey, slotData] of Object.entries(draftState.slots)) {
    if (!slotKey.startsWith('pick-')) continue;
    const parts = slotKey.split('-');
    const el    = document.getElementById(`slot-pick-${parts[1]}-${parts[2]}`);
    if (!el) continue;
    const champ = findChamp(slotData.champion);
    if (champ) {
      el.innerHTML = `
        <img src="${champSplash(champ.id)}" alt="${champ.name}" />
        <div class="pick-number">${Number(parts[2]) + 1}</div>
        <div class="pick-name">${champ.name}</div>`;
      if (!animatedSlots.has(slotKey)) {
        animatedSlots.add(slotKey);
        el.classList.add('pick-in');
        el.addEventListener('animationend', () => el.classList.remove('pick-in'), { once: true });
        // Flash l'icône dans la grille (comme le ban)
        const champGridEl = championGrid.querySelector(`[data-id="${slotData.champion}"]`);
        if (champGridEl) {
          champGridEl.classList.add('picked-anim');
          champGridEl.addEventListener('animationend', () => champGridEl.classList.remove('picked-anim'), { once: true });
        }
      }
    }
  }

  if (step && step.phase === 'pick') {
    const parts = step.slot.split('-');
    const el = document.getElementById(`slot-pick-${parts[1]}-${parts[2]}`);
    if (el) el.classList.add('active');
  }
}

// ─── Hover preview ────────────────────────────────────────────────────────────
function renderHover(team, championId) {
  if (!draftState) return;
  const step = draftState.sequence[draftState.step];
  if (!step || step.team !== team || step.phase !== 'pick') return;

  const parts = step.slot.split('-');
  const el    = document.getElementById(`slot-pick-${parts[1]}-${parts[2]}`);
  if (!el) return;

  if (championId) {
    const champ = findChamp(championId);
    if (champ) {
      el.innerHTML = `
        <img class="hover-preview" src="${champSplash(champ.id)}" alt="${champ.name}" />
        <div class="pick-number">${Number(parts[2]) + 1}</div>
        <div class="pick-name">${champ.name}</div>`;
    }
  } else {
    const idx = parts[2];
    el.innerHTML = `<div class="pick-number">${Number(idx) + 1}</div><div class="empty-label">Pick ${Number(idx) + 1}</div>`;
  }
}

// ─── Champion grid ────────────────────────────────────────────────────────────
function buildChampionGrid() {
  championGrid.innerHTML = '';
  for (const champ of CHAMPIONS) {
    const div = document.createElement('div');
    div.className = 'champ-icon';
    div.dataset.id   = champ.id;
    div.dataset.name = champ.name.toLowerCase();
    div.dataset.roles = champ.roles.join(',');
    div.title = champ.name;
    div.innerHTML = `
      <img src="${champIcon(champ.id, ddVersion)}" alt="${champ.name}" loading="lazy" />
      <div class="champ-tooltip">${champ.name}</div>`;
    div.addEventListener('click', () => onChampClick(champ.id));
    championGrid.appendChild(div);
  }
  applyFilters();
}

function applyFilters() {
  const q = searchQuery.toLowerCase().trim();
  document.querySelectorAll('.champ-icon').forEach(el => {
    const nameMatch = !q || el.dataset.name.includes(q);
    const roleMatch = activeRole === 'ALL' || el.dataset.roles.split(',').includes(activeRole);
    el.style.display = (nameMatch && roleMatch) ? '' : 'none';
  });
}

function updateChampionAvailability() {
  if (!draftState) return;
  const step = draftState.sequence[draftState.step];
  const isMyTurn = step && step.team === myTeam && myTeam !== 'spectator' && draftState.status === 'active';

  document.querySelectorAll('.champ-icon').forEach(el => {
    const id = el.dataset.id;
    el.classList.remove('banned', 'picked', 'selected', 'dimmed');

    for (const [slotKey, slotData] of Object.entries(draftState.slots)) {
      if (slotData.champion === id) {
        el.classList.add(slotKey.startsWith('ban-') ? 'banned' : 'picked');
        return;
      }
    }

    if (id === selectedChamp) { el.classList.add('selected'); return; }
    if (!isMyTurn)              el.classList.add('dimmed');
  });
}

function onChampClick(id) {
  if (!draftState || draftState.status !== 'active') return;
  const step = draftState.sequence[draftState.step];
  if (!step || step.team !== myTeam) return;

  const usedIds = new Set(Object.values(draftState.slots).map(s => s.champion));
  if (usedIds.has(id)) return;

  // Animate selection flash
  const prevEl = championGrid.querySelector('.select-anim');
  if (prevEl) prevEl.classList.remove('select-anim');
  const newEl = championGrid.querySelector(`[data-id="${id}"]`);
  if (newEl) {
    void newEl.offsetWidth; // restart animation
    newEl.classList.add('select-anim');
    newEl.addEventListener('animationend', () => newEl.classList.remove('select-anim'), { once: true });
  }

  selectedChamp = id;
  updateChampionAvailability();

  const champ = findChamp(id);
  hoverName.textContent = champ ? champ.name : id;
  btnLock.disabled = false;

  // Footer preview
  if (hoverPreview) {
    if (champ) {
      hoverPreview.innerHTML = `<img src="${champIcon(champ.id, ddVersion)}" alt="${champ.name}" />`;
    }
  }

  wsSend({ type: 'hover', champion: id });
}

function updateLockButton() {
  if (!draftState) return;
  const step = draftState.sequence[draftState.step];
  const isMyTurn = step && step.team === myTeam && myTeam !== 'spectator' && draftState.status === 'active';
  btnLock.disabled = !(isMyTurn && selectedChamp);
}

// ─── Events ───────────────────────────────────────────────────────────────────
btnReady.addEventListener('click', () => {
  if (myReady) return;
  myReady = true;
  btnReady.disabled = true;
  btnReady.textContent = '✓ Prêt !';
  waitingMsg.classList.remove('hidden');
  wsSend({ type: 'ready' });
});

btnLock.addEventListener('click', () => {
  if (!selectedChamp) return;
  // Lock flash animation
  btnLock.classList.remove('lock-flash');
  void btnLock.offsetWidth;
  btnLock.classList.add('lock-flash');
  btnLock.addEventListener('animationend', () => btnLock.classList.remove('lock-flash'), { once: true });
  wsSend({ type: 'lock', champion: selectedChamp });
  selectedChamp = null;
  hoverName.textContent = '';
  if (hoverPreview) hoverPreview.innerHTML = '';
  btnLock.disabled = true;
});

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value;
  applyFilters();
});

// Role filter buttons
document.querySelectorAll('.role-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeRole = btn.dataset.role;
    applyFilters();
  });
});

// ─── Overlay helpers ──────────────────────────────────────────────────────────
function hideOverlay() {
  overlay.style.display = 'none';
  appEl.classList.remove('hidden');
}

function showFinished() {
  let banner = document.getElementById('finished-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'finished-banner';
    banner.innerHTML = `<div class="box">
      <h2>✅ Draft terminé !</h2>
      <p>Les deux équipes ont finalisé leur sélection.</p>
    </div>`;
    document.body.appendChild(banner);
  }
  banner.classList.add('show');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function findChamp(id) {
  return CHAMPIONS.find(c => c.id === id) || null;
}
