const { ForumChannel, TextChannel, AttachmentBuilder } = require("discord.js");
const { getServerConfig } = require("../databases/servers");

const MESSAGE_FETCH_LIMIT = 50;
const WHITE_CHECK = "✅";
const MINIMUM_REACTIONS = 0;

/**
 * Retrieves the suggestion and priority channels for a server.
 * @param {Client} client Discord.js client instance
 * @param {string} guildId Server ID
 * @returns {Object} suggestion channel, priorities forum, and any errors
 */
function getSuggestionChannels(client, guildId) {
    const config = getServerConfig(guildId);
    if (!config) {
        return { suggestion: null, priorities: null, errors: [`Server ${guildId} not configured`] };
    }

    const suggestion = client.channels.cache.get(config.SUGGESTION_CHANNEL_ID);
    const priorities = client.channels.cache.get(config.PRIORITIES_SUGGESTION_FORUM_ID);
    const errors = [];

    if (!(suggestion instanceof TextChannel)) errors.push("Suggestion channel missing or invalid");
    if (!(priorities instanceof ForumChannel)) errors.push("Priorities forum missing or invalid");

    return { suggestion, priorities, errors };
}

/**
 * Deletes all threads in a forum channel, both active and archived.
 * @param {ForumChannel} forum The forum channel to clear
 */
async function clearForumThreads(forum) {
    console.log("[INFO] Clearing priorities forum...");

    const activeThreads = await forum.threads.fetchActive();
    const archivedThreads = await forum.threads.fetchArchived();
    const allThreads = [...activeThreads.threads.values(), ...archivedThreads.threads.values()];

    let deletedCount = 0;
    for (const thread of allThreads) {
        try {
            await thread.delete();
            deletedCount++;
        } catch (err) {
            console.log("[ERROR] Could not delete thread:", err);
        }
    }

    console.log(`[INFO] Deleted ${deletedCount} threads.`);
}

/**
 * Counts how many ✅ reactions a message has.
 * @param {Message} msg Discord message
 * @returns {number} Number of checkmark reactions
 */
function getCheckmarkCount(msg) {
    const reaction = msg.reactions.cache.find(r => r.emoji.name === WHITE_CHECK);
    return reaction ? reaction.count : 0;
}

/**
 * Fetches messages from a channel and sorts them by checkmarks and timestamp.
 * @param {TextChannel} channel Discord text channel
 * @param {number} limit Maximum number of messages to fetch
 * @returns {Promise<Message[]>} Sorted array of messages
 */
async function fetchSuggestions(channel, limit) {
    const messages = await channel.messages.fetch({ limit });
    const msgArray = [...messages.values()];

    msgArray.sort((a, b) => {
        const ra = getCheckmarkCount(a);
        const rb = getCheckmarkCount(b);
        return ra !== rb ? rb - ra : a.createdTimestamp - b.createdTimestamp;
    });

    return msgArray;
}

/**
 * Extracts title and content from a suggestion message.
 * Looks for keywords in multiple languages in the first 4 lines.
 * @param {Message} msg Discord message
 * @returns {Object|null} Object with title and content or null if not found
 */
function extractSuggestionFields(msg) {
    const lines = msg.content.split("\n");
    for (let i = 0; i < Math.min(4, lines.length); i++) {
        const line = lines[i].trim();
        const match = line.match(/^(?:[^a-zA-Z\u0600-\u06FF]*)(title|titre|العنوان)\s*:\s*(.+)$/i);
        if (match) {
            const title = match[2].trim();
            const content = lines.slice(i + 1).join("\n").trim();
            return { title, content };
        }
    }
    return null;
}

/**
 * Downloads and prepares image attachments from a message for reposting.
 * @param {Message} msg Discord message
 * @returns {Promise<AttachmentBuilder[]>} Array of attachments
 */
async function getAttachments(msg) {
    const attachments = [];
    for (const a of msg.attachments.values()) {
        if (a.contentType?.startsWith("image")) {
            try {
                const response = await fetch(a.url);
                const buffer = Buffer.from(await response.arrayBuffer());
                attachments.push(new AttachmentBuilder(buffer, { name: a.name }));
            } catch (err) {
                console.log("[ERROR] Failed downloading attachment:", err);
            }
        }
    }
    return attachments;
}

/**
 * Creates a new thread in the priorities forum with given content and attachments.
 * @param {ForumChannel} forum Forum channel
 * @param {string} title Thread title
 * @param {string} content Thread content
 * @param {AttachmentBuilder[]} files Files to attach
 * @returns {Promise<boolean>} True if thread created successfully
 */
async function postPriorityThread(forum, title, content, files) {
    try {
        await forum.threads.create({
            name: title,
            message: { content, files }
        });
        return true;
    } catch (err) {
        console.log("[ERROR] Failed creating thread:", err);
        return false;
    }
}

/**
 * Main function: Fetches suggestions from a text channel and posts them
 * to the priorities forum after clearing existing threads.
 * @param {Client} client Discord.js client
 * @param {string} guildId Server ID
 * @param {number} limit Number of messages to fetch
 */
async function postSuggestionsToPriorities(client, guildId, limit = MESSAGE_FETCH_LIMIT) {
    const { suggestion, priorities, errors } = getSuggestionChannels(client, guildId);

    if (errors.length) {
        errors.forEach(e => console.log("[ERROR]", e));
        return;
    }

    await clearForumThreads(priorities);
    const suggestions = await fetchSuggestions(suggestion, limit);

    let postedCount = 0;
    for (const msg of suggestions.reverse()) {
        if (getCheckmarkCount(msg) < MINIMUM_REACTIONS) continue;

        const fields = extractSuggestionFields(msg);
        if (!fields) continue;

        const finalText = `${fields.content}\n\n${msg.url}`;
        const files = await getAttachments(msg);

        if (await postPriorityThread(priorities, fields.title, finalText, files)) {
            postedCount++;
        }
    }

    console.log(`[INFO] Posted ${postedCount} suggestions for server ${guildId}.`);
}

module.exports = { postSuggestionsToPriorities };
