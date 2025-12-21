const fs = require('fs');
// Node.js file system module for reading files
const path = require('path');
// Node.js path module to handle file paths

// Load JSON file containing GIF URLs
// And extract the array of attack GIFs
const gifsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'attack.json'), 'utf-8'));
const gifs = gifsData.attackGifs;

// Function to handle the attack command
async function handleAttack(message) {
    // Get the first mentioned user in the message
    const target = message.mentions.users.first();

    // If no user was mentioned, prompt the message author
    if (!target) {
        return message.reply("You need to mention someone! Example: `--attack @user`");
    }

    // Pick a random GIF from the array
    const randomGif = gifs[Math.floor(Math.random() * gifs.length)];

    // Reply to the message with the mention and the chosen GIF
    return message.reply({
        content: `${target} \n${randomGif}`
    });
}

// Export the function to use it in other files
module.exports = { handleAttack };
