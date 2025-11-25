const {
    ForumChannel,
    TextChannel,
    AttachmentBuilder
} = require("discord.js");

const { getServerConfig } = require("../databases/servers");

const MESSAGE_FETCH_LIMIT = 50;
const WHITE_CHECK = "✅";
const MINIMUM_REACTIONS = 0;

function getSuggestionChannels(client, guildId) {
    const config = getServerConfig(guildId);
    
    if (!config) {
        return { 
            suggestion: null, 
            priorities: null, 
            errors: [`Server ${guildId} not configured`] 
        };
    }

    const suggestion = client.channels.cache.get(config.SUGGESTION_CHANNEL_ID);
    const priorities = client.channels.cache.get(config.PRIORITIES_SUGGESTION_FORUM_ID);

    const errors = [];

    if (!(suggestion instanceof TextChannel))
        errors.push("Suggestion channel missing or invalid");

    if (!(priorities instanceof ForumChannel))
        errors.push("Priorities forum missing or invalid");

    return { suggestion, priorities, errors };
}

async function clearForumThreads(forum) {
    console.log("[INFO] Clearing priorities forum...");

    const active = await forum.threads.fetchActive();
    const archived = await forum.threads.fetchArchived();

    const all = [...active.threads.values(), ...archived.threads.values()];
    let deleted = 0;

    for (const t of all) {
        try {
            await t.delete();
            deleted++;
        } catch (e) {
            console.log("[ERROR] Could not delete:", e);
        }
    }

    console.log(`[INFO] Deleted ${deleted} threads.`);
}

function getCheckmarkCount(msg) {
    const r = msg.reactions.cache.find(r => r.emoji.name === WHITE_CHECK);
    return r ? r.count : 0;
}

async function fetchSuggestions(channel, limit) {
    const msgs = await channel.messages.fetch({ limit });
    const arr = [...msgs.values()];

    arr.sort((a, b) => {
        const ra = getCheckmarkCount(a);
        const rb = getCheckmarkCount(b);

        if (ra !== rb) return rb - ra;
        return a.createdTimestamp - b.createdTimestamp;
    });

    return arr;
}

function extractSuggestionFields(msg) {
    const lines = msg.content.split("\n");

    if (lines.length === 0) return null;

    // Check the first 4 lines (or fewer if there aren't 4)
    for (let i = 0; i < Math.min(4, lines.length); i++) {
        const line = lines[i].trim();
        const match = line.match(/^(?:[^a-zA-Z\u0600-\u06FF]*)(title|titre|العنوان)\s*:\s*(.+)$/i);

        if (match) {
            const title = match[2].trim();
            const content = lines.slice(i + 1).join("\n").trim(); // All lines after the matched line
            return { title, content };
        }
    }

    // No title found in the first 4 lines
    return null;
}

async function getAttachments(msg) {
    const files = [];

    for (const a of msg.attachments.values()) {
        if (a.contentType && a.contentType.startsWith("image")) {
            try {
                const response = await fetch(a.url);
                const buffer = Buffer.from(await response.arrayBuffer());
                files.push(new AttachmentBuilder(buffer, { name: a.name }));
            } catch (err) {
                console.log("[ERROR] Failed downloading attachment:", err);
            }
        }
    }

    return files;
}

async function postPriorityThread(forum, title, content, files) {
    try {
        await forum.threads.create({
            name: title,
            message: {
                content,
                files
            }
        });
        return true;
    } catch (e) {
        console.log("[ERROR] Failed creating thread:", e);
        return false;
    }
}

// -----------------------------
// MAIN FUNCTION
// -----------------------------
async function postSuggestionsToPriorities(client, guildId, limit = MESSAGE_FETCH_LIMIT) {
    const { suggestion, priorities, errors } = getSuggestionChannels(client, guildId);

    if (errors.length) {
        errors.forEach(e => console.log("[ERROR]", e));
        return;
    }

    await clearForumThreads(priorities);

    const suggestions = await fetchSuggestions(suggestion, limit);

    let posted = 0;

    for (const msg of suggestions.reverse()) {

        // ✅ MINIMAL CHANGE ADDED HERE
        if (getCheckmarkCount(msg) < MINIMUM_REACTIONS) continue;

        const fields = extractSuggestionFields(msg);

        if (!fields) continue;

        const { title, content } = fields;

        const finalText = `${content}\n\n${msg.url}`;
        const files = await getAttachments(msg);

        if (await postPriorityThread(priorities, title, finalText, files)) {
            posted++;
        }
    }

    console.log(`[INFO] Posted ${posted} suggestions for server ${guildId}.`);
}

module.exports = { postSuggestionsToPriorities };