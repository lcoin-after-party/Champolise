/**
 * Sends a message to a specified channel in the same server.
 *
 * This command is restricted to:
 * - A specific guild (server)
 * - Specific authorized user IDs
 *
 * @param {Message} message - The Discord message that triggered the command
 * @param {Client} client - The Discord bot client
 * @param {string} PREFIX - The command prefix used by the bot
 */
async function sendMSG(message, client, PREFIX) {

    // Restrict usage to a specific server and specific users
    if (
        message.guild.id == '1422772405138493461' &&
        (
            message.author.id == '399199197938712587' ||
            message.author.id == '733414175556239525'
        )
    ) {
        try {
            /**
             * Command format example:
             * --send #general Hello everyone!
             *
             * Breakdown:
             * - channedlink: channel mention or ID
             * - restMessage: the message content to send
             */
            const [_, channedlink, ...restMessage] =
                message.content?.slice(PREFIX.length).split(" ");

            // Extract the numeric channel ID from a mention or raw ID
            const channelID = channedlink.match(/\d+/)[0];

            // Rebuild the message to be sent
            const messageToBeSent = restMessage.join(" ");

            // Fetch the target channel
            const channel = await client.channels.fetch(channelID);

            // Ensure the channel exists and belongs to the same guild
            if (!channel || channel.guild.id !== message.guild.id) {
                return message.reply(
                    "❌ You can only send messages to channels **in this server**."
                );
            }

            // Send the message to the target channel
            channel.send(messageToBeSent);

        } catch (error) {
            console.error('sendMSG error:', error);
        }
    }
}

/**
 * Export the sendMSG function for use in other files
 */
module.exports = { sendMSG };
