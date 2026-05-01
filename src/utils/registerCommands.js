const { REST, Routes } = require('discord.js');
const config = require('../config');
const logger = require('./logger');

const PRIMARY_ENTRY_POINT_TYPE = 4;
const ENTRY_POINT_BULK_ERROR_CODE = 50240;

const buildEntryPointPayload = (command) => {
  const payload = {
    type: PRIMARY_ENTRY_POINT_TYPE,
    name: command.name
  };

  if (command.id) payload.id = command.id;
  if (typeof command.description === 'string') payload.description = command.description;
  if (command.handler !== undefined && command.handler !== null) payload.handler = command.handler;
  if (Array.isArray(command.integration_types)) payload.integration_types = command.integration_types;
  if (Array.isArray(command.contexts)) payload.contexts = command.contexts;
  if (typeof command.nsfw === 'boolean') payload.nsfw = command.nsfw;
  if (command.name_localizations && typeof command.name_localizations === 'object') {
    payload.name_localizations = command.name_localizations;
  }
  if (command.description_localizations && typeof command.description_localizations === 'object') {
    payload.description_localizations = command.description_localizations;
  }

  return payload;
};

const upsertGlobalCommandsIndividually = async (rest, commands) => {
  const globalRoute = Routes.applicationCommands(config.discord.clientId);
  for (const command of commands) {
    await rest.post(globalRoute, { body: command });
  }
  logger.info(`Upserted ${commands.length} global slash commands (individual fallback mode).`);
};

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

    const globalRoute = Routes.applicationCommands(config.discord.clientId);
    let entryPointPayloads = [];

    try {
      const existingCommands = await rest.get(globalRoute);
      entryPointPayloads = (Array.isArray(existingCommands) ? existingCommands : [])
        .filter((command) => Number(command?.type) === PRIMARY_ENTRY_POINT_TYPE && typeof command?.name === 'string')
        .map(buildEntryPointPayload);
    } catch (fetchError) {
      logger.warn(`Could not fetch existing global commands before register: ${fetchError.message}`);
    }

    const body = [...commands, ...entryPointPayloads];

    try {
      await rest.put(globalRoute, { body });
      logger.info(`Registered ${commands.length} global slash commands${entryPointPayloads.length ? ` (+${entryPointPayloads.length} entry point)` : ''}.`);
    } catch (putError) {
      if (Number(putError?.code) !== ENTRY_POINT_BULK_ERROR_CODE) throw putError;

      logger.warn('Bulk global command update blocked by Entry Point command. Falling back to individual upsert mode.');
      await upsertGlobalCommandsIndividually(rest, commands);
    }
  } catch (error) {
    logger.error('Failed to register commands.', error);
  }
};

module.exports = registerCommands;
