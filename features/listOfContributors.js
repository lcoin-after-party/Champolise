const listOfConversations = {}  // Stores all conversations by channel ID
/*
listOfConversations
should be 
listOfConversations = {
  "channelId": {
    manager: {
      username: "",
      globalName: "",
      userId: ""
    },
    list: [
      {
        username: "",
        globalName: "",
        userId: "",
        time: {
          start: null,     // timestamp (Date.now())
          finished: null,  // timestamp
          duration: null   // ms
        }
      }
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
        // console.log(mention);
        const currentContributor= channelData.list[0]
        messageContent += ` \n\n ***nobtk a <@${currentContributor.userId}> ***`;
        TimeManager.setStartTime(channelData, currentContributor.userId);

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
        const channelData = listOfConversations[channelId];  // Fetch stored conversation data for this channel

    if (!channelData) {  // Check if channel exists in memory
        console.error("channel id is not in list of channels")
        return;
    }

    // the manager could add contributors
    const manager = channelData.manager
    if (message.author.id === manager.userId) {  // Manager can add contributors
        if (message.mentions.users.first()) {  // If a user is mentioned

            const contributor = message.mentions.users.first()  // Get the first mentioned user

            if (channelData.list.length > 0) {  // Check for redundancy

                const recent = list.slice(-Math.min(3, list.length));
                const isRedundentContributor = recent.some(u => u.userId === userId);  // Check last 3 (or 1) contributors

                if (isRedundentContributor) {  // Avoid adding duplicates
                    message.reply(`had ${contributor} kayhder bzaf , ysber 3la khbizto`).then(botMsg => {
                        setTimeout(() => botMsg.delete().catch(err => console.log(err)), 5000);
                    });
                    return
                }
            }

            // Add contributor to list
            channelData.list.push({ username: contributor.username, globalName: contributor.globalName || contributor.username, userId: contributor.id })
            message.reply(`${contributor} rak tzaditi f la liste , tsna nobtek`).then(botMsg => {  // Confirmation message
                setTimeout(() => botMsg.delete().catch(err => console.log(err)), 5000);
            });
            showList(message)  // Show updated list
            return
        }
    }
    // add the user to list of contributors 
    // of the specefic channel

    if (channelData.list.length > 0) {

        const isRedundentContributor = channelData.list.length > 3 ?
            channelData.list.slice(-3).some(user => user.userId === userId) :
            channelData.list.slice(-1)[0].userId == userId  // Check last 3 (or 1) contributors

        if (isRedundentContributor) {  // Avoid duplicates
            message.reply("kon t7chem nta atb9a 4a thder ??").then(botMsg => {
                setTimeout(() => botMsg.delete().catch(err => console.log(err)), 5000);
            });
            return
        }
    }

    // Add contributor to list
    channelData.list.push({ username, globalName, userId })
    showList(message)  // Show updated list
    message.reply("safi rak tzaditi f la liste , tsna nobtek").then(botMsg => {  // Confirmation message
        setTimeout(() => botMsg.delete().catch(err => console.log(err)), 5000);
    });

}

// remove from contributors after that contribution is done 
async function removeContributorFromList(message, { channelId, userId }) {
    // listOfConversations[channelId].list                  // maybe later
    // .filter((contributor)=>contributor.userId != userId)

    const channelData = listOfConversations[channelId];  // Fetch stored conversation data for this channel

    // the current contributor can end his role
    // or the manager can skip him using the like emoji and mention the user
    const manager = channelData.manager
    const currentContributor = channelData.list[0]
    if (
        (currentContributor?.userId == userId && (message.author.username != manager.username || !(message.mentions.users.first()))) ||
        (message.author.id === manager.userId && message.mentions.users.first() && message.mentions.users.first().id == currentContributor?.userId)
    ) {

        const stopResult = TimeManager.setFinishTime(channelData, currentContributor.userId);

        if (stopResult.ok) {
            const durationResult = TimeManager.getTalkingDuration(channelData, currentContributor.userId);

            if (durationResult.ok) {
            message.channel.send(
                `⏱️ <@${currentContributor.userId}> hdarti ${TimeManager.formatDuration(durationResult.value)}`
            );
            }
        } else {
            console.error("TIMER_STOP_ERROR:", stopResult.error);
        }
        channelData.list.shift()  // Remove first contributor
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



const TimeManager = {

  /* ---------- INTERNAL HELPERS ---------- */

  _assertChannelData(channelData) {
    if (!channelData || typeof channelData !== "object") {
      throw new Error("INVALID_CHANNEL_DATA");
    }

    if (!Array.isArray(channelData.list)) {
      throw new Error("INVALID_CHANNEL_LIST");
    }
  },

  _getUser(channelData, userId) {
    this._assertChannelData(channelData);

    if (!userId) {
      throw new Error("INVALID_USER_ID");
    }

    const user = channelData.list.find(u => u.userId === userId);

    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    if (!user.time) {
      // auto-heal missing time object
      user.time = { start: null, finished: null, duration: null };
    }

    return user;
  },

  _now() {
    return Date.now();
  },

  /* ---------- START TIME ---------- */

  setStartTime(channelData, userId) {
    try {
      const user = this._getUser(channelData, userId);

      if (user.time.start !== null) {
        throw new Error("START_TIME_ALREADY_SET");
      }

      user.time.start = this._now();
      user.time.finished = null;
      user.time.duration = null;

      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  getStartTime(channelData, userId) {
    try {
      const user = this._getUser(channelData, userId);
      return { ok: true, value: user.time.start };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  /* ---------- FINISH TIME ---------- */

  setFinishTime(channelData, userId) {
    try {
      const user = this._getUser(channelData, userId);

      if (user.time.start === null) {
        throw new Error("START_TIME_NOT_SET");
      }

      if (user.time.finished !== null) {
        throw new Error("FINISH_TIME_ALREADY_SET");
      }

      user.time.finished = this._now();
      user.time.duration = user.time.finished - user.time.start;

      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  getFinishTime(channelData, userId) {
    try {
      const user = this._getUser(channelData, userId);
      return { ok: true, value: user.time.finished };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  /* ---------- DURATION ---------- */

  getTalkingDuration(channelData, userId) {
    try {
      const user = this._getUser(channelData, userId);

      if (user.time.duration === null) {
        throw new Error("DURATION_NOT_AVAILABLE");
      }

      return { ok: true, value: user.time.duration };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  /* ---------- UTIL ---------- */

  formatDuration(ms) {
    if (typeof ms !== "number" || ms < 0) return "0s";

    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}m ${seconds}s`;
  }
};
