// main.js

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

const MASTER_ROLE_ID = "1441923802937430156";

function hasMasterRole(member) {
    return member.roles.cache.has(MASTER_ROLE_ID);
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

    // check if message starts with command prefix
    if (!message.content.startsWith(PREFIX)) return;

    // extract the command name
    const [cmd] = message.content.slice(PREFIX.length).split(" ");



/* ========================================================================
   SECTION - C START
   this section contains things that related to bot commands
   ======================================================================== */

    // command: sync library
    // scans the library channel, checks for proper message format,
    // counts reacts with the emoji "✅",
    // then posts messages into the library forum sorted by reaction count
    if (cmd === "sync_lib") {

        // check master role
        if (!hasMasterRole(message.member)) {
            return message.reply("knsme3 4ir ll3esas , 7ta tched lgrade w sowel fya")
        }

        await message.delete().catch(() => {});
        await postLibraryMessagesToForum(client);
    }

    // command: sync suggestions
    // scans suggestions channel, looks for messages with a Title field,
    // counts reacts with "✅", collects images,
    // then posts them into the priorities forum sorted by reaction count
    if (cmd === "sync_sugg") {

        // check master role
        if (!hasMasterRole(message.member)) {
            return message.reply("knsme3 4ir ll3esas , 7ta tched lgrade w sowel fya")
        }

        await message.delete().catch(() => {});
        await postSuggestionsToPriorities(client);
    }

    // 9lat ma ydar 
    if (cmd === "bobiz") {
        await handleBobiz(message);  // call the separate logic
    }


/* ========================================================================
   SECTION - C END
   ======================================================================== */

});


/* ========================================================================
   BOT LOGIN
   ======================================================================== */

client.login(process.env.DISCORD_TOKEN);
