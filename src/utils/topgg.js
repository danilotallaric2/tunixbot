const logger = require('./logger');
const config = require('../config');

let AutoPosterFactory = null;
try {
  ({ AutoPoster: AutoPosterFactory } = require('topgg-autoposter'));
} catch {
  AutoPosterFactory = null;
}

const normalizeTopggWebhookPath = (pathValue) => {
  const raw = String(pathValue || '/dblwebhook').trim();
  if (!raw) return '/dblwebhook';
  return raw.startsWith('/') ? raw : `/${raw}`;
};

const normalizeTopggVotePayload = (payload) => {
  if (!payload || typeof payload !== 'object') return null;

  // Webhooks v1 style (event envelope)
  if (payload.type && payload.data && typeof payload.data === 'object') {
    const eventType = String(payload.type);
    const userData = payload.data.user || {};
    const projectData = payload.data.project || {};
    const weight = Math.max(1, Number(payload.data.weight || 1));

    return {
      schema: 'v1',
      rawType: eventType,
      voteType: eventType === 'webhook.test' ? 'test' : 'upvote',
      userDiscordId: userData.platform_id ? String(userData.platform_id) : null,
      userTopggId: userData.id ? String(userData.id) : null,
      username: userData.name ? String(userData.name) : null,
      avatarUrl: userData.avatar_url ? String(userData.avatar_url) : null,
      projectDiscordId: projectData.platform_id ? String(projectData.platform_id) : null,
      projectTopggId: projectData.id ? String(projectData.id) : null,
      isWeekend: weight > 1,
      weight,
      query: payload.data.query ? String(payload.data.query) : null
    };
  }

  // Legacy v0 bot webhook payload
  const voteType = String(payload.type || 'upvote');
  return {
    schema: 'v0',
    rawType: voteType,
    voteType,
    userDiscordId: payload.user ? String(payload.user) : null,
    userTopggId: null,
    username: null,
    avatarUrl: null,
    projectDiscordId: payload.bot ? String(payload.bot) : payload.guild ? String(payload.guild) : null,
    projectTopggId: null,
    isWeekend: Boolean(payload.isWeekend),
    weight: payload.isWeekend ? 2 : 1,
    query: payload.query ? String(payload.query) : null
  };
};

const setupTopggAutoposter = (client) => {
  const token = String(config.topgg.token || '').trim();
  if (!token) {
    logger.info('Top.gg autoposter disabled: TOPGG_TOKEN missing.');
    return null;
  }

  if (!AutoPosterFactory) {
    logger.warn('Top.gg autoposter disabled: package "topgg-autoposter" not installed.');
    return null;
  }

  try {
    const autoposter = AutoPosterFactory(token, client);

    autoposter.on('posted', (stats) => {
      const guildCount = Number(stats?.serverCount || 0);
      const shardCount = Number(stats?.shardCount || 0);
      logger.info(`Posted stats to Top.gg${guildCount ? ` | guilds=${guildCount}` : ''}${shardCount ? ` | shards=${shardCount}` : ''}`);
    });

    autoposter.on('error', (error) => {
      logger.error('Top.gg autoposter error', error);
    });

    logger.info('Top.gg autoposter enabled.');
    return autoposter;
  } catch (error) {
    logger.error('Top.gg autoposter setup failed', error);
    return null;
  }
};

module.exports = {
  normalizeTopggWebhookPath,
  normalizeTopggVotePayload,
  setupTopggAutoposter
};

