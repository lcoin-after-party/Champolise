const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Database helper used to retrieve per-server configuration values
 */
const { getValue } = require('../databases/servers');

/**
 * Handles button interactions related to reporting users.
 *
 * @param {Client} client - The Discord bot client
 * @param {Interaction} interaction - The interaction received from Discord
 */
async function handleInteraction(client, interaction) {
  // Only handle button interactions with the correct custom ID
  if (!interaction.isButton() || interaction.customId !== 'report_user') return;

  // Acknowledge the interaction immediately
  await interaction.reply({
    content: '📩 I have sent you a DM',
    ephemeral: true
  });

  try {
    // Initialize a new report session for the user
    startReportSession(client, interaction);

    // Send the first DM prompt
    await sendReportPrompt(interaction.user);

  } catch (error) {
    console.error(
      `Failed to start report session for user ${interaction.user.id}:`,
      error
    );

    // Default error message
    let message = '❌ Something went wrong while trying to DM you.';

    // Discord error codes for DM failures
    if (error.code === 50007) {
      message = '❌ I couldn’t DM you. Please enable **Direct Messages** from server members and try again.';
    }
    else if (error.code === 50013) {
      message = '❌ I don’t have permission to send you a DM.';
    }
    else {
      message += ' Please try again later or contact a moderator.';
    }

    // Inform the user privately
    await interaction.followUp({
      content: message,
      ephemeral: true
    });
  }
}

/**
 * Creates and stores a new report session for a user.
 *
 * Sessions are stored in-memory on the client using a Map.
 *
 * @param {Client} client - The Discord bot client
 * @param {Interaction} interaction - The interaction that initiated the report
 */
function startReportSession(client, interaction) {
  if (!client.reportSessions) {
    client.reportSessions = new Map();
  }

  client.reportSessions.set(interaction.user.id, {
    guildId: interaction.guild.id,
    step: 1, // Step 1 = ask who is being reported
  });
}

/**
 * Sends the initial DM asking who the user wants to report.
 *
 * @param {User} user - The Discord user starting the report
 */
async function sendReportPrompt(user) {
  await user.send(
    '🚨 **Report a member**\n\n' +
    'What is the **username, nickname, or ID** of the member you want to report?'
  );
}

/**
 * Handles incoming direct messages related to report sessions.
 *
 * @param {Client} client - The Discord bot client
 * @param {Message} message - The DM message received
 */
async function handleDirectMessage(client, message) {
  // Ignore bots and guild messages
  if (message.author.bot || message.guild) return;

  const session = client.reportSessions.get(message.author.id);
  if (!session) return;

  // Route the message based on the current step
  if (session.step === 1) {
    await handleReportUserStep(message, session);
  } else if (session.step === 2) {
    await handleReportReasonStep(client, message, session);
  }
}

/**
 * Step 1 of the report flow:
 * Stores the reported user's identifier and moves to step 2.
 *
 * @param {Message} message - The user's DM message
 * @param {Object} session - The user's report session
 */
async function handleReportUserStep(message, session) {
  session.reportedUser = message.content;
  session.step = 2;

  await message.reply(
    'Thank you.\n\nNow please describe **what the user did**.\nYou may include dates, channels, or context.'
  );
}

/**
 * Step 2 of the report flow:
 * Stores the report reason and submits the report.
 *
 * @param {Client} client - The Discord bot client
 * @param {Message} message - The user's DM message
 * @param {Object} session - The user's report session
 */
async function handleReportReasonStep(client, message, session) {
  session.reason = message.content;

  const modChannel = await fetchModChannel(client, session.guildId);
  if (!modChannel) {
    return message.reply('❌ Could not find the mod channel. Please contact staff.');
  }

  // Send the report to moderators
  await sendReport(modChannel, session);

  // Confirm submission to the user
  await message.reply(
    '✅ Your report has been submitted anonymously.\nThank you for helping keep the community safe.'
  );

  // Clean up the session
  client.reportSessions.delete(message.author.id);
}

/**
 * Fetches the moderation/report channel for a guild.
 *
 * @param {Client} client - The Discord bot client
 * @param {string} guildId - The ID of the guild
 * @returns {Promise<Channel|null>} The report channel or null if unavailable
 */
async function fetchModChannel(client, guildId) {
  try {
    const reportChannelId = await getValue(guildId, 'REPORT_CHANNEL_ID');
    if (!reportChannelId) return null;

    const guild = await client.guilds.fetch(guildId);
    return await guild.channels.fetch(reportChannelId);
  } catch (err) {
    console.error('Error fetching mod channel:', err);
    return null;
  }
}

/**
 * Sends the formatted anonymous report to the moderation channel.
 *
 * @param {TextChannel} channel - The moderation channel
 * @param {Object} session - The completed report session
 */
async function sendReport(channel, session) {
  await channel.send({
    embeds: [{
      color: 0xE74C3C,
      description:
        '```diff\n- MEMBER REPORT\n```' +
        '\n> **👤 Reported User**\n' +
        ` ${session.reportedUser}\n\n` +
        '> **📝 Report Details**\n' +
        ` ${session.reason}`,
      footer: { text: 'Anonymous report' },
      timestamp: new Date()
    }]
  });
}

/**
 * Handles the admin-only command that posts the "Report Member" button.
 *
 * @param {Client} client - The Discord bot client
 * @param {Message} message - The message received in a guild
 */
async function handleAdminCommand(client, message) {
  if (!message.guild || message.content !== '!sendreport') return;

  const guildId = message.guild.id;
  const botAdminId = await getValue(guildId, 'BOT_ADMIN_ID');

  // Only allow the configured bot admin to use this command
  if (!botAdminId || message.author.id !== botAdminId) return;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('report_user')
      .setLabel('🚨 Report Member')
      .setStyle(ButtonStyle.Danger)
  );

  await message.channel.send({
    content: 'Click the button below to report a member anonymously:',
    components: [row]
  });
}

/**
 * Export handlers for use in the main bot file
 */
module.exports = {
  handleInteraction,
  handleDirectMessage,
  handleAdminCommand
};
