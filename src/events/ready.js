const { ActivityType } = require('discord.js');
const logger = require('../utils/logger');
const registerCommands = require('../utils/registerCommands');
const config = require('../config');
const createDashboardServer = require('../dashboard/server');

const buildActivities = (client) => {
  const guildCount = client.guilds.cache.size;
  const activeSessions = client.musicManager?.queues?.size || 0;

  return [
    { type: ActivityType.Listening, name: '/play on TunixBot' },
    { type: ActivityType.Watching, name: `${guildCount} active servers` },
    { type: ActivityType.Playing, name: `${activeSessions} music sessions` },
    { type: ActivityType.Listening, name: '/help for all commands' }
  ];
};

const startPresenceRotator = (client) => {
  let idx = 0;

  const update = () => {
    const activities = buildActivities(client);
    const activity = activities[idx % activities.length];
    idx += 1;

    client.user.setPresence({
      status: 'online',
      activities: [activity]
    });
  };

  update();

  const timer = setInterval(update, 45000);
  timer.unref?.();
};

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    logger.info(`Logged in as ${client.user.tag}`);
    await registerCommands(client);
    await client.musicManager.init();
    if (config.dashboard.enabled) {
      client.dashboardServer = createDashboardServer(client);
    }
    startPresenceRotator(client);
  }
};
