const listOfConversations = {}
/*
listOfConversations
should be 
{"channedID" : 
    {
      manager : "",
      list :[
            {username : "" , userId : ""}
            ]  
    }   
}
*/

async function ListeOfContributors(message) {
    // Respond to the user when bot is mentioned
    if (listOfConversations[message.channel.id]) {
        message.reply("deja kayna liste");
    } else {
        message.reply("ana hna");
        listOfConversations[message.channel.id] =
        {
            manager: message.author.id,
            list: []
        }

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
    // add the user to list of contributors 
    // of the specefic channel
    listOfConversations[channelId].list.push({ username, userId })
    console.log(listOfConversations[channelId].list);
    message.reply("safi rak tzaditi f la liste , tsna nobtek")
}

// remove from contributors after that contribution is done 
async function removeContributorFromList(message, { channelId, userId }) {
    // listOfConversations[channelId].list                  // maybe later
    // .filter((contributor)=>contributor.userId != userId) 

    if (listOfConversations[channelId].list[0]?.userId == userId) {
        listOfConversations[channelId].list.shift()
        message.reply("9te3 llah ydir lkhir").then(botMsg => {
            setTimeout(() => botMsg.delete().catch(err => console.log(err)), 5000);
        });
    }
    else
        message.reply("machi nobtek hadi").then(botMsg => {
            setTimeout(() => botMsg.delete().catch(err => console.log(err)), 5000);
        });

}
module.exports = { ListeOfContributors, addContributorToList, removeContributorFromList }