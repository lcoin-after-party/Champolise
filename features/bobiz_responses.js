const fs = require("fs");
// Node.js file system module for reading files

// Load the JSON file containing predefined messages
const data = JSON.parse(fs.readFileSync("./features/bobiz.json", "utf8"));

// Function to handle the "bobiz" command
async function handleBobiz(message) {
    // Ignore messages sent by bots
    if (message.author.bot) return;

    // Get the ID of the message author
    const userId = message.author.id;

    // Get the sentences for this user, or default to the "words" entry
    const sentences = data[userId] || data["words"];

    // Pick a random sentence from the list
    const chosen = sentences[Math.floor(Math.random() * sentences.length)];

    // Reply to the user with their chosen sentence
    await message.reply(`${message.author}, ${chosen}`);
}

// Export the function so it can be used in other files
module.exports = { handleBobiz };
