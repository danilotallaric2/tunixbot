const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./config');
const logger = require('./utils/logger');
const MusicManager = require('./music/MusicManager');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

client.commands = new Collection();
client.musicManager = new MusicManager(client);

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command?.data?.name && command?.execute) {
    client.commands.set(command.data.name, command);
  }
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith('.js'));

for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));
  if (!event?.name || !event?.execute) continue;

  if (event.once) client.once(event.name, (...args) => event.execute(...args));
  else client.on(event.name, (...args) => event.execute(...args));
}

process.on('unhandledRejection', (error) => logger.error('Unhandled Promise Rejection', error));
process.on('uncaughtException', (error) => logger.error('Uncaught Exception', error));

let isShuttingDown = false;
const gracefulShutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Graceful shutdown requested (${signal})`);
  try {
    if (client.musicManager?.shutdown) {
      await client.musicManager.shutdown();
    }
  } catch (error) {
    logger.warn(`MusicManager shutdown failed: ${error?.message || error}`);
  }

  try {
    client.destroy();
  } catch {
    // noop
  }

  process.exit(0);
};

process.on('SIGINT', () => {
  gracefulShutdown('SIGINT').catch(() => process.exit(0));
});
process.on('SIGTERM', () => {
  gracefulShutdown('SIGTERM').catch(() => process.exit(0));
});
process.on('message', (msg) => {
  if (msg === 'shutdown') {
    gracefulShutdown('pm2:shutdown').catch(() => process.exit(0));
  }
});

client.login(config.discord.token);
