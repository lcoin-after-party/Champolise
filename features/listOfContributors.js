const listOfConversations = {}
/*
listOfConversations
should be 
{"channedID" : 
    {
      manager : {username : "" , globalName : "" , userId : ""}, // smito L-bâshâ
      list :[
            {username : "" , userId : "", globalName : ""}
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
console.log(listOfConversations['1439783380819382272']?.list);
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
    let messageContent = `**Liste des intervenants**\nl-bâshâ: ${channelData.manager.globalName}\n\n`;
    messageContent += channelData.list.map(user =>
        user.globalName
    ).join("\n");
    if (mention) {
        console.log(mention);
        messageContent += ` \n\n ***nobtk a <@${channelData.list[0].userId}> ***`;
    }
    // Fetch the channel and send the message
    if (!channel) {
        console.log("Channel not found in cache!");
        return;
    }

    channel.send(messageContent)
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
            manager: { username: message.author.username, globalName: message.author.globalName || message.author.username, userId: message.author.id },
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
        delete listOfConversations[message.channel.id]
        return true
    } else {
        message.reply("nta machi l-bâshâ");
        return false
    }
}
// Adding contributions
// add contributor to list of contributors
async function addContributorToList(message, { channelId, username, globalName, userId }) {
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

            if (listOfConversations[channelId].list.length > 0) {

                const isRedundentContributor = listOfConversations[channelId].list.length > 3 ?
                    listOfConversations[channelId].list.slice(-3).some(user => user.userId === contributor.id) :
                    listOfConversations[channelId].list.slice(-1)[0].userId == contributor.id

                if (isRedundentContributor) {
                    message.reply(`had ${contributor} kayhder bzaf , ysber 3la khbizto`).then(botMsg => {
                        setTimeout(() => botMsg.delete().catch(err => console.log(err)), 5000);
                    });
                    return
                }
            }

            listOfConversations[channelId].list.push({ username: contributor.username, globalName: contributor.globalName ||  contributor.username, userId: contributor.id })
            message.reply(`${contributor} rak tzaditi f la liste , tsna nobtek`).then(botMsg => {
                setTimeout(() => botMsg.delete().catch(err => console.log(err)), 5000);
            });
            showList(message)
            return
        }
    }
    // add the user to list of contributors 
    // of the specefic channel

    if (listOfConversations[channelId].list.length > 0) {

        const isRedundentContributor = listOfConversations[channelId].list.length > 3 ?
            listOfConversations[channelId].list.slice(-3).some(user => user.userId === userId) :
            listOfConversations[channelId].list.slice(-1)[0].userId == userId

        if (isRedundentContributor) {
            message.reply("kon t7chem nta atb9a 4a thder ??").then(botMsg => {
                setTimeout(() => botMsg.delete().catch(err => console.log(err)), 5000);
            });
            return
        }
    }


    listOfConversations[channelId].list.push({ username, globalName, userId })
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