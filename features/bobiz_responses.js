const fs = require("fs");

const data = JSON.parse(fs.readFileSync("./features/bobiz.json", "utf8"));

async function handleBobiz(message) {
    if (message.author.bot) return;
    const userId = message.author.id;
    const sentences = data[userId] || data["words"];
    const chosen = sentences[Math.floor(Math.random() * sentences.length)];
    await message.reply(`${message.author}, ${chosen}`);
}

module.exports = { handleBobiz };
