require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  UserSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { v4: uuidv4 } = require('uuid');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const BASE_URL         = process.env.DRAFT_BASE_URL || 'http://localhost:3000';
const SERVER_URL       = BASE_URL;
const DRAFT_CHANNEL_ID = '1486086211742470214';
const ADMIN_CHANNEL_ID = '1486087431504527483';

// pendingSelections: initiatorId → { blueUserId, redUserId }
const pendingSelections = new Map();

// pendingDrafts: draftKey → { blueUserId, redUserId, blueName, redName, initiatorId }
const pendingDrafts = new Map();

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

// ─── Finalize draft once both captains have named their team ──────────────────
async function finalizeDraft(draftKey) {
  const pending = pendingDrafts.get(draftKey);
  if (!pending || !pending.blueName || !pending.redName) return;

  pendingDrafts.delete(draftKey);

  const blueUser = await client.users.fetch(pending.blueUserId);
  const redUser  = await client.users.fetch(pending.redUserId);

  let draft;
  try {
    draft = await createDraftSession(pending.blueName, pending.redName);
  } catch (err) {
    console.error('[Bot] Erreur création draft:', err);
    return;
  }

  // DM blue captain
  try {
    await blueUser.send(
      `🔵 La draft est prête ! Tu es capitaine de l'équipe **${pending.blueName}**.\n` +
      `Voici ton lien (ne le partage pas) :\n${draft.blueUrl}`,
    );
  } catch {
    console.warn(`[Bot] DM impossible pour ${blueUser.tag} (bleu)`);
  }

  // DM red captain
  try {
    await redUser.send(
      `🔴 La draft est prête ! Tu es capitaine de l'équipe **${pending.redName}**.\n` +
      `Voici ton lien (ne le partage pas) :\n${draft.redUrl}`,
    );
  } catch {
    console.warn(`[Bot] DM impossible pour ${redUser.tag} (rouge)`);
  }

  // Public embed with spectator button
  const draftChannel = await client.channels.fetch(DRAFT_CHANNEL_ID);
  const publicEmbed = new EmbedBuilder()
    .setTitle('⚔️ Draft en cours')
    .setColor(0xC89B3C)
    .setDescription('Une nouvelle session de draft vient d\'être lancée !')
    .addFields(
      { name: '🔵 ' + pending.blueName, value: `${blueUser}`, inline: true },
      { name: '🔴 ' + pending.redName,  value: `${redUser}`,  inline: true },
    )
    .setFooter({ text: 'Les capitaines ont reçu leur lien en message privé.' })
    .setTimestamp();

  const rowSpectate = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('👁️ Rejoindre en spectateur')
      .setStyle(ButtonStyle.Link)
      .setURL(draft.spectateUrl),
  );

  await draftChannel.send({ embeds: [publicEmbed], components: [rowSpectate] });

  // Admin link
  const adminChannel = await client.channels.fetch(ADMIN_CHANNEL_ID);
  await adminChannel.send(
    `🔧 **Lien Admin** — **${pending.blueName}** vs **${pending.redName}**\n${draft.adminUrl}`,
  );

  console.log(`[Bot] Draft finalisée : ${pending.blueName} vs ${pending.redName}`);
}

// ─── Post launcher embed in draft channel ─────────────────────────────────────
async function postLauncherEmbed() {
  try {
    const channel = await client.channels.fetch(DRAFT_CHANNEL_ID);
    const embed = new EmbedBuilder()
      .setTitle('⚔️ Draft League of Legends')
      .setColor(0xC89B3C)
      .setDescription('Cliquez sur le bouton ci-dessous pour lancer une nouvelle session de draft.')
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('lancer-draft')
        .setLabel('⚔️ Lancer une draft')
        .setStyle(ButtonStyle.Primary),
    );

    await channel.send({ embeds: [embed], components: [row] });
    console.log('[Bot] Embed launcher envoyé dans le channel draft.');
  } catch (err) {
    console.error('[Bot] Erreur envoi embed launcher:', err);
  }
}

// ─── Bot ready ────────────────────────────────────────────────────────────────
client.once('ready', () => {
  console.log(`[Bot] Connecté en tant que ${client.user.tag}`);
  postLauncherEmbed();
});

// ─── Interaction handler ──────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {

  // ── "Lancer une draft" button ──────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'lancer-draft') {
    pendingSelections.set(interaction.user.id, { blueUserId: null, redUserId: null });

    const embed = new EmbedBuilder()
      .setTitle('⚔️ Nouvelle draft')
      .setColor(0xC89B3C)
      .setDescription('Sélectionnez les deux capitaines puis confirmez.');

    const rowBlue = new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId('select-blue-captain')
        .setPlaceholder('🔵 Sélectionner le Capitaine Bleu'),
    );
    const rowRed = new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId('select-red-captain')
        .setPlaceholder('🔴 Sélectionner le Capitaine Rouge'),
    );
    const rowConfirm = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('confirm-draft')
        .setLabel('✅ Confirmer la draft')
        .setStyle(ButtonStyle.Success),
    );

    await interaction.reply({
      embeds: [embed],
      components: [rowBlue, rowRed, rowConfirm],
      ephemeral: true,
    });
    return;
  }

  // ── Blue captain select ────────────────────────────────────────────────────
  if (interaction.isUserSelectMenu() && interaction.customId === 'select-blue-captain') {
    const entry = pendingSelections.get(interaction.user.id) || { blueUserId: null, redUserId: null };
    entry.blueUserId = interaction.values[0];
    pendingSelections.set(interaction.user.id, entry);
    await interaction.deferUpdate();
    return;
  }

  // ── Red captain select ─────────────────────────────────────────────────────
  if (interaction.isUserSelectMenu() && interaction.customId === 'select-red-captain') {
    const entry = pendingSelections.get(interaction.user.id) || { blueUserId: null, redUserId: null };
    entry.redUserId = interaction.values[0];
    pendingSelections.set(interaction.user.id, entry);
    await interaction.deferUpdate();
    return;
  }

  // ── Confirm draft → DM each captain to name their team ────────────────────
  if (interaction.isButton() && interaction.customId === 'confirm-draft') {
    const selection = pendingSelections.get(interaction.user.id);

    if (!selection?.blueUserId || !selection?.redUserId) {
      await interaction.reply({
        content: '❌ Veuillez sélectionner les deux capitaines avant de confirmer.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferUpdate();
    pendingSelections.delete(interaction.user.id);

    const draftKey = uuidv4();
    pendingDrafts.set(draftKey, {
      blueUserId:  selection.blueUserId,
      redUserId:   selection.redUserId,
      blueName:    null,
      redName:     null,
      initiatorId: interaction.user.id,
    });

    const blueUser = await client.users.fetch(selection.blueUserId);
    const redUser  = await client.users.fetch(selection.redUserId);

    // DM blue captain
    try {
      await blueUser.send({
        content: '🔵 Tu as été désigné capitaine **Bleu** pour une draft LoL !\nClique sur le bouton ci-dessous pour nommer ton équipe.',
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`name-team:${draftKey}:blue`)
            .setLabel('🔵 Nommer mon équipe')
            .setStyle(ButtonStyle.Primary),
        )],
      });
    } catch {
      console.warn(`[Bot] DM impossible pour ${blueUser.tag} (bleu)`);
    }

    // DM red captain
    try {
      await redUser.send({
        content: '🔴 Tu as été désigné capitaine **Rouge** pour une draft LoL !\nClique sur le bouton ci-dessous pour nommer ton équipe.',
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`name-team:${draftKey}:red`)
            .setLabel('🔴 Nommer mon équipe')
            .setStyle(ButtonStyle.Primary),
        )],
      });
    } catch {
      console.warn(`[Bot] DM impossible pour ${redUser.tag} (rouge)`);
    }

    await interaction.editReply({
      content: `✅ Les deux capitaines (${blueUser} et ${redUser}) ont reçu un message privé pour nommer leur équipe.`,
      components: [],
      embeds: [],
    });
    return;
  }

  // ── Captain clicks "Nommer mon équipe" in DM → open modal ─────────────────
  if (interaction.isButton() && interaction.customId.startsWith('name-team:')) {
    const [, draftKey, side] = interaction.customId.split(':');
    if (!pendingDrafts.has(draftKey)) {
      await interaction.reply({ content: '❌ Cette draft a expiré ou n\'existe plus.', ephemeral: true });
      return;
    }

    const label = side === 'blue' ? '🔵 Nom de ton équipe (Bleue)' : '🔴 Nom de ton équipe (Rouge)';
    const modal = new ModalBuilder()
      .setCustomId(`modal-name:${draftKey}:${side}`)
      .setTitle('Nom de ton équipe');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('team-name')
          .setLabel(label)
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(32),
      ),
    );

    await interaction.showModal(modal);
    return;
  }

  // ── Modal submit: captain named their team ─────────────────────────────────
  if (interaction.isModalSubmit() && interaction.customId.startsWith('modal-name:')) {
    const [, draftKey, side] = interaction.customId.split(':');
    const pending = pendingDrafts.get(draftKey);

    if (!pending) {
      await interaction.reply({ content: '❌ Cette draft a expiré.', ephemeral: true });
      return;
    }

    const teamName = interaction.fields.getTextInputValue('team-name');

    if (side === 'blue') {
      pending.blueName = teamName;
      await interaction.reply({ content: `✅ Nom d'équipe **${teamName}** enregistré ! En attente du capitaine Rouge…`, ephemeral: true });
    } else {
      pending.redName = teamName;
      await interaction.reply({ content: `✅ Nom d'équipe **${teamName}** enregistré ! En attente du capitaine Bleu…`, ephemeral: true });
    }

    if (pending.blueName && pending.redName) {
      await finalizeDraft(draftKey);
    }
    return;
  }
});

// ─── Start bot ────────────────────────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN);
module.exports = { client };

