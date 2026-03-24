require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  InteractionType,
} = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const BASE_URL = process.env.DRAFT_BASE_URL || 'http://localhost:3000';
const SERVER_URL = BASE_URL; // Same origin

// ─── Create a draft session via internal API ──────────────────────────────────
async function createDraftSession(teamBlueName, teamRedName) {
  const res = await fetch(`${SERVER_URL}/api/draft/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamBlueName, teamRedName }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// ─── Bot ready ────────────────────────────────────────────────────────────────
client.once('ready', () => {
  console.log(`[Bot] Connecté en tant que ${client.user.tag}`);
  registerCommands();
});

// ─── Slash command registration ───────────────────────────────────────────────
async function registerCommands() {
  const { REST, Routes } = require('discord.js');
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  const commands = [
    {
      name: 'draft',
      description: 'Créer une session de draft LoL',
      options: [
        {
          name: 'blue',
          description: "Nom de l'équipe Bleue",
          type: 3, // STRING
          required: false,
        },
        {
          name: 'red',
          description: "Nom de l'équipe Rouge",
          type: 3, // STRING
          required: false,
        },
      ],
    },
  ];

  try {
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands },
    );
    console.log('[Bot] Commandes slash enregistrées.');
  } catch (err) {
    console.error('[Bot] Erreur enregistrement commandes:', err);
  }
}

// ─── Interaction handler ──────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {

  // /draft command
  if (interaction.isChatInputCommand() && interaction.commandName === 'draft') {
    await interaction.deferReply({ ephemeral: false });

    const blueName = interaction.options.getString('blue') || 'Équipe Bleue';
    const redName  = interaction.options.getString('red')  || 'Équipe Rouge';

    let draft;
    try {
      draft = await createDraftSession(blueName, redName);
    } catch (err) {
      await interaction.editReply({ content: `❌ Erreur lors de la création du draft : ${err.message}` });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('⚔️ Draft League of Legends')
      .setColor(0xC89B3C)
      .setDescription(`Une nouvelle session de draft a été créée.\nChaque capitaine doit cliquer sur son lien **en privé**.`)
      .addFields(
        { name: '🔵 ' + blueName, value: `[Lien Équipe Bleue](${draft.blueUrl})`, inline: true },
        { name: '🔴 ' + redName,  value: `[Lien Équipe Rouge](${draft.redUrl})`,  inline: true },
        { name: '👁️ Spectateurs', value: `[Lien Spectateurs](${draft.spectateUrl})`, inline: false },
      )
      .setFooter({ text: 'Les deux capitaines doivent cliquer sur "Je suis prêt" pour démarrer.' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('🔵 ' + blueName + ' – Rejoindre')
        .setStyle(ButtonStyle.Link)
        .setURL(draft.blueUrl),
      new ButtonBuilder()
        .setLabel('🔴 ' + redName + ' – Rejoindre')
        .setStyle(ButtonStyle.Link)
        .setURL(draft.redUrl),
      new ButtonBuilder()
        .setLabel('👁️ Spectateurs')
        .setStyle(ButtonStyle.Link)
        .setURL(draft.spectateUrl),
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
    return;
  }
});

// ─── Start bot ────────────────────────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN);
