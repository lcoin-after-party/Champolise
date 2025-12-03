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

async function addContributorToList(message,{ channelId, username, userId }) {
    if (!listOfConversations[channelId]) {
        console.error("channel id is not in list of channels")
        return;
    }
    listOfConversations[channelId].list.push({ username, userId })
    console.log(listOfConversations[channelId].list);
    message.reply("safi rak tzaditi f la liste , tsna nobtek")
}
module.exports = { ListeOfContributors, addContributorToList }