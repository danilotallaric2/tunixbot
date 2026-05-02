const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const parseBool = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const parseIntOr = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
};

const parseList = (value) =>
  String(value || '')
    .split(/[\s,;]+/g)
    .map((item) => item.trim())
    .filter(Boolean);

const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');

const fallbackDashboardPublicUrl = () =>
  process.env.DASHBOARD_PUBLIC_URL || `http://${process.env.DASHBOARD_HOST || '127.0.0.1'}:${parseIntOr(process.env.DASHBOARD_PORT, 3000)}`;

const buildDefaultOAuthRedirect = (pathName) => `${trimTrailingSlash(fallbackDashboardPublicUrl())}${pathName}`;

const config = {
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET || null,
    redirectUri: process.env.DISCORD_REDIRECT_URI || buildDefaultOAuthRedirect('/auth/discord/callback'),
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
    ],
    reconnectTries: parseIntOr(process.env.LAVALINK_RECONNECT_TRIES, 999999),
    reconnectIntervalMs: Math.max(500, parseIntOr(process.env.LAVALINK_RECONNECT_INTERVAL_MS, 5000)),
    resume: parseBool(process.env.LAVALINK_RESUME, true),
    resumeTimeoutSec: Math.max(10, parseIntOr(process.env.LAVALINK_RESUME_TIMEOUT_SEC, 120)),
    resumeByLibrary: parseBool(process.env.LAVALINK_RESUME_BY_LIBRARY, true)
  },
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    market: process.env.SPOTIFY_MARKET || 'IT',
    redirectUri: process.env.SPOTIFY_REDIRECT_URI || buildDefaultOAuthRedirect('/auth/spotify/callback'),
    scopes: parseList(
      process.env.SPOTIFY_SCOPES ||
        'user-read-private user-read-email playlist-read-private playlist-read-collaborative user-library-read'
    ),
    dashboardAllowedDiscordIds: parseList(process.env.SPOTIFY_DASHBOARD_ALLOWED_DISCORD_IDS || ''),
    dashboardUsersFile:
      process.env.SPOTIFY_DASHBOARD_USERS_FILE || path.join(__dirname, 'data', 'spotify-users.json')
  },
  music: {
    defaultVolume: parseIntOr(process.env.DEFAULT_VOLUME, 80),
    maxQueueSize: parseIntOr(process.env.MAX_QUEUE_SIZE, 500),
    autoDisconnectMs: parseIntOr(process.env.AUTO_DISCONNECT_MS, 120000),
    autoPlayRelatedWhenQueueEnds: parseBool(process.env.AUTO_PLAY_RELATED_WHEN_QUEUE_ENDS, true),
    sessionPersistence: {
      enabled: parseBool(process.env.MUSIC_SESSION_PERSISTENCE_ENABLED, true),
      filePath:
        process.env.MUSIC_SESSION_PERSISTENCE_FILE?.trim() ||
        path.join(__dirname, 'data', 'music-sessions.json'),
      saveDebounceMs: Math.max(200, parseIntOr(process.env.MUSIC_SESSION_PERSISTENCE_DEBOUNCE_MS, 450)),
      restoreOnStart: parseBool(process.env.MUSIC_SESSION_RESTORE_ON_START, true),
      maxAgeMs: Math.max(60000, parseIntOr(process.env.MUSIC_SESSION_RESTORE_MAX_AGE_MS, 1000 * 60 * 60 * 8))
    }
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
