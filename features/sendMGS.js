async function sendMSG(message,client,PREFIX){
    if(message.guild.id == 1422772405138493461 && (message.author.id == 399199197938712587 || message.author.id == 733414175556239525)){
        try {
            
            const [_ ,channedlink , ...restMessage ] = message.content?.slice(PREFIX.length).split(" ")
            const channelID = channedlink.match(/\d+/)[0]
            const messageToBeSent = restMessage.join(" ")
             const channel = await client.channels.fetch(channelID)
             channel.send(messageToBeSent)
        } catch (error) {
            
        }
    }
}

module.exports = {sendMSG}