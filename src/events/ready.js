const logger = require('../utils/logger');
const registerCommands = require('../utils/registerCommands');
const config = require('../config');
const createDashboardServer = require('../dashboard/server');

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
  }
};
