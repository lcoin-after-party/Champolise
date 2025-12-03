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
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// prefix for bot commands
const PREFIX = "--";

/* ========================================================================
   SECTION - A START
   this section contains things that happen on the server side
   ======================================================================== */

   // the List of contributors
    const triggerWordsOfList = ['list', 'لائحة'];
    const listOfConversationManagers = {} // should be {"channedID" : "managerID "}
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

client.on("messageCreate", async (message) => {

    // ignore bot messages
    if (message.author.bot) return;


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
    // the bot must be mentionned first to focus on the conversation

    if (
        message.mentions.has(client.user) // mention the bot
        &&
        triggerWordsOfList.some(word => message.content.toLowerCase().includes(word)) // find the word "list"
    ) {
        // Respond to the user when bot is mentioned
        if(listOfConversationManagers[message.channel.id]){
            message.reply("deja kayna liste");
        }else{
            message.reply("ana hna");
            listOfConversationManagers[message.channel.id] = message.author.id
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
const validCommands = ["attack", "korose", "malhada", "jibo", "mal hada", "مال هادا"];
if (validCommands.includes(cmd.toLowerCase())) {
    await handleAttack(message);
}

    /* ========================================================================
       SECTION - C END
       ======================================================================== */

});

/* ========================================================================
   BOT LOGIN
   ======================================================================== */

client.login(process.env.DISCORD_TOKEN);
