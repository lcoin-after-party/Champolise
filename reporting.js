require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

client.reportSessions = new Map();

client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});


client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== 'report_user') return;

  await interaction.reply({
    content: '📩 I have sent you a DM',
    ephemeral: true
  });

  try {
    client.reportSessions.set(interaction.user.id, {
      guildId: interaction.guild.id,
      step: 1
    });

    await interaction.user.send(
      '🚨 **Report a member**\n\n' +
      'What is the **username, nickname, or ID** of the member you want to report.'
    );
  } catch {
    await interaction.followUp({
      content: '❌ I could not DM you. Please enable DMs and try again.',
      ephemeral: true
    });
  }
});


client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (message.guild) return; 

  const session = client.reportSessions.get(message.author.id);
  if (!session) return;

  if (session.step === 1) {
    session.reportedUser = message.content;
    session.step = 2;

    return message.reply(
      'Thank you.\n\nNow please describe **what the user did**.\nYou may include dates, channels, or context'
    );
  }

  if (session.step === 2) {
    session.reason = message.content;

    const guild = await client.guilds.fetch(session.guildId);

    // Fetch the specific channel by ID
    let modChannel;
    try {
        modChannel = await guild.channels.fetch('1429595706150359130'); // make sure this is a string
    } catch (err) {
        console.error('Error fetching channel:', err);
    }

    if (!modChannel) {
        console.log('❌ Mod channel not found!');
        return message.reply('❌ Could not find the mod channel. Please contact staff.');
    }

    // Send the report
    await modChannel.send({
        embeds: [{
            color: 0xE74C3C,
            description:
                '```diff\n- MEMBER REPORT\n```' +
                '\n> **👤 Reported User**\n' +
                ` ${session.reportedUser}\n\n` +
                '> **📝 Report Details**\n' +
                ` ${session.reason}`,
            footer: { text: 'Anonymous report ' },
            timestamp: new Date()
        }]
    });

    await message.reply(
        '✅ Your report has been submitted anonymously.\nThank you for helping keep the community safe.'
    );

    client.reportSessions.delete(message.author.id);
}

});


client.on(Events.MessageCreate, async (message) => {
    if (!message.guild) return;
    if (message.author.id !== '733414175556239525') return;
    if (message.content !== '!sendreport') return;

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
});

client.login(process.env.DISCORD_TOKEN);
