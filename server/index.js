require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { client: discordClient } = require('../bot/index.js');
const { screenshotDraft } = require('./screenshot');

const RESULT_CHANNEL_ID = '1485687757685653524';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ─── In-memory draft sessions ────────────────────────────────────────────────
// draftId → { state, clients: Map<ws, { team, role }> }
const drafts = new Map();

// BO1 sequence: B=Ban, P=Pick  |  team: 'blue'|'red'
// Standard LoL draft: 3 bans blue, 3 bans red, picks, 2 bans each, picks
const DRAFT_SEQUENCE = [
  // Phase 1 – Bans (6 bans alternating)
  { phase: 'ban',  team: 'blue', slot: 'ban-blue-0' },
  { phase: 'ban',  team: 'red',  slot: 'ban-red-0'  },
  { phase: 'ban',  team: 'blue', slot: 'ban-blue-1' },
  { phase: 'ban',  team: 'red',  slot: 'ban-red-1'  },
  { phase: 'ban',  team: 'blue', slot: 'ban-blue-2' },
  { phase: 'ban',  team: 'red',  slot: 'ban-red-2'  },
  // Phase 1 – Picks (6 picks)
  { phase: 'pick', team: 'blue', slot: 'pick-blue-0' },
  { phase: 'pick', team: 'red',  slot: 'pick-red-0'  },
  { phase: 'pick', team: 'red',  slot: 'pick-red-1'  },
  { phase: 'pick', team: 'blue', slot: 'pick-blue-1' },
  { phase: 'pick', team: 'blue', slot: 'pick-blue-2' },
  { phase: 'pick', team: 'red',  slot: 'pick-red-2'  },
  // Phase 2 – Bans (4 bans alternating)
  { phase: 'ban',  team: 'red',  slot: 'ban-red-3'  },
  { phase: 'ban',  team: 'blue', slot: 'ban-blue-3' },
  { phase: 'ban',  team: 'red',  slot: 'ban-red-4'  },
  { phase: 'ban',  team: 'blue', slot: 'ban-blue-4' },
  // Phase 2 – Picks (4 picks)
  { phase: 'pick', team: 'red',  slot: 'pick-red-3'  },
  { phase: 'pick', team: 'blue', slot: 'pick-blue-3' },
  { phase: 'pick', team: 'blue', slot: 'pick-blue-4' },
  { phase: 'pick', team: 'red',  slot: 'pick-red-4'  },
];

function createDraftState(teamBlueName = 'Blue Team', teamRedName = 'Red Team') {
  return {
    teamBlueName,
    teamRedName,
    step: 0,               // index in DRAFT_SEQUENCE
    sequence: DRAFT_SEQUENCE,
    slots: {},             // slot → { champion, lockedAt }
    hovering: { blue: null, red: null },
    status: 'waiting',    // waiting | active | finished
    paused: false,
    timer: null,          // not persisted, just for reference
    timerValue: 30,
    blueReady: false,
    redReady: false,
  };
}

// ─── REST: Create draft session ───────────────────────────────────────────────
app.post('/api/draft/create', (req, res) => {
  const { teamBlueName, teamRedName } = req.body;
  const draftId    = uuidv4();
  const blueToken  = uuidv4();
  const redToken   = uuidv4();
  const adminToken = uuidv4();

  drafts.set(draftId, {
    draftId,
    state: createDraftState(teamBlueName || 'Blue Team', teamRedName || 'Red Team'),
    clients: new Map(),
    blueToken,
    redToken,
    adminToken,
  });

  const baseUrl = process.env.DRAFT_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

  res.json({
    draftId,
    blueUrl:     `${baseUrl}/draft/${draftId}?token=${blueToken}&team=blue`,
    redUrl:      `${baseUrl}/draft/${draftId}?token=${redToken}&team=red`,
    spectateUrl: `${baseUrl}/draft/${draftId}`,
    adminUrl:    `${baseUrl}/admin/${draftId}?token=${adminToken}`,
  });
});

// ─── REST: Get draft state ────────────────────────────────────────────────────
app.get('/api/draft/:draftId', (req, res) => {
  const draft = drafts.get(req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Draft not found' });
  res.json(sanitizeState(draft.state));
});

// ─── Serve frontend for /draft/:id ───────────────────────────────────────────
app.get('/draft/:draftId', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ─── Admin page ───────────────────────────────────────────────────────────────
app.get('/admin/:draftId', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// ─── Admin: set slot ──────────────────────────────────────────────────────────
app.post('/api/draft/:draftId/admin/set-slot', (req, res) => {
  const { adminToken, slot, champion } = req.body;
  const draft = drafts.get(req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Draft not found' });
  if (!adminToken || adminToken !== draft.adminToken)
    return res.status(403).json({ error: 'Invalid admin token' });

  const VALID_SLOTS = new Set([
    'ban-blue-0','ban-blue-1','ban-blue-2','ban-blue-3','ban-blue-4',
    'ban-red-0', 'ban-red-1', 'ban-red-2', 'ban-red-3', 'ban-red-4',
    'pick-blue-0','pick-blue-1','pick-blue-2','pick-blue-3','pick-blue-4',
    'pick-red-0', 'pick-red-1', 'pick-red-2', 'pick-red-3', 'pick-red-4',
  ]);
  if (!VALID_SLOTS.has(slot))
    return res.status(400).json({ error: 'Invalid slot' });

  if (champion) {
    if (!/^[A-Za-z0-9]{1,30}$/.test(champion))
      return res.status(400).json({ error: 'Invalid champion id' });
    const alreadyUsed = Object.entries(draft.state.slots)
      .some(([k, v]) => k !== slot && v.champion === champion);
    if (alreadyUsed)
      return res.status(409).json({ error: 'Champion already used in another slot' });
    draft.state.slots[slot] = { champion, lockedAt: Date.now(), adminSet: true };
  } else {
    delete draft.state.slots[slot];
  }

  broadcast(draft, { type: 'state', state: sanitizeState(draft.state) });
  res.json({ ok: true, state: sanitizeState(draft.state) });
});

// ─── Admin: set step ──────────────────────────────────────────────────────────
app.post('/api/draft/:draftId/admin/set-step', (req, res) => {
  const { adminToken, step } = req.body;
  const draft = drafts.get(req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Draft not found' });
  if (!adminToken || adminToken !== draft.adminToken)
    return res.status(403).json({ error: 'Invalid admin token' });

  const newStep = parseInt(step, 10);
  if (isNaN(newStep) || newStep < 0 || newStep > draft.state.sequence.length)
    return res.status(400).json({ error: 'Invalid step' });

  clearDraftTimer(draft);
  draft.state.step = newStep;

  if (newStep >= draft.state.sequence.length) {
    draft.state.status = 'finished';
  } else if (draft.state.blueReady && draft.state.redReady) {
    draft.state.status = 'active';
    draft.state.timerValue = 30;
    startTimer(draft);
  }

  broadcast(draft, { type: 'state', state: sanitizeState(draft.state) });
  res.json({ ok: true, state: sanitizeState(draft.state) });
});

// ─── Admin: pause / resume ───────────────────────────────────────────────────
app.post('/api/draft/:draftId/admin/pause-toggle', (req, res) => {
  const { adminToken } = req.body;
  const draft = drafts.get(req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Draft not found' });
  if (!adminToken || adminToken !== draft.adminToken)
    return res.status(403).json({ error: 'Invalid admin token' });
  if (draft.state.status !== 'active')
    return res.status(400).json({ error: 'Draft is not active' });

  draft.state.paused = !draft.state.paused;
  broadcast(draft, { type: 'state', state: sanitizeState(draft.state) });
  res.json({ ok: true, paused: draft.state.paused });
});

// ─── WebSocket ────────────────────────────────────────────────────────────────
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const draftId = url.searchParams.get('draftId');
  const token   = url.searchParams.get('token');

  if (!draftId || !drafts.has(draftId)) {
    ws.close(4001, 'Draft not found');
    return;
  }

  const draft = drafts.get(draftId);
  let team = 'spectator';
  let role = 'spectator';

  if (token === draft.blueToken) { team = 'blue'; role = 'captain'; }
  else if (token === draft.redToken) { team = 'red'; role = 'captain'; }

  draft.clients.set(ws, { team, role });

  // Send current state immediately
  send(ws, { type: 'state', state: sanitizeState(draft.state), yourTeam: team });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    handleMessage(draft, ws, msg, team, role);
  });

  ws.on('close', () => {
    draft.clients.delete(ws);
  });
});

function handleMessage(draft, ws, msg, team, role) {
  const { state } = draft;

  if (msg.type === 'ready') {
    if (team === 'blue') state.blueReady = true;
    if (team === 'red')  state.redReady  = true;
    if (state.blueReady && state.redReady && state.status === 'waiting') {
      state.status = 'active';
      startTimer(draft);
    }
    broadcast(draft, { type: 'state', state: sanitizeState(state) });
    return;
  }

  if (msg.type === 'hover') {
    if (role !== 'captain') return;
    const currentStep = state.sequence[state.step];
    if (!currentStep || currentStep.team !== team) return;
    state.hovering[team] = msg.champion || null;
    broadcast(draft, { type: 'hover', team, champion: msg.champion });
    return;
  }

  if (msg.type === 'lock') {
    if (role !== 'captain') return;
    if (state.status !== 'active') return;
    const currentStep = state.sequence[state.step];
    if (!currentStep || currentStep.team !== team) return;
    if (!msg.champion) return;

    // Check champion not already used
    const usedChampions = Object.values(state.slots).map(s => s.champion).filter(Boolean);
    if (usedChampions.includes(msg.champion)) {
      send(ws, { type: 'error', message: 'Champion already banned or picked' });
      return;
    }

    state.slots[currentStep.slot] = { champion: msg.champion, lockedAt: Date.now() };
    state.hovering[team] = null;
    state.step += 1;

    clearDraftTimer(draft);

    if (state.step >= state.sequence.length) {
      state.status = 'finished';
      broadcast(draft, { type: 'state', state: sanitizeState(state) });
      sendDraftResult(draft);
      return;
    }

    startTimer(draft);
    broadcast(draft, { type: 'state', state: sanitizeState(state) });
    return;
  }
}

// ─── Timer ────────────────────────────────────────────────────────────────────
function startTimer(draft) {
  draft.state.timerValue = 30;
  clearDraftTimer(draft);

  draft._timerInterval = setInterval(() => {
    if (draft.state.paused) return; // timer gelé
    draft.state.timerValue -= 1;
    broadcast(draft, { type: 'timer', value: draft.state.timerValue });

    if (draft.state.timerValue <= 0) {
      clearDraftTimer(draft);
      // Auto-lock a random champion that hasn't been used
      autoLock(draft);
    }
  }, 1000);
}

function clearDraftTimer(draft) {
  if (draft._timerInterval) {
    clearInterval(draft._timerInterval);
    draft._timerInterval = null;
  }
}

function autoLock(draft) {
  const { state } = draft;
  const currentStep = state.sequence[state.step];
  if (!currentStep) return;

  // Slot laissé vide (aucun champion sélectionné dans les temps)
  state.slots[currentStep.slot] = { champion: null, lockedAt: Date.now(), autoLocked: true };
  state.hovering[currentStep.team] = null;
  state.step += 1;

  if (state.step >= state.sequence.length) {
    state.status = 'finished';
  } else {
    startTimer(draft);
  }

  broadcast(draft, { type: 'state', state: sanitizeState(state) });
  if (state.status === 'finished') sendDraftResult(draft);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sanitizeState(state) {
  // Don't expose tokens, just the public state
  return {
    teamBlueName: state.teamBlueName,
    teamRedName:  state.teamRedName,
    step:         state.step,
    sequence:     state.sequence,
    slots:        state.slots,
    hovering:     state.hovering,
    status:       state.status,
    paused:       state.paused,
    timerValue:   state.timerValue,
    blueReady:    state.blueReady,
    redReady:     state.redReady,
  };
}

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcast(draft, data) {
  for (const [ws] of draft.clients) {
    send(ws, data);
  }
}

// ─── Send draft result screenshot to Discord ─────────────────────────────────
async function sendDraftResult(draft) {
  try {
    const port = process.env.PORT || 3000;
    const url  = `http://localhost:${port}/draft/${draft.draftId}`;
    const screenshot = await screenshotDraft(url);
    const channel = await discordClient.channels.fetch(RESULT_CHANNEL_ID);
    await channel.send({
      content: `✅ **Draft terminée** — ${draft.state.teamBlueName} vs ${draft.state.teamRedName}`,
      files: [{ attachment: screenshot, name: 'draft-result.png' }],
    });
    console.log(`[Bot] Screenshot draft ${draft.draftId} envoyé dans le channel ${RESULT_CHANNEL_ID}`);
  } catch (err) {
    console.error('[Bot] Erreur envoi screenshot draft:', err);
  }
}

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
});
