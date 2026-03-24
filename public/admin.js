/* ── admin.js ──────────────────────────────────────────────────────────────── */
'use strict';

const urlParams  = new URLSearchParams(window.location.search);
const draftId    = window.location.pathname.split('/admin/')[1];
const adminToken = urlParams.get('token');

const DD_VERSION = '14.6.1';
let ddVersion  = DD_VERSION;
let CHAMPIONS  = [];
let draftState = null;
let editingSlot = null;
let modalSearch = '';

// ─── Init ─────────────────────────────────────────────────────────────────────
(async () => {
  if (!draftId || !adminToken) {
    document.body.innerHTML = '<p style="color:#e84057;padding:40px;font-size:1.1rem">❌ URL invalide — token admin manquant.</p>';
    return;
  }

  try {
    const r = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
    const versions = await r.json();
    ddVersion = versions[0];
  } catch {}

  try {
    const r = await fetch(`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/data/fr_FR/champion.json`);
    const json = await r.json();
    CHAMPIONS = Object.values(json.data)
      .map(c => ({ id: c.id, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    showToast('Erreur chargement des champions.', 'err');
    return;
  }

  await loadState();
  render();
})();

// ─── State ────────────────────────────────────────────────────────────────────
async function loadState() {
  const r = await fetch(`/api/draft/${draftId}`);
  if (!r.ok) { showToast('Draft introuvable.', 'err'); return; }
  draftState = await r.json();
}

// ─── Render ───────────────────────────────────────────────────────────────────
function render() {
  if (!draftState) return;

  document.getElementById('blue-name').textContent   = draftState.teamBlueName;
  document.getElementById('red-name').textContent    = draftState.teamRedName;
  document.getElementById('draft-title').textContent = `${draftState.teamBlueName} vs ${draftState.teamRedName}`;

  const step   = draftState.sequence[draftState.step];
  const stepEl = document.getElementById('step-info');
  if (step) {
    const teamName = step.team === 'blue' ? draftState.teamBlueName : draftState.teamRedName;
    stepEl.textContent  = `Étape ${draftState.step + 1} / ${draftState.sequence.length} — ${teamName} — ${step.phase === 'ban' ? 'BAN' : 'PICK'}`;
    stepEl.style.color  = step.team === 'blue' ? 'var(--blue)' : 'var(--red)';
  } else {
    stepEl.textContent = `Draft terminé (${draftState.step} étapes)`;
    stepEl.style.color = 'var(--gold-bright)';
  }

  document.getElementById('btn-prev-step').disabled = !draftState || draftState.step <= 0;
  document.getElementById('btn-next-step').disabled = !draftState || draftState.step >= draftState.sequence.length;

  renderSlotList('blue-bans-list',  'blue', 'ban');
  renderSlotList('blue-picks-list', 'blue', 'pick');
  renderSlotList('red-bans-list',   'red',  'ban');
  renderSlotList('red-picks-list',  'red',  'pick');
}

function renderSlotList(containerId, team, phase) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  for (let i = 0; i < 5; i++) {
    const slotKey   = `${phase}-${team}-${i}`;
    const slotData  = draftState.slots[slotKey];
    const champ     = slotData ? CHAMPIONS.find(c => c.id === slotData.champion) : null;
    const isCurrent = draftState.sequence[draftState.step]?.slot === slotKey;

    const div = document.createElement('div');
    div.className = `admin-slot${slotData ? ' filled' : ''}${isCurrent ? ' current-step' : ''}`;

    div.innerHTML = `
      <div class="slot-info">
        <span class="slot-label">${phase === 'ban' ? 'Ban' : 'Pick'} ${i + 1}</span>
        ${champ
          ? `<img src="https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${champ.id}.png" alt="${champ.name}" />
             <span class="champ-name">${champ.name}</span>`
          : `<span class="empty-label">— vide —</span>`}
      </div>
      <button class="btn-edit">✏️ Modifier</button>`;

    div.querySelector('.btn-edit').addEventListener('click', () => openModal(slotKey));
    container.appendChild(div);
  }
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function openModal(slot) {
  editingSlot = slot;
  modalSearch = '';
  document.getElementById('modal-slot-label').textContent = `— ${slot}`;
  document.getElementById('modal-search').value = '';
  renderModalGrid();
  document.getElementById('modal').classList.remove('hidden');
  document.getElementById('modal-search').focus();
}

function closeModal() {
  editingSlot = null;
  document.getElementById('modal').classList.add('hidden');
}

function renderModalGrid() {
  const grid = document.getElementById('modal-grid');
  const q    = modalSearch.toLowerCase().trim();

  const usedChampions = new Set(
    Object.entries(draftState.slots)
      .filter(([k]) => k !== editingSlot)
      .map(([, v]) => v.champion)
  );

  const filtered = CHAMPIONS.filter(c => !q || c.name.toLowerCase().includes(q));
  grid.innerHTML = '';

  for (const champ of filtered) {
    const isUsed = usedChampions.has(champ.id);
    const div = document.createElement('div');
    div.className = `modal-champ${isUsed ? ' used' : ''}`;
    div.innerHTML = `
      <img src="https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${champ.id}.png" alt="${champ.name}" loading="lazy" />
      <span>${champ.name}</span>`;
    if (!isUsed) div.addEventListener('click', () => setSlot(editingSlot, champ.id));
    grid.appendChild(div);
  }
}

// ─── API calls ────────────────────────────────────────────────────────────────
async function setSlot(slot, champion) {
  const r = await fetch(`/api/draft/${draftId}/admin/set-slot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminToken, slot, champion: champion || null }),
  });
  const data = await r.json();
  if (data.ok) {
    draftState = data.state;
    closeModal();
    render();
    showToast(champion ? `✅ ${champion} → ${slot}` : `🗑️ Slot ${slot} vidé`, 'ok');
  } else {
    showToast(`Erreur : ${data.error}`, 'err');
  }
}

async function setStep(step) {
  const r = await fetch(`/api/draft/${draftId}/admin/set-step`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminToken, step }),
  });
  const data = await r.json();
  if (data.ok) {
    draftState = data.state;
    render();
    showToast(`✅ Étape → ${step + 1}`, 'ok');
  } else {
    showToast(`Erreur : ${data.error}`, 'err');
  }
}

// ─── Events ───────────────────────────────────────────────────────────────────
document.getElementById('btn-prev-step').addEventListener('click', () => {
  if (draftState && draftState.step > 0) setStep(draftState.step - 1);
});
document.getElementById('btn-next-step').addEventListener('click', () => {
  if (draftState && draftState.step < draftState.sequence.length) setStep(draftState.step + 1);
});
document.getElementById('btn-refresh').addEventListener('click', async () => {
  await loadState();
  render();
  showToast('État rafraîchi.', 'ok');
});
document.getElementById('btn-clear-slot').addEventListener('click', () => {
  if (editingSlot) setSlot(editingSlot, null);
});
document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);
document.getElementById('modal-search').addEventListener('input', e => {
  modalSearch = e.target.value;
  renderModalGrid();
});
document.getElementById('modal').addEventListener('click', e => {
  if (e.target === document.getElementById('modal')) closeModal();
});

// ─── Toast ────────────────────────────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `show ${type}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}
