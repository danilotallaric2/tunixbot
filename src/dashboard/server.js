const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const config = require('../config');
const logger = require('../utils/logger');
const { formatDuration } = require('../utils/time');
const JsonSessionStore = require('./jsonSessionStore');
const SpotifyUserStore = require('./spotifyUserStore');
const { normalizeLocale, t, localizeErrorMessage } = require('../utils/i18n');
const { Webhook } = require('@top-gg/sdk');
const { normalizeTopggWebhookPath, normalizeTopggVotePayload } = require('../utils/topgg');

const DISCORD_API = 'https://discord.com/api/v10';
const SPOTIFY_ACCOUNTS_API = 'https://accounts.spotify.com/api';
const SPOTIFY_WEB_API = 'https://api.spotify.com/v1';
const LRCLIB_API = 'https://lrclib.net/api/get';
const LYRICS_CACHE_MAX_ENTRIES = 500;
const LYRICS_CACHE_SUCCESS_TTL_MS = 1000 * 60 * 60 * 12;
const LYRICS_CACHE_NOT_FOUND_TTL_MS = 1000 * 60 * 10;
const SPOTIFY_TOKEN_EXPIRY_SAFETY_MS = 60_000;

const parseLoopMode = (value) => {
  if (!value) return null;
  if (['off', 'song', 'queue'].includes(value)) return value;
  return null;
};

const parseSearchSource = (value) => {
  if (value === 'youtube') return 'youtube';
  return 'spotify';
};

const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

const getRequestLocale = (req) => normalizeLocale(req?.session?.user?.locale || req?.session?.locale || 'en');
const tr = (req, key, vars = {}) => t(getRequestLocale(req), key, vars);
const formatApiError = (req, error, fallbackKey = 'errors.apiGeneric') =>
  localizeErrorMessage(getRequestLocale(req), error, fallbackKey);

const normalizeLyricsKeyPart = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildLyricsCacheKey = (track) => {
  const title = normalizeLyricsKeyPart(track?.title || '');
  const artist = normalizeLyricsKeyPart(String(track?.author || '').split(',')[0].trim());
  const durationSec = Number(track?.duration) > 0 ? Math.round(Number(track.duration) / 1000) : 0;
  return `${title}::${artist}::${durationSec}`;
};

const getSessionSecret = () => {
  if (process.env.DASHBOARD_SESSION_SECRET) return process.env.DASHBOARD_SESSION_SECRET;

  const secretPath = path.join(__dirname, '..', 'data', 'dashboard-session-secret.txt');
  const dir = path.dirname(secretPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(secretPath)) {
    const existing = fs.readFileSync(secretPath, 'utf8').trim();
    if (existing.length >= 32) return existing;
  }

  const generated = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(secretPath, generated, 'utf8');
  return generated;
};

const sessionSecret = getSessionSecret();

const buildUserAvatar = (user) => {
  if (!user?.avatar) return null;
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
};

const buildStateFromQueue = (client, queue) => {
  if (!queue) {
    return {
      connected: false,
      current: null,
      queue: [],
      playlistLoad: null,
      volume: config.music.defaultVolume,
      loop: 'off',
      paused: false,
      progressMs: 0,
      progressText: '0:00',
      totalMs: 0
    };
  }

  const position = client.musicManager.getPlayerPosition(queue);
  const playlistLoad = client.musicManager.buildPlaylistLoadSnapshot(queue.playlistLoadJob);

  return {
    connected: true,
    guildId: queue.guildId,
    voiceChannelId: queue.voiceChannelId,
    textChannelId: queue.textChannelId,
    current: queue.current
      ? {
          sessionId: queue.currentSessionId || 0,
          title: queue.current.title,
          author: queue.current.author,
          duration: queue.current.duration,
          durationText: formatDuration(queue.current.duration),
          url: queue.current.url,
          thumbnail: queue.current.thumbnail,
          requestedBy: queue.current.requestedBy,
          started: Boolean(queue.currentStarted)
        }
      : null,
    queue: queue.tracks.map((track) => ({
      title: track.title,
      author: track.author,
      duration: track.duration,
      durationText: formatDuration(track.duration),
      thumbnail: track.thumbnail,
      url: track.url
    })),
    playlistLoad: playlistLoad || null,
    volume: queue.volume,
    loop: queue.loopMode,
    filter: queue.filter || 'clear',
    paused: queue.paused,
    currentStarted: Boolean(queue.currentStarted),
    progressMs: position,
    progressText: formatDuration(position),
    totalMs: queue.current?.duration || 0
  };
};

const createDashboardServer = (client) => {
  const app = express();
  const dashboardSessionStore = new JsonSessionStore(path.join(__dirname, '..', 'data', 'dashboard-sessions.json'), {
    ttlMs: SESSION_MAX_AGE_MS
  });
  app.use(express.json({ limit: '1mb' }));
  app.use(
    session({
      store: dashboardSessionStore,
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        maxAge: SESSION_MAX_AGE_MS
      }
    })
  );

  const requireAuth = (req, res, next) => {
    if (!req.session.user) {
      res.status(401).json({ error: tr(req, 'dashboard.loginRequired') });
      return;
    }
    next();
  };

  const dashboardOpenNotifyChannelId = String(config.notifications.dashboardOpenChannelId || '').trim();
  const dashboardOpenNotifyCooldownMs = 30_000;
  const dashboardOpenNotifyRecent = new Map();

  const pruneDashboardOpenNotifyCache = () => {
    if (dashboardOpenNotifyRecent.size <= 3000) return;
    const now = Date.now();
    for (const [key, ts] of dashboardOpenNotifyRecent.entries()) {
      if (now - Number(ts || 0) > dashboardOpenNotifyCooldownMs * 3) {
        dashboardOpenNotifyRecent.delete(key);
      }
    }
  };

  const shouldNotifyDashboardOpen = (req) => {
    if (!dashboardOpenNotifyChannelId) return false;
    if (req.method !== 'GET') return false;

    const pathname = String(req.path || req.originalUrl || '').toLowerCase();
    if (!pathname) return false;
    if (pathname.startsWith('/api/')) return false;
    if (pathname.startsWith('/auth/')) return false;
    if (pathname === '/terms' || pathname === '/privacy') return false;

    // Avoid static assets (css/js/png/svg/etc): notify only real dashboard document requests.
    if (pathname.includes('.') && pathname !== '/index.html') return false;

    const accepts = String(req.headers.accept || '').toLowerCase();
    if (accepts && !accepts.includes('text/html')) return false;
    return true;
  };

  const notifyDashboardOpen = async (req) => {
    if (!shouldNotifyDashboardOpen(req)) return;

    const sessionUser = req.session?.user || null;
    const actorKey = sessionUser?.id
      ? `user:${sessionUser.id}`
      : `guest:${String(req.ip || 'unknown').slice(0, 80)}:${String(req.headers['user-agent'] || '').slice(0, 50)}`;
    const now = Date.now();
    const last = Number(dashboardOpenNotifyRecent.get(actorKey) || 0);
    if (now - last < dashboardOpenNotifyCooldownMs) return;

    dashboardOpenNotifyRecent.set(actorKey, now);
    pruneDashboardOpenNotifyCache();

    const channel = await client.channels.fetch(dashboardOpenNotifyChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      logger.warn(`Dashboard open notification channel not found or not text-based: ${dashboardOpenNotifyChannelId}`);
      return;
    }

    const displayName =
      sessionUser?.globalName || sessionUser?.username || (sessionUser?.id ? `User ${sessionUser.id}` : 'Guest');
    const userLabel = sessionUser?.id ? `${displayName} (${sessionUser.id})` : displayName;
    const locale = sessionUser?.locale || 'en';
    const sourcePath = String(req.path || '/');

    await channel
      .send({
        content: `🟦 Dashboard aperta da **${userLabel}** • locale: \`${locale}\` • path: \`${sourcePath}\``
      })
      .catch((error) => {
        logger.warn(`Failed to send dashboard-open notification: ${error?.message || error}`);
      });
  };

  const spotifyAllowedDiscordIds = new Set((config.spotify.dashboardAllowedDiscordIds || []).map((id) => String(id)));
  const spotifyScopes = Array.isArray(config.spotify.scopes) ? config.spotify.scopes.filter(Boolean) : [];
  const spotifyUserStore = new SpotifyUserStore(config.spotify.dashboardUsersFile);
  const spotifyOauthReady = Boolean(
    config.spotify.clientId && config.spotify.clientSecret && config.spotify.redirectUri && spotifyScopes.length
  );

  const isSpotifyAllowedUserId = (discordUserId) => spotifyAllowedDiscordIds.has(String(discordUserId || ''));
  const isSpotifyFeatureEnabledForUser = (discordUserId) => spotifyOauthReady && isSpotifyAllowedUserId(discordUserId);

  const requireSpotifyAllowed = (req, res, next) => {
    const discordUserId = req.session?.user?.id;
    if (!isSpotifyFeatureEnabledForUser(discordUserId)) {
      res.status(403).json({ error: tr(req, 'dashboard.spotifyNotAllowed') });
      return;
    }
    next();
  };

  const spotifyTokenRequest = async (params) => {
    const body = new URLSearchParams(params);
    const basic = Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString('base64');

    const response = await fetch(`${SPOTIFY_ACCOUNTS_API}/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });

    const raw = await response.text();
    let parsed = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    if (!response.ok) {
      const reason = parsed.error_description || parsed.error || raw || `HTTP ${response.status}`;
      throw new Error(`Spotify token error: ${reason}`);
    }

    return parsed;
  };

  const fetchSpotifyProfileByToken = async (accessToken) => {
    const response = await fetch(`${SPOTIFY_WEB_API}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      const raw = await response.text();
      throw new Error(`Spotify profile error: ${raw || response.statusText}`);
    }

    return response.json();
  };

  const mapSpotifyProfile = (profile) => ({
    spotifyUserId: profile?.id || null,
    displayName: profile?.display_name || profile?.id || 'Spotify User',
    country: profile?.country || null,
    avatarUrl: profile?.images?.[0]?.url || null
  });

  const storeSpotifyUserAuth = async (discordUserId, tokenData, profile = null) => {
    const existing = spotifyUserStore.get(discordUserId) || {};
    const profileData = profile
      ? mapSpotifyProfile(profile)
      : {
          spotifyUserId: existing.spotifyUserId || null,
          displayName: existing.displayName || 'Spotify User',
          country: existing.country || null,
          avatarUrl: existing.avatarUrl || null
        };
    const now = Date.now();
    const expiresIn = Math.max(60, Number(tokenData?.expires_in || 3600));
    const expiresAt = now + expiresIn * 1000;

    const stored = {
      spotifyUserId: profileData.spotifyUserId,
      displayName: profileData.displayName,
      country: profileData.country,
      avatarUrl: profileData.avatarUrl,
      accessToken: tokenData?.access_token || existing.accessToken || null,
      refreshToken: tokenData?.refresh_token || existing.refreshToken || null,
      tokenType: tokenData?.token_type || existing.tokenType || 'Bearer',
      scope: tokenData?.scope || existing.scope || spotifyScopes.join(' '),
      expiresAt,
      linkedAt: Number(existing.linkedAt || now),
      updatedAt: now
    };

    await spotifyUserStore.set(discordUserId, stored);
    return stored;
  };

  const storeSpotifyUserProfile = async (discordUserId, profile) => {
    const existing = spotifyUserStore.get(discordUserId) || {};
    const mapped = mapSpotifyProfile(profile);
    const updated = {
      ...existing,
      spotifyUserId: mapped.spotifyUserId,
      displayName: mapped.displayName,
      country: mapped.country,
      avatarUrl: mapped.avatarUrl,
      updatedAt: Date.now()
    };
    await spotifyUserStore.set(discordUserId, updated);
    return updated;
  };

  const refreshSpotifyUserAccessToken = async (discordUserId, existing) => {
    if (!existing?.refreshToken) {
      throw new Error('SPOTIFY_REFRESH_TOKEN_MISSING');
    }

    const tokenData = await spotifyTokenRequest({
      grant_type: 'refresh_token',
      refresh_token: existing.refreshToken
    });

    return storeSpotifyUserAuth(discordUserId, tokenData, null);
  };

  const ensureSpotifyUserToken = async (discordUserId) => {
    const stored = spotifyUserStore.get(discordUserId);
    if (!stored?.accessToken) throw new Error('SPOTIFY_NOT_CONNECTED');

    const expiresAt = Number(stored.expiresAt || 0);
    if (!expiresAt || expiresAt <= Date.now() + SPOTIFY_TOKEN_EXPIRY_SAFETY_MS) {
      return refreshSpotifyUserAccessToken(discordUserId, stored);
    }

    return stored;
  };

  const spotifyApiRequestForUser = async (discordUserId, endpointPath, options = {}, allowRetry = true) => {
    const auth = await ensureSpotifyUserToken(discordUserId);
    const url = endpointPath.startsWith('http') ? endpointPath : `${SPOTIFY_WEB_API}${endpointPath}`;
    const headers = {
      Authorization: `Bearer ${auth.accessToken}`,
      ...(options.headers || {})
    };

    const response = await fetch(url, { ...options, headers });
    if (response.status === 401 && allowRetry) {
      await refreshSpotifyUserAccessToken(discordUserId, auth);
      return spotifyApiRequestForUser(discordUserId, endpointPath, options, false);
    }
    return response;
  };

  const spotifyApiJsonForUser = async (discordUserId, endpointPath, options = {}) => {
    const response = await spotifyApiRequestForUser(discordUserId, endpointPath, options, true);
    const raw = await response.text();
    let parsed = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = {};
    }

    if (!response.ok) {
      const reason = parsed.error?.message || parsed.error_description || raw || response.statusText;
      throw new Error(`Spotify API error: ${reason}`);
    }
    return parsed;
  };

  const fetchUserPlaylists = async (discordUserId, limit = 24) => {
    const safeLimit = Math.max(1, Math.min(50, Number(limit || 24)));
    const payload = await spotifyApiJsonForUser(discordUserId, `/me/playlists?limit=${safeLimit}&offset=0`);
    const items = Array.isArray(payload?.items) ? payload.items : [];

    return items.map((playlist) => ({
      id: playlist.id,
      name: playlist.name,
      owner: playlist.owner?.display_name || playlist.owner?.id || '-',
      tracksTotal: Number(playlist.tracks?.total || 0),
      image: playlist.images?.[0]?.url || null,
      url: playlist.external_urls?.spotify || null,
      isPublic: playlist.public !== false
    }));
  };

  const fetchPlaylistTracksFromUserSpotify = async (discordUserId, playlistId, maxTracks = 500) => {
    const safePlaylistId = String(playlistId || '').trim();
    if (!safePlaylistId) throw new Error('SPOTIFY_PLAYLIST_ID_MISSING');
    const hardCap = Math.max(1, Math.min(1000, Number(maxTracks || 500)));

    const meta = await spotifyApiJsonForUser(
      discordUserId,
      `/playlists/${encodeURIComponent(safePlaylistId)}?fields=name,images,tracks(total),owner(display_name,id)`
    );

    const cover = meta?.images?.[0]?.url || null;
    const tracks = [];
    let offset = 0;

    while (tracks.length < hardCap) {
      const limit = Math.min(100, hardCap - tracks.length);
      const page = await spotifyApiJsonForUser(
        discordUserId,
        `/playlists/${encodeURIComponent(safePlaylistId)}/tracks?limit=${limit}&offset=${offset}`
      );
      const items = Array.isArray(page?.items) ? page.items : [];
      if (!items.length) break;

      for (const entry of items) {
        const track = entry?.track;
        if (!track || !track.name || !track.external_urls?.spotify) continue;
        tracks.push(client.musicManager.spotify.mapTrack(track, cover));
      }

      offset += items.length;
      if (!page?.next || items.length < limit) break;
    }

    return {
      name: meta?.name || 'Spotify Playlist',
      tracks,
      requestedCount: Number(meta?.tracks?.total || tracks.length)
    };
  };

  const fetchPlaylistTracksPageFromUserSpotify = async (discordUserId, playlistId, limit = 50, offset = 0) => {
    const safePlaylistId = String(playlistId || '').trim();
    if (!safePlaylistId) throw new Error('SPOTIFY_PLAYLIST_ID_MISSING');

    const safeLimit = Math.max(1, Math.min(100, Number(limit || 50)));
    const safeOffset = Math.max(0, Number(offset || 0));

    const meta = await spotifyApiJsonForUser(
      discordUserId,
      `/playlists/${encodeURIComponent(safePlaylistId)}?fields=id,name,images,tracks(total),owner(display_name,id),external_urls(spotify)`
    );

    const cover = meta?.images?.[0]?.url || null;
    const page = await spotifyApiJsonForUser(
      discordUserId,
      `/playlists/${encodeURIComponent(safePlaylistId)}/tracks?limit=${safeLimit}&offset=${safeOffset}`
    );

    const items = Array.isArray(page?.items) ? page.items : [];
    const tracks = [];
    for (const entry of items) {
      const track = entry?.track;
      if (!track || !track.name || !track.external_urls?.spotify) continue;
      const mapped = client.musicManager.spotify.mapTrack(track, cover);
      tracks.push({
        ...mapped,
        durationText: formatDuration(mapped.duration || 0)
      });
    }

    const total = Number(meta?.tracks?.total || 0);
    const nextOffset = page?.next ? safeOffset + safeLimit : null;

    return {
      playlist: {
        id: meta?.id || safePlaylistId,
        name: meta?.name || 'Spotify Playlist',
        owner: meta?.owner?.display_name || meta?.owner?.id || '-',
        image: cover,
        total,
        url: meta?.external_urls?.spotify || null
      },
      tracks,
      pagination: {
        limit: safeLimit,
        offset: safeOffset,
        nextOffset,
        hasMore: Boolean(page?.next),
        total
      }
    };
  };

  const fetchLikedTracksFromUserSpotify = async (discordUserId, maxTracks = 400) => {
    const hardCap = Math.max(1, Math.min(1000, Number(maxTracks || 400)));
    const tracks = [];
    let offset = 0;

    while (tracks.length < hardCap) {
      const limit = Math.min(50, hardCap - tracks.length);
      const page = await spotifyApiJsonForUser(discordUserId, `/me/tracks?limit=${limit}&offset=${offset}`);
      const items = Array.isArray(page?.items) ? page.items : [];
      if (!items.length) break;

      for (const entry of items) {
        const track = entry?.track;
        if (!track || !track.name || !track.external_urls?.spotify) continue;
        tracks.push(client.musicManager.spotify.mapTrack(track));
      }

      offset += items.length;
      if (!page?.next || items.length < limit) break;
    }

    return tracks;
  };

  const fetchLikedTracksPageFromUserSpotify = async (discordUserId, limit = 50, offset = 0) => {
    const safeLimit = Math.max(1, Math.min(50, Number(limit || 50)));
    const safeOffset = Math.max(0, Number(offset || 0));

    const page = await spotifyApiJsonForUser(discordUserId, `/me/tracks?limit=${safeLimit}&offset=${safeOffset}`);
    const items = Array.isArray(page?.items) ? page.items : [];
    const tracks = [];
    for (const entry of items) {
      const track = entry?.track;
      if (!track || !track.name || !track.external_urls?.spotify) continue;
      const mapped = client.musicManager.spotify.mapTrack(track);
      tracks.push({
        ...mapped,
        durationText: formatDuration(mapped.duration || 0)
      });
    }

    const total = Number(page?.total || 0);
    const nextOffset = page?.next ? safeOffset + safeLimit : null;
    return {
      playlist: {
        id: 'liked',
        name: 'Liked Songs',
        owner: 'Spotify',
        image: null,
        total
      },
      tracks,
      pagination: {
        limit: safeLimit,
        offset: safeOffset,
        nextOffset,
        hasMore: Boolean(page?.next),
        total
      }
    };
  };

  const buildSpotifySectionPayload = async (req) => {
    const discordUserId = req.session?.user?.id;
    const locale = getRequestLocale(req);
    const allowed = isSpotifyFeatureEnabledForUser(discordUserId);
    if (!allowed) {
      return {
        enabled: false,
        allowed: false,
        linked: false,
        profile: null,
        playlists: [],
        likedCount: 0,
        message: t(locale, 'dashboard.spotifyNotAllowed')
      };
    }

    const linkedUser = spotifyUserStore.get(discordUserId);
    if (!linkedUser?.accessToken) {
      return {
        enabled: true,
        allowed: true,
        linked: false,
        profile: null,
        playlists: [],
        likedCount: 0,
        message: t(locale, 'dashboard.spotifyNotConnected')
      };
    }

    const profile = await spotifyApiJsonForUser(discordUserId, '/me');
    const playlists = await fetchUserPlaylists(discordUserId, 30);
    const likedSummary = await spotifyApiJsonForUser(discordUserId, '/me/tracks?limit=1&offset=0');

    await storeSpotifyUserProfile(discordUserId, profile);

    return {
      enabled: true,
      allowed: true,
      linked: true,
      profile: mapSpotifyProfile(profile),
      playlists,
      likedCount: Number(likedSummary?.total || 0),
      message: t(locale, 'dashboard.connectedAndAuthorized')
    };
  };

  const fetchDiscordToken = async (code, redirectUri = config.discord.redirectUri) => {
    const body = new URLSearchParams({
      client_id: config.discord.clientId,
      client_secret: config.discord.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri
    });

    const response = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OAuth token error: ${text}`);
    }

    return response.json();
  };

  const fetchDiscordProfile = async (accessToken) => {
    const userRes = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!userRes.ok) throw new Error('Impossibile leggere profilo Discord');
    const user = await userRes.json();

    const guildRes = await fetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!guildRes.ok) throw new Error('Impossibile leggere guild Discord utente');
    const guilds = await guildRes.json();

    return { user, guilds };
  };

  const mapDiscordProfileToSessionUser = (profile) => {
    const userLocale = normalizeLocale(profile.user?.locale || 'en');
    return {
      id: profile.user.id,
      username: profile.user.username,
      globalName: profile.user.global_name || profile.user.username,
      avatar: profile.user.avatar,
      avatarUrl: buildUserAvatar(profile.user),
      guilds: (profile.guilds || []).map((g) => ({ id: g.id, name: g.name })),
      locale: userLocale,
      discordLocale: profile.user?.locale || null
    };
  };

  const hasGuildAccess = (req, guildId) => {
    const guildIds = new Set((req.session.user?.guilds || []).map((g) => g.id));
    return guildIds.has(guildId);
  };

  const getMemberVoiceChannelId = async (guild, userId) => {
    const member = guild.members.cache.get(userId) || (await guild.members.fetch(userId).catch(() => null));
    return member?.voice?.channelId || null;
  };

  const findSessionQueueForUser = async (req) => {
    const userId = req.session.user.id;

    const joinedQueues = [...client.musicManager.queues.values()]
      .filter((q) => q.joinedByUserId === userId)
      .sort((a, b) => (b.joinedAt || 0) - (a.joinedAt || 0));

    const chosen = joinedQueues.find((q) => hasGuildAccess(req, q.guildId));
    if (chosen) return chosen;

    // Backward-compatible fallback for queues created before metadata existed
    for (const queue of client.musicManager.queues.values()) {
      if (!hasGuildAccess(req, queue.guildId)) continue;
      const guild = client.guilds.cache.get(queue.guildId) || (await client.guilds.fetch(queue.guildId).catch(() => null));
      if (!guild) continue;
      const userVoiceId = await getMemberVoiceChannelId(guild, userId);
      if (userVoiceId && userVoiceId === queue.voiceChannelId) return queue;
    }

    return null;
  };

  const buildSessionPayload = async (req) => {
    const locale = getRequestLocale(req);
    const queue = await findSessionQueueForUser(req);
    if (!queue) {
      return {
        locale,
        session: null,
        state: buildStateFromQueue(client, null),
        canControl: false,
        message: t(locale, 'dashboard.sessionNotFound')
      };
    }

    const guild = client.guilds.cache.get(queue.guildId) || (await client.guilds.fetch(queue.guildId).catch(() => null));
    if (!guild) {
      return {
        locale,
        session: null,
        state: buildStateFromQueue(client, null),
        canControl: false,
        message: t(locale, 'dashboard.sessionGuildUnavailable')
      };
    }

    const userVoiceChannelId = await getMemberVoiceChannelId(guild, req.session.user.id);
    const canControl = Boolean(userVoiceChannelId && userVoiceChannelId === queue.voiceChannelId);
    if (canControl) client.musicManager.setQueueLocale(queue, locale);

    const voiceChannel = guild.channels.cache.get(queue.voiceChannelId) || (await guild.channels.fetch(queue.voiceChannelId).catch(() => null));
    const textChannel = guild.channels.cache.get(queue.textChannelId) || (await guild.channels.fetch(queue.textChannelId).catch(() => null));

    return {
      locale,
      session: {
        guildId: queue.guildId,
        guildName: guild.name,
        voiceChannelId: queue.voiceChannelId,
        voiceChannelName: voiceChannel?.name || t(locale, 'dashboard.unknownVoice'),
        textChannelId: queue.textChannelId,
        textChannelName: textChannel?.name || t(locale, 'dashboard.unknownText'),
        joinedAt: queue.joinedAt || 0
      },
      state: buildStateFromQueue(client, queue),
      canControl,
      userVoiceChannelId,
      message: canControl ? t(locale, 'dashboard.connectedAndAuthorized') : t(locale, 'dashboard.enterSameVoice')
    };
  };

  const requireControllableSession = async (req) => {
    const sessionPayload = await buildSessionPayload(req);
    if (!sessionPayload.session) throw new Error(sessionPayload.message);
    if (!sessionPayload.canControl) throw new Error(sessionPayload.message);

    return {
      session: sessionPayload.session,
      queue: client.musicManager.getQueue(sessionPayload.session.guildId)
    };
  };

  const requireSessionQueue = async (req) => {
    const sessionPayload = await buildSessionPayload(req);
    if (!sessionPayload.session) throw new Error(sessionPayload.message);

    const queue = client.musicManager.getQueue(sessionPayload.session.guildId);
    if (!queue) throw new Error(t(getRequestLocale(req), 'dashboard.noSessionActive'));
    if (!queue.current) throw new Error(t(getRequestLocale(req), 'dashboard.noTrackPlaying'));

    return {
      session: sessionPayload.session,
      queue
    };
  };

  const lyricsCache = new Map();
  const lyricsInflight = new Map();

  const readLyricsCache = (trackKey) => {
    const entry = lyricsCache.get(trackKey);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      lyricsCache.delete(trackKey);
      return null;
    }
    return entry;
  };

  const writeLyricsCache = (trackKey, value, ttlMs) => {
    if (!trackKey) return;
    if (lyricsCache.has(trackKey)) lyricsCache.delete(trackKey);
    lyricsCache.set(trackKey, {
      value,
      expiresAt: Date.now() + Math.max(1000, Number(ttlMs) || 1000)
    });

    while (lyricsCache.size > LYRICS_CACHE_MAX_ENTRIES) {
      const oldest = lyricsCache.keys().next().value;
      if (!oldest) break;
      lyricsCache.delete(oldest);
    }
  };

  const fetchLyricsFromProvider = async (track) => {
    const url = new URL(LRCLIB_API);
    url.searchParams.set('track_name', track.title || '');
    url.searchParams.set('artist_name', (track.author || '').split(',')[0].trim());
    if (track.duration) url.searchParams.set('duration', String(Math.round(track.duration / 1000)));

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'TunixBot/1.0 (Dashboard Lyrics)'
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      syncedLyrics: data.syncedLyrics || data.synced_lyrics || null,
      plainLyrics: data.plainLyrics || data.plain_lyrics || null
    };
  };

  const fetchSyncedLyrics = async (track, locale = 'en') => {
    const trackKey = buildLyricsCacheKey(track);
    const cached = readLyricsCache(trackKey);
    if (cached) {
      if (cached.value?.notFound) throw new Error(t(locale, 'dashboard.lyricsNotFound'));
      return cached.value;
    }

    if (trackKey && lyricsInflight.has(trackKey)) {
      const inflightResult = await lyricsInflight.get(trackKey);
      if (inflightResult?.notFound) throw new Error(t(locale, 'dashboard.lyricsNotFound'));
      return inflightResult;
    }

    const request = (async () => {
      const result = await fetchLyricsFromProvider(track);
      if (!result || (!result.syncedLyrics && !result.plainLyrics)) {
        const value = { notFound: true, syncedLyrics: null, plainLyrics: null };
        writeLyricsCache(trackKey, value, LYRICS_CACHE_NOT_FOUND_TTL_MS);
        return value;
      }

      writeLyricsCache(trackKey, result, LYRICS_CACHE_SUCCESS_TTL_MS);
      return result;
    })().finally(() => {
      lyricsInflight.delete(trackKey);
    });

    if (trackKey) lyricsInflight.set(trackKey, request);
    const finalResult = await request;

    if (finalResult?.notFound) throw new Error(t(locale, 'dashboard.lyricsNotFound'));
    return finalResult;
  };

  const publicDir = path.join(__dirname, 'public');

  const topggWebhookAuth = String(config.topgg.webhookAuth || '').trim();
  const topggWebhookPath = normalizeTopggWebhookPath(config.topgg.webhookPath);
  const topggVoteChannelId = String(config.notifications.topggVoteChannelId || '').trim();

  const sendTopggVoteNotification = async (votePayload) => {
    if (!topggVoteChannelId) return;
    const vote = normalizeTopggVotePayload(votePayload);
    if (!vote) return;

    const channel = await client.channels.fetch(topggVoteChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      logger.warn(`Top.gg vote log channel not found or not text-based: ${topggVoteChannelId}`);
      return;
    }

    const isTest = vote.voteType === 'test' || vote.rawType === 'webhook.test';
    const mention = vote.userDiscordId ? `<@${vote.userDiscordId}>` : vote.username ? `**${vote.username}**` : '`unknown-user`';
    const multiplier = vote.weight > 1 ? ` x${vote.weight}` : '';
    const querySuffix = vote.query ? ` • query: \`${vote.query}\`` : '';
    const base = isTest ? '🧪 Top.gg webhook test ricevuto' : '🗳️ Nuovo voto Top.gg ricevuto';

    const details = [
      `${base} da ${mention}${multiplier}`,
      `type: \`${vote.rawType || vote.voteType}\`${vote.schema ? ` • schema: \`${vote.schema}\`` : ''}`,
      vote.projectDiscordId ? `project: \`${vote.projectDiscordId}\`` : null,
      vote.userTopggId ? `topgg user: \`${vote.userTopggId}\`` : null
    ]
      .filter(Boolean)
      .join('\n');

    await channel.send({ content: `${details}${querySuffix}` }).catch((error) => {
      logger.warn(`Failed to send Top.gg vote notification: ${error?.message || error}`);
    });
  };

  if (topggWebhookAuth) {
    const webhook = new Webhook(topggWebhookAuth);
    app.post(
      topggWebhookPath,
      webhook.listener(async (vote) => {
        sendTopggVoteNotification(vote).catch((error) => {
          logger.warn(`Top.gg vote handler failed: ${error?.message || error}`);
        });
      })
    );
    logger.info(`Top.gg webhook enabled on path: ${topggWebhookPath}`);
  } else {
    logger.info('Top.gg webhook disabled: TOPGG_WEBHOOK_AUTH missing.');
  }

  app.get('/terms', (_req, res) => {
    res.sendFile(path.join(publicDir, 'terms.html'));
  });

  app.get('/privacy', (_req, res) => {
    res.sendFile(path.join(publicDir, 'privacy.html'));
  });

  client.prefetchDashboardLyrics = async (track) => {
    try {
      if (!track) return;
      await fetchSyncedLyrics(track, 'en');
    } catch (error) {
      logger.debug?.(`Lyrics prefetch skipped: ${error?.message || error}`);
    }
  };

  app.get('/auth/discord/login', (req, res) => {
    if (!config.discord.clientSecret) {
      res.status(500).send(t('en', 'dashboard.oauthSecretMissing'));
      return;
    }

    const state = crypto.randomBytes(16).toString('hex');
    req.session.oauthState = state;

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.discord.clientId,
      scope: 'identify guilds',
      redirect_uri: config.discord.redirectUri,
      state,
      prompt: 'consent'
    });

    res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
  });

  app.get('/auth/discord/callback', async (req, res) => {
    try {
      const locale = getRequestLocale(req);
      if (!req.query.code || !req.query.state) {
        throw new Error(t(locale, 'dashboard.oauthIncomplete'));
      }

      if (req.session.oauthState !== req.query.state) {
        throw new Error(t(locale, 'dashboard.oauthStateInvalid'));
      }

      const token = await fetchDiscordToken(String(req.query.code));
      const profile = await fetchDiscordProfile(token.access_token);
      req.session.user = mapDiscordProfileToSessionUser(profile);
      req.session.locale = req.session.user.locale;

      delete req.session.oauthState;
      res.redirect('/');
    } catch (error) {
      logger.error('OAuth callback failed', error);
      const locale = getRequestLocale(req);
      res.status(500).send(t(locale, 'dashboard.oauthFailed', { error: formatApiError(req, error) }));
    }
  });

  app.get('/auth/spotify/login', requireAuth, (req, res) => {
    if (!spotifyOauthReady) {
      res.status(500).send(tr(req, 'dashboard.spotifyFeatureDisabled'));
      return;
    }

    if (!isSpotifyFeatureEnabledForUser(req.session.user.id)) {
      res.status(403).send(tr(req, 'dashboard.spotifyNotAllowed'));
      return;
    }

    const state = crypto.randomBytes(24).toString('hex');
    req.session.spotifyOauthState = state;
    req.session.spotifyOauthUserId = req.session.user.id;

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.spotify.clientId,
      scope: spotifyScopes.join(' '),
      redirect_uri: config.spotify.redirectUri,
      state,
      show_dialog: 'false'
    });

    res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
  });

  app.get('/auth/spotify/callback', async (req, res) => {
    const locale = getRequestLocale(req);
    try {
      if (!req.session.user) throw new Error(t(locale, 'dashboard.loginRequired'));
      if (!spotifyOauthReady) throw new Error(t(locale, 'dashboard.spotifyFeatureDisabled'));
      if (!isSpotifyFeatureEnabledForUser(req.session.user.id)) throw new Error(t(locale, 'dashboard.spotifyNotAllowed'));

      const oauthCode = String(req.query.code || '');
      const oauthState = String(req.query.state || '');
      if (!oauthCode || !oauthState) throw new Error(t(locale, 'dashboard.spotifyOauthIncomplete'));

      if (
        req.session.spotifyOauthState !== oauthState ||
        String(req.session.spotifyOauthUserId || '') !== String(req.session.user.id || '')
      ) {
        throw new Error(t(locale, 'dashboard.spotifyOauthStateInvalid'));
      }

      const tokenData = await spotifyTokenRequest({
        grant_type: 'authorization_code',
        code: oauthCode,
        redirect_uri: config.spotify.redirectUri
      });

      const profile = await fetchSpotifyProfileByToken(tokenData.access_token);
      await storeSpotifyUserAuth(req.session.user.id, tokenData, profile);

      delete req.session.spotifyOauthState;
      delete req.session.spotifyOauthUserId;
      res.redirect('/');
    } catch (error) {
      logger.error('Spotify OAuth callback failed', error);
      res.status(500).send(t(locale, 'dashboard.spotifyOauthFailed', { error: formatApiError(req, error) }));
    }
  });

  app.post('/auth/spotify/logout', requireAuth, requireSpotifyAllowed, async (req, res) => {
    try {
      await spotifyUserStore.delete(req.session.user.id);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: formatApiError(req, error, 'dashboard.spotifyLibraryFailed') });
    }
  });

  app.post('/auth/logout', (req, res) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  app.get('/api/me', (req, res) => {
    if (!req.session.user) {
      res.json({ authenticated: false, user: null, locale: 'en', spotifyAllowed: false });
      return;
    }

    if (!req.session.user.locale) {
      const recoveredLocale = normalizeLocale(req.session.user.discordLocale || req.session.locale || 'en');
      req.session.user.locale = recoveredLocale;
      req.session.locale = recoveredLocale;
    }

    const locale = getRequestLocale(req);
    res.json({
      authenticated: true,
      user: req.session.user,
      locale,
      spotifyAllowed: isSpotifyFeatureEnabledForUser(req.session.user.id)
    });
  });

  app.get('/api/spotify/library', requireAuth, async (req, res) => {
    try {
      if (!spotifyOauthReady) {
        res.json({
          enabled: false,
          allowed: false,
          linked: false,
          profile: null,
          playlists: [],
          likedCount: 0,
          message: tr(req, 'dashboard.spotifyFeatureDisabled')
        });
        return;
      }

      const payload = await buildSpotifySectionPayload(req);
      res.json(payload);
    } catch (error) {
      res.status(500).json({ error: formatApiError(req, error, 'dashboard.spotifyLibraryFailed') });
    }
  });

  app.get('/api/spotify/playlist/:playlistId/tracks', requireAuth, requireSpotifyAllowed, async (req, res) => {
    try {
      const playlistId = String(req.params?.playlistId || '').trim();
      if (!playlistId) {
        res.status(400).json({ error: tr(req, 'dashboard.spotifyPlaylistIdMissing') });
        return;
      }

      const limit = Number(req.query?.limit || 50);
      const offset = Number(req.query?.offset || 0);
      const payload = await fetchPlaylistTracksPageFromUserSpotify(req.session.user.id, playlistId, limit, offset);
      res.json(payload);
    } catch (error) {
      res.status(500).json({ error: formatApiError(req, error, 'dashboard.spotifyPlaylistTracksFailed') });
    }
  });

  app.get('/api/spotify/liked/tracks', requireAuth, requireSpotifyAllowed, async (req, res) => {
    try {
      const limit = Number(req.query?.limit || 50);
      const offset = Number(req.query?.offset || 0);
      const payload = await fetchLikedTracksPageFromUserSpotify(req.session.user.id, limit, offset);
      res.json(payload);
    } catch (error) {
      res.status(500).json({ error: formatApiError(req, error, 'dashboard.spotifyPlaylistTracksFailed') });
    }
  });

  app.post('/api/spotify/queue/playlist', requireAuth, requireSpotifyAllowed, async (req, res) => {
    try {
      const playlistId = String(req.body?.playlistId || '').trim();
      if (!playlistId) {
        res.status(400).json({ error: tr(req, 'dashboard.spotifyPlaylistIdMissing') });
        return;
      }

      const { session, queue } = await requireControllableSession(req);
      const locale = getRequestLocale(req);
      const userLocaleRaw = req.session?.user?.discordLocale || req.session?.user?.locale || req.session?.locale || locale;
      client.musicManager.setQueueLocale(queue, locale);

      const playlistData = await fetchPlaylistTracksFromUserSpotify(req.session.user.id, playlistId, 500);
      const result = await client.musicManager.enqueueSpotifyTrackList({
        guildId: session.guildId,
        voiceChannelId: queue.voiceChannelId,
        textChannelId: queue.textChannelId,
        requestedBy: req.session.user.id,
        spotifyTracks: playlistData.tracks,
        locale,
        userLocale: userLocaleRaw,
        sourceKind: 'playlist',
        playlistName: playlistData.name
      });

      const payload = await buildSessionPayload(req);
      res.json({ ok: true, result, ...payload });
    } catch (error) {
      res.status(403).json({ error: formatApiError(req, error, 'dashboard.spotifyQueuePlaylistFailed') });
    }
  });

  app.post('/api/spotify/queue/liked', requireAuth, requireSpotifyAllowed, async (req, res) => {
    try {
      const { session, queue } = await requireControllableSession(req);
      const locale = getRequestLocale(req);
      const userLocaleRaw = req.session?.user?.discordLocale || req.session?.user?.locale || req.session?.locale || locale;
      client.musicManager.setQueueLocale(queue, locale);

      const likedTracks = await fetchLikedTracksFromUserSpotify(req.session.user.id, 500);
      if (!likedTracks.length) throw new Error(t(locale, 'dashboard.spotifyLikedEmpty'));

      const result = await client.musicManager.enqueueSpotifyTrackList({
        guildId: session.guildId,
        voiceChannelId: queue.voiceChannelId,
        textChannelId: queue.textChannelId,
        requestedBy: req.session.user.id,
        spotifyTracks: likedTracks,
        locale,
        userLocale: userLocaleRaw,
        sourceKind: 'playlist',
        playlistName: t(locale, 'dashboard.spotifyLikedSongsName')
      });

      const payload = await buildSessionPayload(req);
      res.json({ ok: true, result, ...payload });
    } catch (error) {
      res.status(403).json({ error: formatApiError(req, error, 'dashboard.spotifyQueueLikedFailed') });
    }
  });

  app.get('/api/session', requireAuth, async (req, res) => {
    try {
      const payload = await buildSessionPayload(req);
      res.json(payload);
    } catch (error) {
      res.status(500).json({ error: formatApiError(req, error, 'dashboard.errorSession') });
    }
  });

  app.get('/api/search', requireAuth, async (req, res) => {
    const q = String(req.query.q || '').trim();
    const source = parseSearchSource(String(req.query.source || 'spotify').toLowerCase());
    const userLocaleRaw = req.session?.user?.discordLocale || req.session?.user?.locale || req.session?.locale || 'it';
    if (!q) {
      res.json({ tracks: [] });
      return;
    }

    try {
      const tracks = await client.musicManager.searchTracks(q, { source, limit: 30, locale: userLocaleRaw });
      res.json({ tracks, source });
    } catch (error) {
      res.status(500).json({ error: formatApiError(req, error, 'dashboard.errorSearch') });
    }
  });

  app.get('/api/discover', requireAuth, async (req, res) => {
    try {
      const seeds = ['italian rap', 'pop 2026', 'chill mix', 'night drive', 'viral hits', 'dance playlist'];
      const userLocaleRaw = req.session?.user?.discordLocale || req.session?.user?.locale || req.session?.locale || 'it';

      const sections = [];
      for (const seed of seeds) {
        const tracks = await client.musicManager.searchTracks(seed, { source: 'spotify', limit: 8, locale: userLocaleRaw });
        sections.push({ title: seed, tracks });
      }

      res.json({ sections });
    } catch (error) {
      res.status(500).json({ error: formatApiError(req, error, 'dashboard.errorDiscover') });
    }
  });

  app.post('/api/play', requireAuth, async (req, res) => {
    const { query } = req.body || {};

    if (!query) {
      res.status(400).json({ error: tr(req, 'dashboard.missingQuery') });
      return;
    }

    try {
      const { session, queue } = await requireControllableSession(req);
      const locale = getRequestLocale(req);
      const userLocaleRaw = req.session?.user?.discordLocale || req.session?.user?.locale || req.session?.locale || locale;
      client.musicManager.setQueueLocale(queue, locale);

      const result = await client.musicManager.enqueueQuery({
        guildId: session.guildId,
        voiceChannelId: queue.voiceChannelId,
        textChannelId: queue.textChannelId,
        query,
        requestedBy: req.session.user.id,
        locale,
        userLocale: userLocaleRaw,
        allowAsyncPlaylistLoad: true
      });

      const payload = await buildSessionPayload(req);
      res.json({ ok: true, result, ...payload });
    } catch (error) {
      res.status(403).json({ error: formatApiError(req, error, 'dashboard.errorPlay') });
    }
  });

  app.post('/api/control', requireAuth, async (req, res) => {
    const { action, value } = req.body || {};
    if (!action) {
      res.status(400).json({ error: tr(req, 'dashboard.missingAction') });
      return;
    }

    try {
      const { session, queue } = await requireControllableSession(req);
      client.musicManager.setQueueLocale(queue, getRequestLocale(req));
      const guildId = session.guildId;

      if (action === 'pause') await client.musicManager.pause(guildId);
      else if (action === 'resume') await client.musicManager.resume(guildId);
      else if (action === 'skip') await client.musicManager.skip(guildId);
      else if (action === 'stop') await client.musicManager.stop(guildId);
      else if (action === 'shuffle') await client.musicManager.shuffle(guildId);
      else if (action === 'clear') await client.musicManager.clearQueue(guildId);
      else if (action === 'remove') await client.musicManager.removeAt(guildId, Number(value));
      else if (action === 'play_index') await client.musicManager.playFromQueueAt(guildId, Number(value));
      else if (action === 'cancel_playlist_load') await client.musicManager.cancelPlaylistLoad(guildId);
      else if (action === 'volume') await client.musicManager.setVolume(guildId, Number(value));
      else if (action === 'seek') await client.musicManager.seek(guildId, Number(value));
      else if (action === 'filter') await client.musicManager.applyFilter(guildId, String(value || 'clear'));
      else if (action === 'loop') {
        const mode = parseLoopMode(String(value || ''));
        if (!mode) throw new Error(tr(req, 'dashboard.invalidLoopMode'));
        await client.musicManager.setLoop(guildId, mode);
      } else {
        throw new Error(tr(req, 'dashboard.unsupportedAction'));
      }

      const payload = await buildSessionPayload(req);
      res.json({ ok: true, ...payload });
    } catch (error) {
      res.status(403).json({ error: formatApiError(req, error, 'dashboard.errorControl') });
    }
  });

  app.get('/api/lyrics', requireAuth, async (req, res) => {
    try {
      const locale = getRequestLocale(req);
      const { queue } = await requireSessionQueue(req);
      const lyrics = await fetchSyncedLyrics(queue.current, locale);

      if (!lyrics.syncedLyrics && !lyrics.plainLyrics) {
        throw new Error(t(locale, 'dashboard.lyricsNotAvailableForTrack'));
      }

      res.json({
        ok: true,
        track: {
          sessionId: queue.currentSessionId || 0,
          title: queue.current.title,
          author: queue.current.author,
          duration: queue.current.duration
        },
        syncedLyrics: lyrics.syncedLyrics,
        plainLyrics: lyrics.plainLyrics
      });
    } catch (error) {
      res.status(404).json({ error: formatApiError(req, error, 'dashboard.errorLyrics') });
    }
  });

  app.use((req, _res, next) => {
    notifyDashboardOpen(req).catch((error) => {
      logger.warn(`Dashboard open notification failed: ${error?.message || error}`);
    });
    next();
  });

  app.use(express.static(path.join(__dirname, 'public')));

  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  const server = app.listen(config.dashboard.port, config.dashboard.host, () => {
    logger.info(`Dashboard online: http://${config.dashboard.host}:${config.dashboard.port}`);
  });

  return server;
};

module.exports = createDashboardServer;
