const fs = require("fs");
const path = require("path");

// Load servers.json
const servers = JSON.parse(
    fs.readFileSync(path.join(__dirname, "servers.json"), "utf8")
);

/**
 * Get the complete config of a server
 */
function getServerConfig(guildId) {
    return servers[guildId] || null;
}

/**
 * Get ALL server configs as an object
 */
function getAllServerConfigs() {
    return servers;
}

/**
 * Get an array of all guild IDs
 */
function getAllGuildIds() {
    return Object.keys(servers);
}

/**
 * Check if server exists in servers.json
 */
function serverExists(guildId) {
    return servers.hasOwnProperty(guildId);
}

/**
 * Get a specific value for a server, ex:
 * getValue(guildId, "LIBRARY_CHANNEL_ID")
 */
function getValue(guildId, key) {
    if (!servers[guildId]) return null;
    return servers[guildId][key] || null;
}

module.exports = {
    getServerConfig,
    getAllServerConfigs,
    getAllGuildIds,
    serverExists,
    getValue
};
