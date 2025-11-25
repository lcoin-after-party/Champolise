const fs = require("fs");
const path = require("path");
const { ForumChannel, TextChannel, AttachmentBuilder } = require("discord.js");
const { getServerConfig } = require("../databases/servers");

const MESSAGE_FETCH_LIMIT = 100;

// ----------- DYNAMIC NODE-FETCH IMPORT -----------
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

// ================== JSON HANDLING ==================

/**
 * Returns the path for storing processed books JSON for a guild.
 * @param {string} guildId
 * @returns {string}
 */
function getProcessedFilePath(guildId) {
    return path.join(__dirname, `processedBooks_${guildId}.json`);
}

/**
 * Loads processed books from JSON file.
 * Returns empty object if file doesn't exist or parsing fails.
 * @param {string} guildId
 * @returns {object}
 */
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

/**
 * Saves processed books to JSON file.
 * @param {string} guildId
 * @param {object} data
 */
function saveProcessedBooks(guildId, data) {
    const filePath = getProcessedFilePath(guildId);
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (err) {
        console.log("[ERROR] Failed to save processed books:", err);
    }
}

// ================== CHANNEL HANDLING ==================

/**
 * Fetches the library and forum channels for a server.
 * @param {Client} client
 * @param {string} guildId
 * @returns {Promise<{library: TextChannel|null, bestBooks: ForumChannel|null, errors: string[]}>}
 */
async function getChannels(client, guildId) {
    const config = getServerConfig(guildId);
    const errors = [];

    if (!config) {
        return { library: null, bestBooks: null, errors: [`Server ${guildId} not configured`] };
    }

    const library = await fetchChannel(client, config.LIBRARY_CHANNEL_ID, TextChannel, errors, "Library");
    const bestBooks = await fetchChannel(client, config.LIBRARY_RANKED_BOOKS_ID, ForumChannel, errors, "Forum");

    return { library, bestBooks, errors };
}

/**
 * Helper to fetch a channel and validate its type.
 * @param {Client} client
 * @param {string} channelId
 * @param {Function} expectedType
 * @param {string[]} errors
 * @param {string} name
 * @returns {Promise<Channel|null>}
 */
async function fetchChannel(client, channelId, expectedType, errors, name) {
    try {
        const channel = await client.channels.fetch(channelId, { cache: false });
        if (!(channel instanceof expectedType)) {
            errors.push(`${name} channel missing or wrong type`);
            return null;
        }
        return channel;
    } catch {
        errors.push(`Could not fetch ${name} channel from API`);
        return null;
    }
}

// ================== FORUM THREADS ==================

/**
 * Deletes all active and archived threads in a forum.
 * @param {ForumChannel} forum
 */
async function clearForumThreads(forum) {
    console.log("[INFO] Clearing forum threads...");

    const threads = await forum.threads.fetchActive();
    const archived = await forum.threads.fetchArchived();
    const allThreads = [...threads.threads.values(), ...archived.threads.values()];

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

// ================== MESSAGE FETCHING ==================

/**
 * Fetches all messages from a channel.
 * @param {TextChannel} channel
 * @returns {Promise<Message[]>}
 */
async function fetchAllMessages(channel) {
    let allMessages = [];
    let lastId;

    while (true) {
        const options = { limit: 100, cache: false };
        if (lastId) options.before = lastId;

        const messages = await channel.messages.fetch(options);
        if (!messages.size) break;

        allMessages.push(...messages.values());
        lastId = messages.last().id;
    }

    return allMessages;
}

/**
 * Fetches recent messages from a channel up to a limit.
 * @param {TextChannel} channel
 * @param {number} limit
 * @returns {Promise<Message[]>}
 */
async function fetchRecentMessages(channel, limit) {
    const messages = await channel.messages.fetch({ limit, cache: false });
    return [...messages.values()];
}

// ================== MESSAGE PROCESSING ==================

/**
 * Extracts title and description from a message content.
 * @param {Message} msg
 * @returns {{title: string, description: string}}
 */
function extractFields(msg) {
    if ("title" in msg && "description" in msg) {
        return { title: msg.title, description: msg.description };
    }

    const lines = msg.content.split("\n");
    if (!lines.length) return { title: "", description: "" };

    let title = "";
    let titleLineIndex = -1;

    for (let i = 0; i < Math.min(4, lines.length); i++) {
        const match = lines[i].trim().match(/(?:.*?)(title|titre|العنوان)\s*:\s*(.+)/i);
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

/**
 * Gets the count of ✅ or ❤️ reactions on a message.
 * @param {Message} message
 * @returns {Promise<number>}
 */
async function getCheckmarkCount(message) {
    try {
        const reactions = await message.reactions.fetch();
        const reaction = reactions.find(r => r.emoji.name === "✅" || r.emoji.name === "❤️");
        return reaction ? reaction.count : 0;
    } catch {
        return 0;
    }
}

/**
 * Fetches image attachments from a message as AttachmentBuilder objects.
 * @param {Message} msg
 * @returns {Promise<AttachmentBuilder[]>}
 */
async function getAttachments(msg) {
    const files = [];
    for (const a of msg.attachments.values()) {
        if (a.contentType?.startsWith("image")) {
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

// ================== FORUM POSTING ==================

/**
 * Posts a message as a new thread in a forum.
 * @param {ForumChannel} forum
 * @param {string} title
 * @param {string} content
 * @param {AttachmentBuilder[]} files
 * @returns {Promise<boolean>}
 */
async function postMessageToForum(forum, title, content, files) {
    try {
        await forum.threads.create({ name: title, message: { content, files } });
        return true;
    } catch (err) {
        console.log("[ERROR] Failed to create thread:", err);
        return false;
    }
}

// ================== MAIN LOGIC ==================

/**
 * Main function to post library messages to forum.
 * Handles fetching, processing, sorting, and posting.
 * @param {Client} client
 * @param {string} guildId
 */
async function postLibraryMessagesToForum(client, guildId) {
    const { library, bestBooks, errors } = await getChannels(client, guildId);
    if (errors.length) {
        errors.forEach(e => console.log("[ERROR]", e));
        return;
    }

    const processedBooks = loadProcessedBooks(guildId);
    let messages;

    if (!Object.keys(processedBooks).length) {
        console.log(`[INFO] JSON empty for server ${guildId}. Fetching all library messages...`);
        messages = await fetchAllMessages(library);
    } else {
        console.log(`[INFO] Fetching latest messages for server ${guildId}...`);
        messages = await fetchRecentMessages(library, MESSAGE_FETCH_LIMIT);
        messages.push(...Object.values(processedBooks));
    }

    await processMessages(messages, processedBooks, library);
    const booksArray = sortBooksByReactions(processedBooks);

    await clearForumThreads(bestBooks);
    await postBooksToForum(bestBooks, booksArray);

    saveProcessedBooks(guildId, processedBooks);
    console.log(`[INFO] Posted ${booksArray.length} books to the forum for server ${guildId}.`);
}

/**
 * Processes messages and updates processedBooks object.
 * @param {Message[]} messages
 * @param {object} processedBooks
 * @param {TextChannel} library
 */
async function processMessages(messages, processedBooks, library) {
    for (const msg of messages) {
        const { title, description } = extractFields(msg);
        if (!title) continue;

        const url = msg.url || msg.id; // fallback if JSON object
        const reactions = await getCheckmarkCount(msg);

        if (!processedBooks[url]) {
            processedBooks[url] = {
                title,
                description,
                reactions,
                url,
                attachments: [],
                timestamp: msg.createdTimestamp // <-- store original timestamp
            };
        }
        else {
            processedBooks[url].reactions = reactions;
        }

        if (!processedBooks[url].attachments?.length) {
            const attachments = await getAttachments(msg);
            processedBooks[url].attachments = attachments.map(a => ({
                name: a.name,
                buffer: a.attachment.toString("base64")
            }));
        }
    }

    await updateReactionsFromLibrary(processedBooks, library);
}

/**
 * Updates reaction counts for books from the library channel.
 * Removes entries from processedBooks if the message cannot be fetched.
 * @param {object} processedBooks
 * @param {TextChannel} library
 */
async function updateReactionsFromLibrary(processedBooks, library) {
    for (const url of Object.keys(processedBooks)) {
        try {
            const messageId = url.split("/").pop();
            const msg = await library.messages.fetch(messageId, { cache: false });

            if (msg) {
                processedBooks[url].reactions = await getCheckmarkCount(msg);
            } else {
                console.log(`[WARN] Message not found for ${url}, removing from JSON`);
                delete processedBooks[url]; // Remove from JSON
            }
        } catch (err) {
            if (err.message.includes("Unknown Message")) {
                console.log(`[WARN] Message ${url} deleted or unknown, removing from JSON`);
                delete processedBooks[url]; // Remove deleted/unknown messages
            } else {
                console.log(`[WARN] Could not fetch message for ${url}:`, err.message);
            }
        }
    }
}

/**
 * Sorts processedBooks by reactions descending.
 * If reactions are equal, sorts by message timestamp (older first).
 * @param {object} processedBooks
 * @returns {object[]}
 */
function sortBooksByReactions(processedBooks) {
    return Object.values(processedBooks).sort((a, b) => {
        // Primary sort: reactions descending
        if (a.reactions !== b.reactions) return a.reactions - b.reactions;

        // Secondary sort: timestamp ascending (older first)
        return b.timestamp - a.timestamp;
    });
}


/**
 * Posts books to a forum channel.
 * @param {ForumChannel} forum
 * @param {object[]} booksArray
 */
async function postBooksToForum(forum, booksArray) {
    for (const book of booksArray) {
        const files = book.attachments.map(a =>
            new AttachmentBuilder(Buffer.from(a.buffer, "base64"), { name: a.name })
        );
        const content = `${book.description}\n\n${book.url}`;
        await postMessageToForum(forum, book.title, content, files);
    }
}

module.exports = { postLibraryMessagesToForum };
