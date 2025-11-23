const {
    ForumChannel,
    TextChannel,
    AttachmentBuilder
} = require("discord.js");

const SUGGESTION_CHANNEL_ID = "1441660601460850708";
const PRIORITIES_FORUM_ID = "1441702171136626768";
const MESSAGE_FETCH_LIMIT = 50;
const WHITE_CHECK = "✅";


function getSuggestionChannels(client) {
    const suggestion = client.channels.cache.get(SUGGESTION_CHANNEL_ID);
    const priorities = client.channels.cache.get(PRIORITIES_FORUM_ID);

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

    let title = "";
    let desc = [];
    let found = false;

    for (const line of lines) {
        const trimmed = line.trim();

        if (!found && trimmed.toLowerCase().startsWith("title")) {
            if (trimmed.includes(":")) {
                title = trimmed.split(":")[1]?.trim() || "";
                found = true;
                continue;
            }
        }

        if (found) desc.push(line);
    }

    if (!title || title.length < 1)
        return null;

    return {
        title,
        content: desc.join("\n").trim()
    };
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
async function postSuggestionsToPriorities(client, limit = MESSAGE_FETCH_LIMIT) {
    const { suggestion, priorities, errors } = getSuggestionChannels(client);

    if (errors.length) {
        errors.forEach(e => console.log("[ERROR]", e));
        return;
    }

    await clearForumThreads(priorities);

    const suggestions = await fetchSuggestions(suggestion, limit);

    let posted = 0;

for (const msg of suggestions.reverse()) {
        const fields = extractSuggestionFields(msg);

        if (!fields) continue;

        const { title, content } = fields;

        const finalText = `${content}\n\n${msg.url}`;
        const files = await getAttachments(msg);

        if (await postPriorityThread(priorities, title, finalText, files)) {
            posted++;
        }
    }

    console.log(`[INFO] Posted ${posted} suggestions.`);
}

module.exports = { postSuggestionsToPriorities };
