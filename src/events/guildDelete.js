const { sendGuildNotification } = require('../utils/guildNotifications');

module.exports = {
  name: 'guildDelete',
  once: false,
  async execute(guild) {
    await sendGuildNotification(guild.client, guild, 'leave');

    try {
      await guild.client.musicManager.destroyQueue(guild.id);
    } catch {
      // noop
    }
  }
};
