const fs = require('fs');
const path = require('path');

// Load JSON file
const gifsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'attack.json'), 'utf-8'));
const gifs = gifsData.attackGifs;

async function handleAttack(message) {
    const target = message.mentions.users.first();
    if (!target) {
        return message.reply("You need to mention someone! Example: `--attack @user`");
    }

    const randomGif = gifs[Math.floor(Math.random() * gifs.length)];

    return message.reply({
        content: `${target} \n${randomGif}`
    });
}

module.exports = { handleAttack };
