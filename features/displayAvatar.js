async function displayAvatar(message) {
    // Get the first mentioned member in the message
    const target = message.mentions.members.first()
    // If a member was mentioned
    if (target) {
        // Get their avatar URL, size 1024, dynamic allows GIFs
        const avatar = target.displayAvatarURL({ size: 1024, dynamic: true });
        // Reply with the mentioned member's avatar
        message.reply(avatar);
    } else {  // If no member was mentioned
        // Get the message author's avatar
        const avatar = message.author.displayAvatarURL({ size: 1024, dynamic: true });
        // Reply with the author's avatar
        message.reply(avatar);
    }
}

// Export the function to use it in other files
module.exports = { displayAvatar }
