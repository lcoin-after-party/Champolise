const Server = require("../models/Server");

async function getServerConfig(guildId) {
  try {
    return await Server.findOne({ guildId }).lean();
  } catch (err) {
    console.error("❌ getServerConfig error:", err);
    return null;
  }
}

async function getAllServerConfigs() {
  try {
    // Only return plain server configs without extra nested keys
    return await Server.find({}, { _id: 0, __v: 0 }).lean();
  } catch (err) {
    console.error("❌ getAllServerConfigs error:", err);
    return [];
  }
}

async function getAllGuildIds() {
  try {
    const servers = await Server.find({}, { guildId: 1, _id: 0 }).lean();
    // Filter out any invalid or missing guildIds
    return servers.map(s => s.guildId).filter(Boolean);
  } catch (err) {
    console.error("❌ getAllGuildIds error:", err);
    return [];
  }
}

async function serverExists(guildId) {
  try {
    const exists = await Server.exists({ guildId });
    return !!exists;
  } catch (err) {
    console.error("❌ serverExists error:", err);
    return false;
  }
}

async function getValue(guildId, key) {
  try {
    const server = await Server.findOne({ guildId }, { [key]: 1, _id: 0 }).lean();
    return server?.[key] ?? null;
  } catch (err) {
    console.error("❌ getValue error:", err);
    return null;
  }
}

module.exports = {
  getServerConfig,
  getAllServerConfigs,
  getAllGuildIds,
  serverExists,
  getValue
};
