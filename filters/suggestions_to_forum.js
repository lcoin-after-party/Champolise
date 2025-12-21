const {
    ForumChannel,
    TextChannel,
    AttachmentBuilder,
    ChannelType
} = require("discord.js");

const { getServerConfig } = require("../databases/servers");

// Constants for the module
const MESSAGE_FETCH_LIMIT = 50;      // Default number of messages to fetch from a channel
const WHITE_CHECK = "✅";            // Emoji used to count reactions
const MINIMUM_REACTIONS = 1;         // Minimum number of reactions for a suggestion to be considered

/* ---------------------------------------------------------
   SAFE CHANNEL FETCHER
--------------------------------------------------------- */

/**
 * Safely fetch and validate a channel.
 * Handles: missing channel, missing access, wrong type.
 * @param {Client} client - Discord client instance
 * @param {string} channelId - ID of the channel to fetch
 * @param {ChannelType} expectedType - Expected type of the channel
 * @returns {Promise<{channel: any, error: string|null}>} - Returns channel or error message
 */
async function safeGetChannel(client, channelId, expectedType) {
    try {
        // Attempt to fetch the channel
        const channel = await client.channels.fetch(channelId).catch(() => null);

        // Handle missing channel
        if (!channel) {
            return {
                channel: null,
                error: `[Missing] Channel ${channelId} does not exist or bot cannot access it`
            };
        }

        // Handle wrong channel type
        if (channel.type !== expectedType) {
            return {
                channel: null,
                error: `[Invalid] Channel ${channelId} is not type ${expectedType}`
            };
        }

        // Successfully fetched and validated
        return { channel, error: null };
    } catch (err) {
        // Catch-all error handler
        return {
            channel: null,
            error: `[Error] Cannot fetch channel ${channelId}: ${err.message}`
        };
    }
}

/* ---------------------------------------------------------
   CHANNEL RETRIEVAL
--------------------------------------------------------- */

/**
 * Retrieves the suggestion and priorities channels for a server.
 * @param {Client} client - Discord client
 * @param {string} guildId - Server ID
 * @returns {Promise<{suggestion: TextChannel, priorities: ForumChannel, errors: string[]}>}
 */
async function getSuggestionChannels(client, guildId) {
    const config = await getServerConfig(guildId); // Fetch server config from database

    if (!config) {
        return {
            suggestion: null,
            priorities: null,
            errors: [`Server ${guildId} is not configured in database`]
        };
    }

    const errors = [];

    // Fetch suggestion channel
    const { channel: suggestion, error: e1 } =
        await safeGetChannel(client, config.SUGGESTION_CHANNEL_ID, ChannelType.GuildText);

    // Fetch priorities forum channel
    const { channel: priorities, error: e2 } =
        await safeGetChannel(client, config.PRIORITIES_SUGGESTION_FORUM_ID, ChannelType.GuildForum);

    if (e1) errors.push(e1);
    if (e2) errors.push(e2);

    return { suggestion, priorities, errors };
}

/* ---------------------------------------------------------
   CLEAR FORUM THREADS (SAFE)
--------------------------------------------------------- */

/**
 * Deletes all threads (active and archived) from a forum channel.
 * @param {ForumChannel} forum - Forum channel to clear
 */
async function clearForumThreads(forum) {
    if (!forum) {
        console.log("[ERROR] Cannot clear forum: Forum is null");
        return;
    }

    console.log("[INFO] Clearing priorities forum...");

    try {
        // Fetch active and archived threads safely
        const active = await forum.threads.fetchActive().catch(() => ({ threads: new Map() }));
        const archived = await forum.threads.fetchArchived().catch(() => ({ threads: new Map() }));

        // Combine all threads
        const allThreads = [
            ...active.threads.values(),
            ...archived.threads.values()
        ];

        let deletedCount = 0;

        // Delete each thread
        for (const thread of allThreads) {
            try {
                await thread.delete();
                deletedCount++;
            } catch (err) {
                console.log("[ERROR] Failed deleting thread:", err.message);
            }
        }

        console.log(`[INFO] Deleted ${deletedCount} threads.`);
    } catch (err) {
        console.log("[ERROR] Unable to clear forum threads:", err.message);
    }
}

/* ---------------------------------------------------------
   SUGGESTION UTILITIES
--------------------------------------------------------- */

/**
 * Counts the number of ✅ reactions on a message.
 * @param {Message} msg - Discord message
 * @returns {number} - Number of checkmark reactions
 */
function getCheckmarkCount(msg) {
    const r = msg.reactions.cache.find(r => r.emoji.name === WHITE_CHECK);
    return r ? r.count : 0;
}

/**
 * Fetches messages from a channel and sorts them by reactions.
 * @param {TextChannel} channel - Channel to fetch messages from
 * @param {number} limit - Number of messages to fetch
 * @returns {Promise<Message[]>} - Sorted array of messages
 */
async function fetchSuggestions(channel, limit) {
    try {
        const messages = await channel.messages.fetch({ limit });
        const arr = [...messages.values()];

        // Sort messages: highest reactions first, then oldest first
        arr.sort((a, b) => {
            const ra = getCheckmarkCount(a);
            const rb = getCheckmarkCount(b);
            return ra !== rb ? rb - ra : a.createdTimestamp - b.createdTimestamp;
        });

        return arr;
    } catch (err) {
        console.log("[ERROR] Cannot fetch messages:", err.message);
        return [];
    }
}

/**
 * Extracts title and content from a suggestion message.
 * Looks for lines starting with "title", "titre" or "العنوان"
 * @param {Message} msg
 * @returns {{title: string, content: string}|null}
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
    return null; // No valid title found
}

/**
 * Downloads image attachments from a message and returns them as AttachmentBuilder objects.
 * @param {Message} msg
 * @returns {Promise<AttachmentBuilder[]>}
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
                console.log("[ERROR] Failed downloading attachment:", err.message);
            }
        }
    }

    return attachments;
}

/* ---------------------------------------------------------
   CREATE THREAD SAFELY
--------------------------------------------------------- */

/**
 * Creates a new thread in a forum channel with a given title, content, and attachments.
 * @param {ForumChannel} forum
 * @param {string} title
 * @param {string} content
 * @param {AttachmentBuilder[]} files
 * @returns {Promise<boolean>} - True if created successfully
 */
async function postPriorityThread(forum, title, content, files) {
    try {
        await forum.threads.create({
            name: title,
            message: { content, files }
        });
        return true;
    } catch (err) {
        console.log("[ERROR] Failed creating thread:", err.message);
        return false;
    }
}

/* ---------------------------------------------------------
   MAIN FUNCTION
--------------------------------------------------------- */

/**
 * Main function to process suggestions and post them as priority threads.
 * @param {Client} client
 * @param {string} guildId
 * @param {number} limit - Max messages to fetch
 */
async function postSuggestionsToPriorities(client, guildId, limit = MESSAGE_FETCH_LIMIT) {

    const { suggestion, priorities, errors } = await getSuggestionChannels(client, guildId);

    if (errors.length > 0) {
        console.log("[ERROR] Channel configuration issues:");
        errors.forEach(e => console.log("  -", e));
        return;
    }

    // Clear old threads before posting new ones
    await clearForumThreads(priorities);

    // Fetch and sort suggestions
    const suggestions = await fetchSuggestions(suggestion, limit);

    let postedCount = 0;

    for (const msg of suggestions.reverse()) { // Reverse to post oldest first
        if (getCheckmarkCount(msg) < MINIMUM_REACTIONS) continue; // Skip low reaction messages

        const fields = extractSuggestionFields(msg);
        if (!fields) continue; // Skip if no title/content found

        const finalText = `${fields.content}\n\n${msg.url}`;
        const files = await getAttachments(msg);

        const success = await postPriorityThread(priorities, fields.title, finalText, files);
        if (success) postedCount++;
    }

    console.log(`[INFO] Posted ${postedCount} suggestions for server ${guildId}.`);
}

module.exports = { postSuggestionsToPriorities };
