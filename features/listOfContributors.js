const listOfConversations = {}  // Stores all conversations by channel ID
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
    const channel = message.channel;  // Get the channel object from the message
    const channelId = message.channel.id;  // Extract the channel ID
    const channelData = listOfConversations[channelId];  // Fetch stored conversation data for this channel

    if (!channelData) {  // If no data exists for this channel
        console.log("Channel data not found!");
        return;
    }
    if (channelData.list.length == 0) {  // If there are no contributors
        channel.send("Liste khawya ....").then(botMsg => { // Inform that the list is empty
            setTimeout(() => botMsg.delete().catch(err => console.log(err)), 5000); // Auto-delete the message after 5s
        });
        return
    }
    // Create the message content
    let messageContent = `**Liste des intervenants**\nl-bâshâ: ${channelData.manager.globalName}\n\n`;
    messageContent += channelData.list.map(user =>
        user.globalName
    ).join("\n");  // Add each contributor's global name to the message
    if (mention) {  // Optionally mention the first contributor
        console.log(mention);
        messageContent += ` \n\n ***nobtk a <@${channelData.list[0].userId}> ***`;
    }
    // Fetch the channel and send the message
    if (!channel) {  // If the channel is missing in cache
        console.log("Channel not found in cache!");
        return;
    }

    channel.send(messageContent)  // Send the final message
        .catch(console.error);
}

async function startListOfContributors(message) {
    // Respond to the user when bot is mentioned
    if (listOfConversations[message.channel.id]) {  // If list already exists
        message.reply("deja kayna liste");  // Inform that the list already exists
    } else {  // Otherwise, create a new list
        message.reply("ana hna");
        listOfConversations[message.channel.id] =
        {
            manager: { username: message.author.username, globalName: message.author.globalName || message.author.username, userId: message.author.id },  // Set the manager
            list: []  // Initialize an empty list of contributors
        }
    }
}

async function endListOfContributors(message) {
    if (listOfConversations[message.channel.id] && listOfConversations[message.channel.id].manager.userId == message.author.id) {  // Only manager can end
        showList(message)  // Show the final list
        message.reply("Sf la liste t7ydat").then(botMsg => {  // Inform that list is deleted
            setTimeout(() => botMsg.delete().catch(err => console.log(err)), 5000);
        });
        message.channel.send("Bye everyone")  // Farewell message
        delete listOfConversations[message.channel.id]  // Remove list from memory
        return true
    } else {
        message.reply("nta machi l-bâshâ");  // User is not manager
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
    if (!listOfConversations[channelId]) {  // Check if channel exists in memory
        console.error("channel id is not in list of channels")
        return;
    }

    // the manager could add contributors
    const manager = listOfConversations[channelId].manager
    if (message.author.username == manager.username) {  // Manager can add contributors
        if (message.mentions.users.first()) {  // If a user is mentioned

            const contributor = message.mentions.users.first()  // Get the first mentioned user

            if (listOfConversations[channelId].list.length > 0) {  // Check for redundancy

                const isRedundentContributor = listOfConversations[channelId].list.length > 3 ?
                    listOfConversations[channelId].list.slice(-3).some(user => user.userId === contributor.id) :
                    listOfConversations[channelId].list.slice(-1)[0].userId == contributor.id  // Check last 3 (or 1) contributors

                if (isRedundentContributor) {  // Avoid adding duplicates
                    message.reply(`had ${contributor} kayhder bzaf , ysber 3la khbizto`).then(botMsg => {
                        setTimeout(() => botMsg.delete().catch(err => console.log(err)), 5000);
                    });
                    return
                }
            }

            // Add contributor to list
            listOfConversations[channelId].list.push({ username: contributor.username, globalName: contributor.globalName || contributor.username, userId: contributor.id })
            message.reply(`${contributor} rak tzaditi f la liste , tsna nobtek`).then(botMsg => {  // Confirmation message
                setTimeout(() => botMsg.delete().catch(err => console.log(err)), 5000);
            });
            showList(message)  // Show updated list
            return
        }
    }
    // add the user to list of contributors 
    // of the specefic channel

    if (listOfConversations[channelId].list.length > 0) {

        const isRedundentContributor = listOfConversations[channelId].list.length > 3 ?
            listOfConversations[channelId].list.slice(-3).some(user => user.userId === userId) :
            listOfConversations[channelId].list.slice(-1)[0].userId == userId  // Check last 3 (or 1) contributors

        if (isRedundentContributor) {  // Avoid duplicates
            message.reply("kon t7chem nta atb9a 4a thder ??").then(botMsg => {
                setTimeout(() => botMsg.delete().catch(err => console.log(err)), 5000);
            });
            return
        }
    }

    // Add contributor to list
    listOfConversations[channelId].list.push({ username, globalName, userId })
    showList(message)  // Show updated list
    message.reply("safi rak tzaditi f la liste , tsna nobtek").then(botMsg => {  // Confirmation message
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
        listOfConversations[channelId].list.shift()  // Remove first contributor
        message.reply("9te3 llah ydir lkhir").then(botMsg => {  // Confirmation message
            setTimeout(() => botMsg.delete().catch(err => console.log(err)), 5000);
        });
        showList(message, true)  // Show updated list with mention
    }
    else {
        if (message.mentions.users.first()) {  // If wrong user mentioned
            message.reply("machi nobto hadi , verifi smya").then(botMsg => {
                setTimeout(() => botMsg.delete().catch(err => console.log(err)), 5000);
            });
        }
        message.reply("machi nobtek hadi").then(botMsg => {  // If not allowed to remove
            setTimeout(() => botMsg.delete().catch(err => console.log(err)), 5000);
        });
    }

}

module.exports = { startListOfContributors, endListOfContributors, addContributorToList, removeContributorFromList, listOfConversations }  // Export functions for bot usage
