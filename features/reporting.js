const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getValue } = require('../databases/servers');

const REPORT_CHANNEL_ID = '1452040672369447056';
const BOT_ADMIN_ID = '733414175556239525';


async function handleInteraction(client, interaction) {
  if (!interaction.isButton() || interaction.customId !== 'report_user') return;

  await interaction.reply({
    content: '📩 I have sent you a DM',
    ephemeral: true
  });

  try {
    startReportSession(client, interaction);
    await sendReportPrompt(interaction.user);

  } catch (error) {
    console.error(
      `Failed to start report session for user ${interaction.user.id}:`,
      error
    );

    let message = '❌ Something went wrong while trying to DM you.';

    if (error.code === 50007) {
      message = '❌ I couldn’t DM you. Please enable **Direct Messages** from server members and try again.';
    }
    else if (error.code === 50013) {
      message = '❌ I don’t have permission to send you a DM.';
    }
    else {
      message += ' Please try again later or contact a moderator.';
    }

    await interaction.followUp({
      content: message,
      ephemeral: true
    });
  }
}


function startReportSession(client, interaction) {
  if (!client.reportSessions) {
    client.reportSessions = new Map();
  }

  client.reportSessions.set(interaction.user.id, {
    guildId: interaction.guild.id,
    step: 1,
  });
}


async function sendReportPrompt(user) {
  await user.send(
    '🚨 **Report a member**\n\n' +
    'What is the **username, nickname, or ID** of the member you want to report?'
  );
}

async function handleDirectMessage(client, message) {
  if (message.author.bot || message.guild) return;

  const session = client.reportSessions.get(message.author.id);
  if (!session) return;

  if (session.step === 1) {
    await handleReportUserStep(message, session);
  } else if (session.step === 2) {
    await handleReportReasonStep(client, message, session);
  }
}

async function handleReportUserStep(message, session) {
  session.reportedUser = message.content;
  session.step = 2;
  await message.reply(
    'Thank you.\n\nNow please describe **what the user did**.\nYou may include dates, channels, or context.'
  );
}

async function handleReportReasonStep(client, message, session) {
  session.reason = message.content;

  const modChannel = await fetchModChannel(client, session.guildId);
  if (!modChannel) return message.reply('❌ Could not find the mod channel. Please contact staff.');

  await sendReport(modChannel, session);
  await message.reply(
    '✅ Your report has been submitted anonymously.\nThank you for helping keep the community safe.'
  );

  client.reportSessions.delete(message.author.id);
}

async function fetchModChannel(client, guildId) {
  try {
    const reportChannelId = getValue(guildId, 'REPORT_CHANNEL_ID');
    if (!reportChannelId) return null;

    const guild = await client.guilds.fetch(guildId);
    return await guild.channels.fetch(reportChannelId);
  } catch (err) {
    console.error('Error fetching mod channel:', err);
    return null;
  }
}


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

async function handleAdminCommand(client, message) {
  if (!message.guild || message.content !== '!sendreport') return;

  const guildId = message.guild.id;
  const botAdminId = getValue(guildId, 'BOT_ADMIN_ID');

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


module.exports = {
  handleInteraction,
  handleDirectMessage,
  handleAdminCommand
};
