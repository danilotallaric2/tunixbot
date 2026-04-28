const { REST, Routes } = require('discord.js');
const config = require('../config');
const logger = require('./logger');

const registerCommands = async (client) => {
  const commands = [...client.commands.values()].map((cmd) => cmd.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(config.discord.token);

  try {
    if (config.discord.guildId) {
      await rest.put(
        Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
        { body: commands }
      );
      logger.info(`Registered ${commands.length} guild slash commands.`);
      return;
    }

    await rest.put(Routes.applicationCommands(config.discord.clientId), { body: commands });
    logger.info(`Registered ${commands.length} global slash commands.`);
  } catch (error) {
    logger.error('Failed to register commands.', error);
  }
};

module.exports = registerCommands;
