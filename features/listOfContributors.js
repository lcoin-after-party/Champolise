const listOfConversations = {}
/*
listOfConversations
should be 
{"channedID" : 
    {
      manager : {username : "" , userId : ""},
      list :[
            {username : "" , userId : ""}
            ]  
    }   
}
*/
/**
 * Shows the list of intervenants in a specific channel
 * @param {string} channelId - ID of the channel to send the message
 * @param {boolean} mention - whether to mention the users
 */
function showList(message, mention = false) {

    const channel = message.channel;
    const channelId = message.channel.id;
    const channelData = listOfConversations[channelId];


    if (!channelData) {
        console.log("Channel data not found!");
        return;
    }
    if (channelData.list.length == 0) {
        channel.send("Liste khawya ....").then(botMsg => {
            setTimeout(() => botMsg.delete().catch(err => console.log(err)), 5000);
        });
        return
    }
    // Create the message content
    let messageContent = `**Liste des intervenants**\nManager: ${channelData.manager.username}\n\n`;
    messageContent += channelData.list.map(user =>
        user.username
    ).join("\n");
    if (mention) {
        console.log(mention);
        messageContent += ` \n nobtk a <@${channelData.list[0].userId}>`;
    }
    // Fetch the channel and send the message
    if (!channel) {
        console.log("Channel not found in cache!");
        return;
    }

    channel.send(messageContent)
        .then(() => console.log("Liste des intervenants sent successfully!"))
        .catch(console.error);
}


async function startListOfContributors(message) {
    // Respond to the user when bot is mentioned
    if (listOfConversations[message.channel.id]) {
        message.reply("deja kayna liste");
    } else {
        message.reply("ana hna");
        listOfConversations[message.channel.id] =
        {
            manager: { username: message.author.username, userId: message.author.id },
            list: []
        }

    }
}
async function endListOfContributors(message) {
    if (listOfConversations[message.channel.id] && listOfConversations[message.channel.id].manager.userId == message.author.id) {
        showList(message)
        message.reply("Sf la liste t7ydat").then(botMsg => {
            setTimeout(() => botMsg.delete().catch(err => console.log(err)), 5000);
        });
        message.channel.send("Bye everyone")
        return true
    } else {
        message.reply("nta machi manager");
        return false
    }
}
// Adding contributions
// add contributor to list of contributors
async function addContributorToList(message, { channelId, username, userId }) {
    // handle non existed channels
    // since getting to this funtion means the channel already exists
    // there is no crucial need for this
    // but just as additional check
    if (!listOfConversations[channelId]) {
        console.error("channel id is not in list of channels")
        return;
    }

    // the manager could add contributors
    const manager = listOfConversations[channelId].manager
    if (message.author.username == manager.username) {
        if (message.mentions.users.first()) {
            const contributor = message.mentions.users.first()
            listOfConversations[channelId].list.push({ username: contributor.username, userId: contributor.id })
            message.reply(`${contributor} rak tzaditi f la liste , tsna nobtek`).then(botMsg => {
                setTimeout(() => botMsg.delete().catch(err => console.log(err)), 5000);
            });
            showList(message)
            return
        }
    }
    // add the user to list of contributors 
    // of the specefic channel
    listOfConversations[channelId].list.push({ username, userId })
    showList(message)
    message.reply("safi rak tzaditi f la liste , tsna nobtek").then(botMsg => {
        setTimeout(() => botMsg.delete().catch(err => console.log(err)), 5000);
    });

}

// remove from contributors after that contribution is done 
async function removeContributorFromList(message, { channelId, userId }) {
    // listOfConversations[channelId].list                  // maybe later
    // .filter((contributor)=>contributor.userId != userId) 

    // the current contributor can end his role
    // or the manager can skip him using the like emoji and mention the user
    const manager = listOfConversations[channelId].manager
    if (
        (listOfConversations[channelId].list[0]?.userId == userId && (message.author.username != manager.username || !(message.mentions.users.first()))) ||
        (message.author.username == manager.username && message.mentions.users.first() && message.mentions.users.first().id == listOfConversations[channelId].list[0]?.userId)
    ) {
        listOfConversations[channelId].list.shift()
        message.reply("9te3 llah ydir lkhir").then(botMsg => {
            setTimeout(() => botMsg.delete().catch(err => console.log(err)), 5000);
        });
        showList(message, true)
    }
    else {
        if (message.mentions.users.first()) {
            message.reply("machi nobto hadi , verifi smya").then(botMsg => {
                setTimeout(() => botMsg.delete().catch(err => console.log(err)), 5000);
            });
        }
        message.reply("machi nobtek hadi").then(botMsg => {
            setTimeout(() => botMsg.delete().catch(err => console.log(err)), 5000);
        });
    }

}
module.exports = { startListOfContributors, endListOfContributors, addContributorToList, removeContributorFromList, listOfConversations }