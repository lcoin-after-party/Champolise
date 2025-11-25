const fs = require("fs");
const path = require("path");
const {
    ForumChannel,
    TextChannel,
    AttachmentBuilder
} = require("discord.js");

const { getServerConfig } = require("../databases/servers");

const MESSAGE_FETCH_LIMIT = 100;

// ----------- DYNAMIC NODE-FETCH IMPORT -----------
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

// ----------- JSON HANDLING -----------
function getProcessedFilePath(guildId) {
    return path.join(__dirname, `processedBooks_${guildId}.json`);
}

function loadProcessedBooks(guildId) {
    const filePath = getProcessedFilePath(guildId);
    if (!fs.existsSync(filePath)) return {};
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (err) {
        console.log("[ERROR] Failed to load processed books:", err);
        return {};
    }
}

function saveProcessedBooks(guildId, data) {
    const filePath = getProcessedFilePath(guildId);
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (err) {
        console.log("[ERROR] Failed to save processed books:", err);
    }
}

// ----------- CHANNELS -----------
async function getChannels(client, guildId) {
    const config = getServerConfig(guildId);
    
    if (!config) {
        return { library: null, bestBooks: null, errors: [`Server ${guildId} not configured`] };
    }

    const errors = [];
    let library = null;
    let bestBooks = null;

    try {
        library = await client.channels.fetch(config.LIBRARY_CHANNEL_ID, { cache: false });
        if (!(library instanceof TextChannel)) errors.push(`Library channel missing or not a TextChannel`);
    } catch {
        errors.push(`Could not fetch library channel from API`);
    }

    try {
        bestBooks = await client.channels.fetch(config.LIBRARY_RANKED_BOOKS_ID, { cache: false });
        if (!(bestBooks instanceof ForumChannel)) errors.push(`Forum channel missing or not a ForumChannel`);
    } catch {
        errors.push(`Could not fetch forum channel from API`);
    }

    return { library, bestBooks, errors };
}

// ----------- CLEAR FORUM THREADS -----------
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

// ----------- FETCH MESSAGES -----------
async function fetchAllMessages(channel) {
    let allMessages = [];
    let lastId;

    while (true) {
        const options = { limit: 100, cache: false };
        if (lastId) options.before = lastId;

        const messages = await channel.messages.fetch(options);
        if (messages.size === 0) break;

        allMessages.push(...messages.values());
        lastId = messages.last().id;
    }
    return allMessages;
}

async function fetchRecentMessages(channel, limit) {
    const msgs = await channel.messages.fetch({ limit, cache: false });
    return [...msgs.values()];
}

// ----------- REACTIONS & FIELDS -----------
async function getCheckmarkCount(message) {
    try {
        const reactions = await message.reactions.fetch();
        const reaction = reactions.find(r => r.emoji.name === "✅" || r.emoji.name === "❤️");
        return reaction ? reaction.count : 0;
    } catch {
        return 0;
    }
}

function extractFields(msg) {
    if ("title" in msg && "description" in msg) {
        const { title, description } = msg;
        return { title, description };
    }
    const lines = msg.content.split("\n");
    if (lines.length === 0) return { title: "", description: "" };

    let title = "";
    let titleLineIndex = -1;

    for (let i = 0; i < Math.min(4, lines.length); i++) {
        const line = lines[i].trim();
        const match = line.match(/(?:.*?)(title|titre|العنوان)\s*:\s*(.+)/i);
        if (match) {
            title = match[2].trim();
            titleLineIndex = i;
            break;
        }
    }

    if (!title) return { title: "", description: "" };
    const description = lines.slice(titleLineIndex + 1).join("\n");
    return { title, description };
}

// ----------- ATTACHMENTS -----------
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

// ----------- POST TO FORUM -----------
async function postMessageToForum(forum, title, content, files) {
    try {
        await forum.threads.create({
            name: title,
            message: { content, files }
        });
        return true;
    } catch (err) {
        console.log("[ERROR] Failed to create thread:", err);
        return false;
    }
}

// ----------- MAIN FUNCTION -----------
async function postLibraryMessagesToForum(client, guildId) {
    const { library, bestBooks, errors } = await getChannels(client, guildId);
    if (errors.length) {
        errors.forEach(e => console.log("[ERROR]", e));
        return;
    }

    const processedBooks = loadProcessedBooks(guildId);
    let messages;

    if (Object.keys(processedBooks).length === 0) {
        console.log(`[INFO] JSON empty for server ${guildId}. Scanning entire library channel...`);
        messages = await fetchAllMessages(library);
    } else {
        console.log(`[INFO] Fetching latest messages for server ${guildId}...`);
        messages = await fetchRecentMessages(library, MESSAGE_FETCH_LIMIT);
        messages.push(...Object.values(processedBooks));
    }

    // --- Process new messages ---
    for (const msg of messages) {
        const { title, description } = extractFields(msg);
        if (!title) continue;

        const url = msg.url || msg.id; // fallback if object from JSON
        const reactions = await getCheckmarkCount(msg);

        if (!processedBooks[url]) {
            processedBooks[url] = { title, description, reactions, url, attachments: [] };
        } else {
            processedBooks[url].reactions = reactions;
        }

        // Fetch attachments if not already saved
        if (!processedBooks[url].attachments || processedBooks[url].attachments.length === 0) {
            const attachments = await getAttachments(msg);
            processedBooks[url].attachments = attachments.map(a => ({
                name: a.name,
                buffer: a.attachment.toString("base64")
            }));
        }
    }

    // --- Update reactions for all books from JSON ---
    for (const url of Object.keys(processedBooks)) {
        try {
            const messageId = url.split("/").pop(); // extract message ID from URL
            const msg = await library.messages.fetch(messageId, { cache: false });
            if (msg) {
                processedBooks[url].reactions = await getCheckmarkCount(msg);
            }
        } catch (err) {
            console.log(`[WARN] Could not fetch message for ${url}:`, err.message);
        }
    }

    // --- Sort by reactions descending ---
    const booksArray = Object.values(processedBooks)
        .sort((a, b) => b.reactions - a.reactions);

    // --- Clear forum threads ---
    await clearForumThreads(bestBooks);

    // --- Post all books to forum ---
    for (const book of booksArray) {
        const files = book.attachments.map(a =>
            new AttachmentBuilder(Buffer.from(a.buffer, "base64"), { name: a.name })
        );
        const content = `${book.description}\n\n${book.url}`;
        await postMessageToForum(bestBooks, book.title, content, files);
    }

    saveProcessedBooks(guildId, processedBooks);
    console.log(`[INFO] Posted ${booksArray.length} books to the forum for server ${guildId}.`);
}

module.exports = { postLibraryMessagesToForum };
