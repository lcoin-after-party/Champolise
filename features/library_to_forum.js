const {
    ForumChannel,
    TextChannel,
    AttachmentBuilder
} = require("discord.js");

const LIBRARY_CHANNEL_ID = "1441676274790563920";
const BEST_BOOKS_FORUM_ID = "1441676312560533658";
const MESSAGE_FETCH_LIMIT = 50;

function getChannels(client) {
    const library = client.channels.cache.get(LIBRARY_CHANNEL_ID);
    const bestBooks = client.channels.cache.get(BEST_BOOKS_FORUM_ID);

    const errors = [];

    if (!(library instanceof TextChannel))
        errors.push(`Library channel missing or not a TextChannel`);

    if (!(bestBooks instanceof ForumChannel))
        errors.push(`Forum channel missing or not a ForumChannel`);

    return { library, bestBooks, errors };
}

async function clearForumThreads(forum) {
    console.log("[INFO] Clearing forum threads...");

    const threads = await forum.threads.fetchActive();
    const archived = await forum.threads.fetchArchived();

    const all = [...threads.threads.values(), ...archived.threads.values()];

    let deleted = 0;

    for (const t of all) {
        try {
            await t.delete();
            deleted++;
        } catch (err) {
            console.log("[ERROR] Could not delete thread:", err);
        }
    }

    console.log(`[INFO] Deleted ${deleted} threads.`);
}

function getCheckmarkCount(message) {
    const reaction = message.reactions.cache.find(r => r.emoji.name === "✅");
    return reaction ? reaction.count : 0;
}

async function fetchAndSortMessages(channel, limit) {
    const msgs = await channel.messages.fetch({ limit });
    const arr = [...msgs.values()];

    return arr.sort((a, b) => getCheckmarkCount(a) - getCheckmarkCount(b));
}

function extractFields(msg) {
    const lines = msg.content.split("\n").map(l => l.trim());

    let title = "";
    let description = [];
    let found = false;

    for (const line of lines) {
        if (!found && line.toLowerCase().startsWith("title :")) {
            title = line.split(":")[1].trim();
            found = true;
        } else if (found) {
            description.push(line);
        }
    }

    return { title, description: description.join("\n") };
}

async function getAttachments(msg) {
    const files = [];

    for (const a of msg.attachments.values()) {
        if (a.contentType && a.contentType.startsWith("image")) {
            try {
                const res = await fetch(a.url);
                const buffer = Buffer.from(await res.arrayBuffer());

                files.push(new AttachmentBuilder(buffer, { name: a.name }));
            } catch (err) {
                console.log("[ERROR] Failed to fetch attachment:", err);
            }
        }
    }

    return files;
}

async function postMessageToForum(forum, title, content, files) {
    try {
        await forum.threads.create({
            name: title,
            message: {
                content,
                files
            }
        });
        return true;
    } catch (err) {
        console.log("[ERROR] Failed to create thread:", err);
        return false;
    }
}

async function postLibraryMessagesToForum(client, limit = MESSAGE_FETCH_LIMIT) {
    const { library, bestBooks, errors } = getChannels(client);

    if (errors.length) {
        errors.forEach(e => console.log("[ERROR]", e));
        return;
    }

    await clearForumThreads(bestBooks);

    const messages = await fetchAndSortMessages(library, limit);

    let processed = 0;

    for (const msg of messages) {
        const { title, description } = extractFields(msg);
        if (!title) continue;

        const content = `${description}\n\n${msg.url}`;
        const files = await getAttachments(msg);

        const ok = await postMessageToForum(bestBooks, title, content, files);
        if (ok) processed++;
    }

    console.log(`[INFO] Processed ${processed} messages.`);
}

module.exports = { postLibraryMessagesToForum };
