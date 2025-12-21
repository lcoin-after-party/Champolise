// ================== DEPENDENCIES ==================

// Node.js file system module for reading/writing JSON files
const fs = require("fs");

// Node.js path module for safe file path handling
const path = require("path");

// Discord.js classes used for channel type checking and attachments
const { ForumChannel, TextChannel, AttachmentBuilder } = require("discord.js");

// Database helper to retrieve server-specific configuration
const { getServerConfig } = require("../databases/servers");

// Maximum number of recent messages to fetch when JSON already exists
const MESSAGE_FETCH_LIMIT = 100;

// ----------- DYNAMIC NODE-FETCH IMPORT -----------
// Lazy-loads node-fetch to avoid ESM/CommonJS compatibility issues
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

// ================== JSON HANDLING ==================

/**
 * Returns the path for storing processed books JSON for a guild.
 * Each guild gets its own JSON file.
 * @param {string} guildId
 * @returns {string}
 */
function getProcessedFilePath(guildId) {
    return path.join(__dirname, `processedBooks_${guildId}.json`);
}

/**
 * Loads processed books from JSON file.
 * Returns an empty object if the file does not exist
 * or if JSON parsing fails.
 * @param {string} guildId
 * @returns {object}
 */
function loadProcessedBooks(guildId) {
    const filePath = getProcessedFilePath(guildId);

    // If no file exists yet, return empty object
    if (!fs.existsSync(filePath)) return {};

    try {
        // Read and parse JSON content
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (err) {
        // Fallback to empty object on error
        console.log("[ERROR] Failed to load processed books:", err);
        return {};
    }
}

/**
 * Saves processed books to JSON file.
 * Overwrites the file with formatted JSON.
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
 * Fetches the library text channel and the ranked books forum channel.
 * Validates their existence and types.
 * @param {Client} client
 * @param {string} guildId
 * @returns {Promise<{library: TextChannel|null, bestBooks: ForumChannel|null, errors: string[]}>}
 */
async function getChannels(client, guildId) {
    const config = await getServerConfig(guildId);
    const errors = [];

    // If server is not configured in database
    if (!config) {
        return { library: null, bestBooks: null, errors: [`Server ${guildId} not configured`] };
    }

    // Fetch and validate the library channel
    const library = await fetchChannel(
        client,
        config.LIBRARY_CHANNEL_ID,
        TextChannel,
        errors,
        "Library"
    );

    // Fetch and validate the forum channel
    const bestBooks = await fetchChannel(
        client,
        config.LIBRARY_RANKED_BOOKS_ID,
        ForumChannel,
        errors,
        "Forum"
    );

    return { library, bestBooks, errors };
}

/**
 * Helper function to fetch a channel and ensure it matches the expected type.
 * Adds errors if the channel is missing or incorrect.
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

        // Ensure channel is of the expected Discord.js class
        if (!(channel instanceof expectedType)) {
            errors.push(`${name} channel missing or wrong type`);
            return null;
        }
        return channel;
    } catch {
        // API fetch failure
        errors.push(`Could not fetch ${name} channel from API`);
        return null;
    }
}

// ================== FORUM THREADS ==================

/**
 * Deletes all active and archived threads in a forum channel.
 * Used to fully refresh the ranked books forum.
 * @param {ForumChannel} forum
 */
async function clearForumThreads(forum) {
    console.log("[INFO] Clearing forum threads...");

    // Fetch active and archived threads
    const threads = await forum.threads.fetchActive();
    const archived = await forum.threads.fetchArchived();

    // Combine both collections into one list
    const allThreads = [...threads.threads.values(), ...archived.threads.values()];

    let deletedCount = 0;

    // Delete each thread
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
 * Fetches all messages from a channel by paginating backwards.
 * Used when no processed JSON exists.
 * @param {TextChannel} channel
 * @returns {Promise<Message[]>}
 */
async function fetchAllMessages(channel) {
    let allMessages = [];
    let lastId;

    while (true) {
        const options = { limit: 100, cache: false };

        // Fetch messages before the last fetched ID
        if (lastId) options.before = lastId;

        const messages = await channel.messages.fetch(options);

        // Stop when no messages remain
        if (!messages.size) break;

        allMessages.push(...messages.values());
        lastId = messages.last().id;
    }

    return allMessages;
}

/**
 * Fetches a limited number of recent messages from a channel.
 * Used when JSON already exists.
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
 * Extracts a book title and description from message content.
 * Supports multiple languages for "title".
 * @param {Message} msg
 * @returns {{title: string, description: string}}
 */
function extractFields(msg) {
    // If message already has title/description fields (JSON fallback)
    if ("title" in msg && "description" in msg) {
        return { title: msg.title, description: msg.description };
    }

    const lines = msg.content.split("\n");
    if (!lines.length) return { title: "", description: "" };

    let title = "";
    let titleLineIndex = -1;

    // Look for title in the first 4 lines
    for (let i = 0; i < Math.min(4, lines.length); i++) {
        const match = lines[i].trim().match(/(?:.*?)(title|titre|العنوان)\s*:\s*(.+)/i);
        if (match) {
            title = match[2].trim();
            titleLineIndex = i;
            break;
        }
    }

    // Abort if no title found
    if (!title) return { title: "", description: "" };

    // Everything after the title line becomes the description
    const description = lines.slice(titleLineIndex + 1).join("\n");

    return { title, description };
}

/**
 * Counts ✅ or ❤️ reactions on a message.
 * @param {Message} message
 * @returns {Promise<number>}
 */
async function getCheckmarkCount(message) {
    try {
        const reactions = await message.reactions.fetch();
        const reaction = reactions.find(
            r => r.emoji.name === "✅" || r.emoji.name === "❤️"
        );
        return reaction ? reaction.count : 0;
    } catch {
        return 0;
    }
}

/**
 * Downloads image attachments from a message
 * and converts them into AttachmentBuilder objects.
 * @param {Message} msg
 * @returns {Promise<AttachmentBuilder[]>}
 */
async function getAttachments(msg) {
    const files = [];

    for (const a of msg.attachments.values()) {
        // Only process images
        if (a.contentType?.startsWith("image")) {
            try {
                const res = await fetch(a.url);
                const buffer = Buffer.from(await res.arrayBuffer());

                files.push(
                    new AttachmentBuilder(buffer, { name: a.name })
                );
            } catch (err) {
                console.log("[ERROR] Failed to fetch attachment:", err);
            }
        }
    }
    return files;
}

// ================== FORUM POSTING ==================

/**
 * Creates a new forum thread from a book entry.
 * @param {ForumChannel} forum
 * @param {string} title
 * @param {string} content
 * @param {AttachmentBuilder[]} files
 * @returns {Promise<boolean>}
 */
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

// ================== MAIN LOGIC ==================

/**
 * Main entry point.
 * Fetches library messages, processes them,
 * sorts by reactions, and posts them to the forum.
 * @param {Client} client
 * @param {string} guildId
 */
async function postLibraryMessagesToForum(client, guildId) {
    const { library, bestBooks, errors } = await getChannels(client, guildId);

    // Abort if channel errors exist
    if (errors.length) {
        errors.forEach(e => console.log("[ERROR]", e));
        return;
    }

    const processedBooks = loadProcessedBooks(guildId);
    let messages;

    // If no previous data exists, fetch entire channel
    if (!Object.keys(processedBooks).length) {
        console.log(`[INFO] JSON empty for server ${guildId}. Fetching all library messages...`);
        messages = await fetchAllMessages(library);
    } else {
        // Otherwise, fetch recent messages and merge with stored ones
        console.log(`[INFO] Fetching latest messages for server ${guildId}...`);
        messages = await fetchRecentMessages(library, MESSAGE_FETCH_LIMIT);
        messages.push(...Object.values(processedBooks));
    }

    await processMessages(messages, processedBooks, library);
    const booksArray = sortBooksByReactions(processedBooks);

    // Reset forum and repost sorted books
    await clearForumThreads(bestBooks);
    await postBooksToForum(bestBooks, booksArray);

    saveProcessedBooks(guildId, processedBooks);
    console.log(`[INFO] Posted ${booksArray.length} books to the forum for server ${guildId}.`);
}

/**
 * Processes messages and updates the processedBooks object.
 * @param {Message[]} messages
 * @param {object} processedBooks
 * @param {TextChannel} library
 */
async function processMessages(messages, processedBooks, library) {
    for (const msg of messages) {
        const { title, description } = extractFields(msg);
        if (!title) continue;

        // Use message URL as unique identifier
        const url = msg.url || msg.id;
        const reactions = await getCheckmarkCount(msg);

        // Create new entry if it doesn't exist
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
        // Update reaction count if already exists
        else {
            processedBooks[url].reactions = reactions;
        }

        // Fetch attachments only once
        if (!processedBooks[url].attachments?.length) {
            const attachments = await getAttachments(msg);
            processedBooks[url].attachments = attachments.map(a => ({
                name: a.name,
                buffer: a.attachment.toString("base64")
            }));
        }
    }

    // Ensure reaction counts stay up-to-date
    await updateReactionsFromLibrary(processedBooks, library);
}

/**
 * Refreshes reaction counts from the library channel.
 * Removes books whose messages no longer exist.
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
                delete processedBooks[url];
            }
        } catch (err) {
            if (err.message.includes("Unknown Message")) {
                console.log(`[WARN] Message ${url} deleted or unknown, removing from JSON`);
                delete processedBooks[url];
            } else {
                console.log(`[WARN] Could not fetch message for ${url}:`, err.message);
            }
        }
    }
}

/**
 * Sorts books by reaction count (descending).
 * Uses timestamp as a tie-breaker.
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
 * Posts all books to the forum channel as individual threads.
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

// Export main function
module.exports = { postLibraryMessagesToForum };
