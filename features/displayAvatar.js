async function displayAvatar(message) {
    const target = message.mentions.members.first()
    if (target) {
        const avatar = target.displayAvatarURL({ size: 1024, dynamic: true });
        message.reply(avatar);
    } else {
        const avatar = message.author.displayAvatarURL({ size: 1024, dynamic: true });
        message.reply(avatar);
    }
}

module.exports = { displayAvatar }
