const dotenv = require('dotenv');

dotenv.config();

const parseBool = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const parseIntOr = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
};

const config = {
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET || null,
    redirectUri: process.env.DISCORD_REDIRECT_URI || 'http://127.0.0.1:3000/auth/discord/callback',
    guildId: process.env.DISCORD_GUILD_ID || null
  },
  lavalink: {
    nodes: [
      {
        name: process.env.LAVALINK_NAME || 'MainNode',
        url: `${process.env.LAVALINK_HOST || '127.0.0.1'}:${parseIntOr(process.env.LAVALINK_PORT, 2333)}`,
        auth: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
        secure: parseBool(process.env.LAVALINK_SECURE, false)
      }
    ]
  },
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    market: process.env.SPOTIFY_MARKET || 'US'
  },
  music: {
    defaultVolume: parseIntOr(process.env.DEFAULT_VOLUME, 80),
    maxQueueSize: parseIntOr(process.env.MAX_QUEUE_SIZE, 500),
    autoDisconnectMs: parseIntOr(process.env.AUTO_DISCONNECT_MS, 120000)
  },
  dashboard: {
    enabled: parseBool(process.env.DASHBOARD_ENABLED, true),
    host: process.env.DASHBOARD_HOST || '127.0.0.1',
    port: parseIntOr(process.env.DASHBOARD_PORT, 3000),
    publicUrl: process.env.DASHBOARD_PUBLIC_URL || `http://${process.env.DASHBOARD_HOST || '127.0.0.1'}:${parseIntOr(process.env.DASHBOARD_PORT, 3000)}`
  },
  notifications: {
    guildJoinChannelId: process.env.GUILD_JOIN_LOG_CHANNEL_ID || '1235541924547661854',
    guildLeaveChannelId: process.env.GUILD_LEAVE_LOG_CHANNEL_ID || '1235541940901249074'
  },
  theme: {
    primary: 0x6d5cff,
    secondary: 0x27d3ff,
    error: 0xff4d6d,
    success: 0x4afc8a,
    warning: 0xffc14d,
    footer: 'TunixBot • Music System'
  }
};

if (!config.discord.token || !config.discord.clientId) {
  throw new Error('Missing required env vars: DISCORD_TOKEN and DISCORD_CLIENT_ID');
}

module.exports = config;
