const {
    ForumChannel,
    TextChannel,
    AttachmentBuilder,
    ChannelType
} = require("discord.js");

const { getServerConfig } = require("../databases/servers");

const MESSAGE_FETCH_LIMIT = 50;
const WHITE_CHECK = "✅";
const MINIMUM_REACTIONS = 1;

/* ---------------------------------------------------------
   SAFE CHANNEL FETCHER
--------------------------------------------------------- */

/**
 * Safely fetch and validate a channel.
 * Handles: missing channel, missing access, wrong type.
 * @param {Client} client
 * @param {string} channelId
 * @param {ChannelType} expectedType
 * @returns {Promise<{channel: any, error: string|null}>}
 */
async function safeGetChannel(client, channelId, expectedType) {
    try {
        const channel = await client.channels.fetch(channelId).catch(() => null);

        if (!channel) {
            return {
                channel: null,
                error: `[Missing] Channel ${channelId} does not exist or bot cannot access it`
            };
        }

        if (channel.type !== expectedType) {
            return {
                channel: null,
                error: `[Invalid] Channel ${channelId} is not type ${expectedType}`
            };
        }

        return { channel, error: null };
    } catch (err) {
        return {
            channel: null,
            error: `[Error] Cannot fetch channel ${channelId}: ${err.message}`
        };
    }
}

/* ---------------------------------------------------------
   CHANNEL RETRIEVAL
--------------------------------------------------------- */

async function getSuggestionChannels(client, guildId) {
    const config = await getServerConfig(guildId);

    if (!config) {
        return {
            suggestion: null,
            priorities: null,
            errors: [`Server ${guildId} is not configured in database`]
        };
    }

    const errors = [];

    const { channel: suggestion, error: e1 } =
        await safeGetChannel(client, config.SUGGESTION_CHANNEL_ID, ChannelType.GuildText);

    const { channel: priorities, error: e2 } =
        await safeGetChannel(client, config.PRIORITIES_SUGGESTION_FORUM_ID, ChannelType.GuildForum);

    if (e1) errors.push(e1);
    if (e2) errors.push(e2);

    return { suggestion, priorities, errors };
}

/* ---------------------------------------------------------
   CLEAR FORUM THREADS (SAFE)
--------------------------------------------------------- */

async function clearForumThreads(forum) {
    if (!forum) {
        console.log("[ERROR] Cannot clear forum: Forum is null");
        return;
    }

    console.log("[INFO] Clearing priorities forum...");

    try {
        const active = await forum.threads.fetchActive().catch(() => ({ threads: new Map() }));
        const archived = await forum.threads.fetchArchived().catch(() => ({ threads: new Map() }));

        const allThreads = [
            ...active.threads.values(),
            ...archived.threads.values()
        ];

        let deletedCount = 0;

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

function getCheckmarkCount(msg) {
    const r = msg.reactions.cache.find(r => r.emoji.name === WHITE_CHECK);
    return r ? r.count : 0;
}

async function fetchSuggestions(channel, limit) {
    try {
        const messages = await channel.messages.fetch({ limit });
        const arr = [...messages.values()];

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

async function postSuggestionsToPriorities(client, guildId, limit = MESSAGE_FETCH_LIMIT) {

    const { suggestion, priorities, errors } = await getSuggestionChannels(client, guildId);

    if (errors.length > 0) {
        console.log("[ERROR] Channel configuration issues:");
        errors.forEach(e => console.log("  -", e));
        return;
    }

    // Clear old threads
    await clearForumThreads(priorities);

    // Fetch suggestions
    const suggestions = await fetchSuggestions(suggestion, limit);

    let postedCount = 0;

    for (const msg of suggestions.reverse()) {
        if (getCheckmarkCount(msg) < MINIMUM_REACTIONS) continue;

        const fields = extractSuggestionFields(msg);
        if (!fields) continue;

        const finalText = `${fields.content}\n\n${msg.url}`;
        const files = await getAttachments(msg);

        const success = await postPriorityThread(priorities, fields.title, finalText, files);
        if (success) postedCount++;
    }

    console.log(`[INFO] Posted ${postedCount} suggestions for server ${guildId}.`);
}

module.exports = { postSuggestionsToPriorities };
