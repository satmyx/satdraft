# 🗡️ LoL Draft Tool

Interface de draft League of Legends en temps réel avec bot Discord.

## Stack

| Composant | Techno |
|-----------|--------|
| Backend   | Node.js + Express + WebSocket (`ws`) |
| Frontend  | HTML/CSS/JS vanilla |
| Assets    | Data Dragon CDN (Riot Games) |
| Bot       | discord.js v14 |

## Structure

```
satdraft/
├── server/
│   └── index.js        ← serveur Express + WebSocket
├── bot/
│   └── index.js        ← bot Discord (slash command /draft)
├── public/
│   ├── index.html      ← interface de draft
│   ├── style.css       ← styles dark theme LoL
│   └── draft.js        ← logique client WebSocket + Data Dragon
├── .env.example
└── package.json
```

## Installation

```bash
cd satdraft
npm install
```

## Configuration

Copie `.env.example` en `.env` et remplis :

```env
DISCORD_TOKEN=TON_TOKEN_BOT_DISCORD
DISCORD_CLIENT_ID=TON_CLIENT_ID
DRAFT_BASE_URL=http://localhost:3000   # ou ton URL publique (ngrok, VPS…)
PORT=3000
```

### Obtenir les tokens Discord

1. Va sur [discord.com/developers/applications](https://discord.com/developers/applications)
2. Crée une application → **Bot** → copie le token dans `DISCORD_TOKEN`
3. Copie **Application ID** dans `DISCORD_CLIENT_ID`
4. Invite le bot dans ton serveur avec le scope `applications.commands` + `bot`

## Lancement

```bash
# Terminal 1 – serveur web + WebSocket
npm start

# Terminal 2 – bot Discord
npm run bot
```

## Utilisation

1. Dans Discord : tape `/draft blue:"Team A" red:"Team B"`
2. Le bot poste un embed avec 3 boutons (lien bleu, lien rouge, spectateurs)
3. Chaque capitaine ouvre **son lien** (en privé de préférence)
4. Les deux capitaines cliquent sur **"Je suis prêt"**
5. Le draft démarre : bans puis picks en temps réel via WebSocket

## Flux de draft (BO1 standard)

```
Phase 1 – Bans :  B R B R B R  (3 bans par équipe)
Phase 1 – Picks : B RR BB R    (serpentin)
Phase 2 – Bans :  R B R B      (2 bans par équipe)
Phase 2 – Picks : R BB R       (serpentin)
```

## Exposer en public (ngrok)

```bash
ngrok http 3000
# Copie l'URL https://xxx.ngrok.io dans DRAFT_BASE_URL
```

## Sécurité

- Chaque session a 2 tokens UUID v4 uniques (blue/red) — non devinables
- Les spectateurs n'ont aucun token → lecture seule
- Pas de base de données, pas d'authentification persistante
- Les sessions vivent en mémoire (perdues au redémarrage)
