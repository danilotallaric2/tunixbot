module.exports = {
  name: 'guildDelete',
  once: false,
  async execute(guild) {
    try {
      await guild.client.musicManager.destroyQueue(guild.id);
    } catch {
      // noop
    }
  }
};
