// load environment variables
require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    Partials
} = require("discord.js");

const { postLibraryMessagesToForum } = require("./features/library_to_forum");
const { postSuggestionsToPriorities } = require("./filters/suggestions_to_forum");
const { handleBobiz } = require("./features/bobiz_responses");
const { handleAttack } = require("./features/attack_responses");
const { getServerConfig, serverExists } = require("./databases/servers");
const { DiscordWarI } = require("./filters/DiscordWarI");
const { startListOfContributors, addContributorToList, removeContributorFromList, endListOfContributors } = require("./features/listOfContributors");
const { sendMSG } = require("./features/sendMGS");
const { displayAvatar } = require("./features/displayAvatar");
const { handleDirectMessage, handleAdminCommand, handleInteraction } = require("./features/reporting");
const { Events } = require("discord.js");

function hasMasterRole(member, guildId) {
    const config = getServerConfig(guildId);
    if (!config) return false;
    return member.roles.cache.has(config.BOT_MASTER_ROLE_ID);
}

function hasTitle(messageContent) {
    const lines = messageContent.split("\n");

    for (let i = 0; i < Math.min(4, lines.length); i++) {
        const line = lines[i].trim();
        if (/(?:.*?)(title|titre|العنوان)\s*:\s*(.+)/i.test(line)) {
            return true; // title found
        }
    }
    return false; // no title found
}

// create bot client with necessary permissions
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// prefix for bot commands
const PREFIX = "--";

// channels that the bot follows
// to make list of contributors
const listOfChannelsTheBotIn = new Set()


/* ========================================================================
   SECTION - A START
   this section contains things that happen on the server side
   ======================================================================== */

// the List of contributors

// to keep track of different lists


// bot ready event
// displays the message "Oh shit, here we go again" in the console
// used as an indicator that the bot is running
client.once("ready", () => {
    console.log("Oh shit, here we go again");
});

/* ========================================================================
   SECTION - A END
   ======================================================================== */

/* ========================================================================
   SECTION - B START
   this section contains things related to normal messages
   ======================================================================== */

client.on(Events.MessageCreate, async (message) => {

    // ignore bot messages
    if (message.author.bot) return;
    if (message.guild == null) return

    if (message.mentions.everyone || message.mentions.has('@everyone') || message.mentions.has('@here')) {
        return;
    }

    const guildId = message.guild.id;

    // Check if this server is configured
    if (!serverExists(guildId)) {
        console.log(`[WARN] Server ${guildId} not found in configuration`);
        return;
    }

    const config = getServerConfig(guildId);

    // scans the library channel, checks for proper message format,
    // counts reacts with the emoji "✅",
    // then posts messages into the library forum sorted by reaction count
    if (message.channel.id === config.LIBRARY_CHANNEL_ID) {
        if (hasTitle(message.content)) {
            await postLibraryMessagesToForum(client, guildId);
        }
    }

    // scans suggestions channel, looks for messages with a Title field,
    // counts reacts with "✅", collects images,
    // then posts them into the priorities forum sorted by reaction count
    if (message.channel.id === config.SUGGESTION_CHANNEL_ID) {
        if (hasTitle(message.content)) {
            await postSuggestionsToPriorities(client, guildId);
        }
    }


    // List of contributors
    // must be only in voice channels
    // voice channels type is 2
    if (message.channel.type == 2 && message.channel.constructor.name == "VoiceChannel") {
        // the bot must be mentionned first to focus on the conversation
        if (message.mentions.has(client.user)) {// mention the bot
            if (message.content.split('\n')[0].toLowerCase().includes('aji')) { // find the word "list" to start new list

                startListOfContributors(message)
                listOfChannelsTheBotIn.add(message.channel.id)
            }
            // after the bot is no longer needed to guard a list
            // you can tell it to leave the conversation
            if (message.content.split('\n')[0].toLowerCase().includes('khoch')) { // find the word "khoch" to end current list
                const hasEnded = endListOfContributors(message)
                if (hasEnded) listOfChannelsTheBotIn.delete(message.channel.id)
            }

        }
        // for a membre to add his name to the list 
        // he should send a rise hand emoji
        if (listOfChannelsTheBotIn.has(message.channel.id)) {
            if ((/^(✋|🤚|🖐)(?:[\u{1F3FB}-\u{1F3FF}])?/u).test(message.content)) {
                addContributorToList(message,
                    {
                        channelId: message.channel.id,
                        username: message.author.username,
                        globalName: message.author.globalName,
                        userId: message.author.id
                    }
                )

            }
            // for a member to remove his name to the list
            // he should send like emoji to end his contribution
            if ((/^(👍|👎)(?:[\u{1F3FB}-\u{1F3FF}])?/u).test(message.content)) {
                removeContributorFromList(message,
                    {
                        channelId: message.channel.id,
                        userId: message.author.id
                    }
                )

            }
        }
    }



    // Déclaration de guerre contre IBN KHALDON
    //    if (message.author.id === "1418154490942586910") { // l'Coin
    //     if (Math.floor(Math.random() * 3) == 2) {
    //            await DiscordWarI(message);
    //      }
    //    }

    // check if message starts with command prefix
    if (!message.content.startsWith(PREFIX)) return;

    // extract the command name
    const [cmd] = message.content.slice(PREFIX.length).split(" ");
    //send message

    /* ========================================================================
       SECTION - C START
       this section contains things that related to bot commands
       ======================================================================== */

    if (message.guild.id == "1440447165737730152") {    // comands are allowed only in test server
        // command: sync library
        // scans the library channel, checks for proper message format,
        // counts reacts with the emoji "✅",
        // then posts messages into the library forum sorted by reaction count
        if (cmd === "sync_lib") {

            // check master role
            if (!hasMasterRole(message.member, guildId)) {
                return message.reply("knsme3 4ir ll3esas , 7ta tched lgrade w sowel fya")
            }

            await message.delete().catch(() => { });
            await postLibraryMessagesToForum(client, guildId);
        }

        // command: sync suggestions
        // scans suggestions channel, looks for messages with a Title field,
        // counts reacts with "✅", collects images,
        // then posts them into the priorities forum sorted by reaction count
        if (cmd === "sync_sugg") {

            // check master role
            if (!hasMasterRole(message.member, guildId)) {
                return message.reply("knsme3 4ir ll3esas , 7ta tched lgrade w sowel fya")
            }

            await message.delete().catch(() => { });
            await postSuggestionsToPriorities(client, guildId);
        }
    }
    // 9lat ma ydar 
    if (cmd === "bobiz") {
        await handleBobiz(message);
    }
    const validCommands = ["attack", "korose", "malhada", "jibo", "mal_hada", "مال_هادا", "ewa_lih"];
    if (validCommands.includes(cmd.toLowerCase())) {
        await handleAttack(message);
    }

    // send message in a text channel
    if (cmd === "msg") {
        sendMSG(message, client, PREFIX)
    }

    // the ability to show user avatar
    if (cmd === "a") {
        displayAvatar(message)
    }
    /* ========================================================================
       SECTION - C END
       ======================================================================== */

});

    /* ========================================================================
       SECTION - D START
       this section contains things that related to interactions
       ======================================================================== */
    client.on(Events.InteractionCreate, (interaction) => handleInteraction(client, interaction));

    client.on(Events.MessageCreate,(message)=>{
            if (message.guild !== null) return
            // these two funtions handles reporting mechanism
            handleDirectMessage(client, message)
            handleAdminCommand(client, message)
        })


    /* ========================================================================
       SECTION - D END
       ======================================================================== */


/* ========================================================================
   BOT LOGIN
   ======================================================================== */

client.login(process.env.DISCORD_TOKEN);
