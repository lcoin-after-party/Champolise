// load environment variables
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const {
    ForumChannel,
    TextChannel,
    AttachmentBuilder
} = require("discord.js");

const LIBRARY_CHANNEL_ID = process.env.LIBRARY_CHANNEL_ID;
const LIBRARY_RANKED_BOOKS_ID = process.env.LIBRARY_RANKED_BOOKS_ID;
const MESSAGE_FETCH_LIMIT = 100;
const PROCESSED_FILE = path.join(__dirname, "processedBooks.json");

// ----------- DYNAMIC NODE-FETCH IMPORT -----------
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

// ----------- JSON HANDLING -----------
function loadProcessedBooks() {
    if (!fs.existsSync(PROCESSED_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(PROCESSED_FILE, "utf-8"));
    } catch (err) {
        console.log("[ERROR] Failed to load processed books:", err);
        return {};
    }
}

function saveProcessedBooks(data) {
    try {
        fs.writeFileSync(PROCESSED_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.log("[ERROR] Failed to save processed books:", err);
    }
}

// ----------- CHANNELS -----------
function getChannels(client) {
    const library = client.channels.cache.get(LIBRARY_CHANNEL_ID);
    const bestBooks = client.channels.cache.get(LIBRARY_RANKED_BOOKS_ID);

    const errors = [];
    if (!(library instanceof TextChannel))
        errors.push(`Library channel missing or not a TextChannel`);
    if (!(bestBooks instanceof ForumChannel))
        errors.push(`Forum channel missing or not a ForumChannel`);

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
        const options = { limit: 100 };
        if (lastId) options.before = lastId;

        const messages = await channel.messages.fetch(options);
        if (messages.size === 0) break;

        allMessages.push(...messages.values());
        lastId = messages.last().id;
    }
    return allMessages;
}

async function fetchRecentMessages(channel, limit) {
    const msgs = await channel.messages.fetch({ limit });
    return [...msgs.values()];
}

// ----------- REACTIONS & FIELDS -----------
function getCheckmarkCount(message) {
    const reaction = message.reactions.cache.find(r => r.emoji.name === "✅" || r.emoji.name === "❤️");
    return reaction ? reaction.count : 0;
}

function extractFields(msg) {
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
async function postLibraryMessagesToForum(client) {
    const { library, bestBooks, errors } = getChannels(client);
    if (errors.length) {
        errors.forEach(e => console.log("[ERROR]", e));
        return;
    }

    const processedBooks = loadProcessedBooks();
    let messages;

    if (Object.keys(processedBooks).length === 0) {
        console.log("[INFO] JSON empty. Scanning entire library channel...");
        messages = await fetchAllMessages(library);
    } else {
        console.log("[INFO] Fetching latest messages...");
        messages = await fetchRecentMessages(library, MESSAGE_FETCH_LIMIT);
    }

    // --- Process new messages ---
    for (const msg of messages) {
        const { title, description } = extractFields(msg);
        if (!title) continue;

        const url = msg.url;
        const reactions = getCheckmarkCount(msg);

        if (!processedBooks[url]) {
            processedBooks[url] = { title, description, reactions, url, attachments: [] };
        } else {
            processedBooks[url].reactions = reactions;
        }

        // Fetch attachments if not already saved
        if (!processedBooks[url].attachments || processedBooks[url].attachments.length === 0) {
            const attachments = await getAttachments(msg);
            processedBooks[url].attachments = attachments.map(a => ({ name: a.name, buffer: a.attachment.toString("base64") }));
        }
    }

    // --- Update reactions for all books from JSON ---
    for (const url of Object.keys(processedBooks)) {
        try {
            const msg = await library.messages.fetch(url);
            if (msg) {
                processedBooks[url].reactions = getCheckmarkCount(msg);
            }
        } catch (err) {
            console.log(`[WARN] Could not fetch message for ${url}:`, err.message);
        }
    }

// --- Sort by reactions descending, then reverse for posting ---
const booksArray = Object.values(processedBooks)
    .sort((a, b) => b.reactions - a.reactions)
    .reverse(); // now the highest reactions are posted last

    // --- Clear forum threads ---
    await clearForumThreads(bestBooks);

    // --- Post all books to forum ---
    for (const book of booksArray) {
        const files = book.attachments.map(a => new AttachmentBuilder(Buffer.from(a.buffer, "base64"), { name: a.name }));
        const content = `${book.description}\n\n${book.url}`;
        await postMessageToForum(bestBooks, book.title, content, files);
    }

    saveProcessedBooks(processedBooks);
    console.log(`[INFO] Posted ${booksArray.length} books to the forum.`);
}

module.exports = { postLibraryMessagesToForum };
