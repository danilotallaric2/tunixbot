const { sendGuildNotification } = require('../utils/guildNotifications');

module.exports = {
  name: 'guildCreate',
  once: false,
  async execute(guild) {
    await sendGuildNotification(guild.client, guild, 'join');
  }
};
