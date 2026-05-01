const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const config = require('../config');
const logger = require('../utils/logger');
const { formatDuration } = require('../utils/time');
const JsonSessionStore = require('./jsonSessionStore');
const { normalizeLocale, t, localizeErrorMessage } = require('../utils/i18n');

const DISCORD_API = 'https://discord.com/api/v10';
const LRCLIB_API = 'https://lrclib.net/api/get';
const LYRICS_CACHE_MAX_ENTRIES = 500;
const LYRICS_CACHE_SUCCESS_TTL_MS = 1000 * 60 * 60 * 12;
const LYRICS_CACHE_NOT_FOUND_TTL_MS = 1000 * 60 * 10;
const ACTIVITY_AUTH_HEADER = 'x-activity-auth';

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

const base64UrlEncode = (input) => Buffer.from(String(input)).toString('base64url');
const base64UrlDecode = (input) => Buffer.from(String(input), 'base64url').toString('utf8');

const signActivityPayload = (payloadB64) => crypto.createHmac('sha256', sessionSecret).update(payloadB64).digest('base64url');

const buildActivityAuthToken = (user, locale) => {
  const now = Date.now();
  const payload = {
    v: 1,
    iat: now,
    exp: now + SESSION_MAX_AGE_MS,
    locale: normalizeLocale(locale || user?.locale || 'en'),
    user: {
      id: user?.id || null,
      username: user?.username || null,
      globalName: user?.globalName || user?.username || null,
      avatar: user?.avatar || null,
      avatarUrl: user?.avatarUrl || null,
      guilds: Array.isArray(user?.guilds)
        ? user.guilds.map((g) => ({ id: String(g.id || ''), name: String(g.name || '') })).filter((g) => g.id)
        : [],
      locale: normalizeLocale(user?.locale || locale || 'en'),
      discordLocale: user?.discordLocale || null
    }
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signature = signActivityPayload(payloadB64);
  return `${payloadB64}.${signature}`;
};

const parseActivityAuthToken = (token) => {
  try {
    if (!token || typeof token !== 'string') return null;
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) return null;

    const expected = signActivityPayload(payloadB64);
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (sigBuffer.length !== expectedBuffer.length) return null;
    if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null;

    const parsed = JSON.parse(base64UrlDecode(payloadB64));
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.user?.id) return null;
    if (Number(parsed.exp || 0) <= Date.now()) return null;

    return parsed;
  } catch {
    return null;
  }
};

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
      volume: config.music.defaultVolume,
      loop: 'off',
      paused: false,
      progressMs: 0,
      progressText: '0:00',
      totalMs: 0
    };
  }

  const position = client.musicManager.getPlayerPosition(queue);

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
          requestedBy: queue.current.requestedBy
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
    volume: queue.volume,
    loop: queue.loopMode,
    filter: queue.filter || 'clear',
    paused: queue.paused,
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

  app.use((req, _res, next) => {
    if (req.session?.user) return next();

    const headerToken = req.get(ACTIVITY_AUTH_HEADER);
    const queryToken = typeof req.query?.activity_auth === 'string' ? req.query.activity_auth : null;
    const token = headerToken || queryToken;
    if (!token) return next();

    const parsed = parseActivityAuthToken(token);
    if (!parsed?.user?.id) return next();

    req.session.user = parsed.user;
    req.session.locale = normalizeLocale(parsed.locale || parsed.user.locale || 'en');
    req.activityAuthToken = token;
    return next();
  });

  const requireAuth = (req, res, next) => {
    if (!req.session.user) {
      res.status(401).json({ error: tr(req, 'dashboard.loginRequired') });
      return;
    }
    next();
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

  app.get('/terms', (_req, res) => {
    res.sendFile(path.join(publicDir, 'terms.html'));
  });

  app.get('/privacy', (_req, res) => {
    res.sendFile(path.join(publicDir, 'privacy.html'));
  });

  app.get('/activity', (_req, res) => {
    res.sendFile(path.join(publicDir, 'activity.html'));
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
    const frameId = String(req.query?.frame_id || '').trim();
    const instanceId = String(req.query?.instance_id || '').trim();
    const guildId = String(req.query?.guild_id || '').trim();
    const channelId = String(req.query?.channel_id || '').trim();
    const launchId = String(req.query?.launch_id || '').trim();
    const referer = String(req.get('referer') || '');
    const secFetchDest = String(req.get('sec-fetch-dest') || '').toLowerCase();
    const userAgent = String(req.get('user-agent') || '').toLowerCase();
    const fromActivity =
      String(req.query?.activity || '') === '1' ||
      frameId.length > 0 ||
      instanceId.length > 0 ||
      guildId.length > 0 ||
      channelId.length > 0 ||
      referer.includes('/activity') ||
      secFetchDest === 'iframe' ||
      userAgent.includes('discord');
    if (fromActivity) {
      const params = new URLSearchParams();
      if (frameId) params.set('frame_id', frameId);
      if (instanceId) params.set('instance_id', instanceId);
      if (guildId) params.set('guild_id', guildId);
      if (channelId) params.set('channel_id', channelId);
      if (launchId) params.set('launch_id', launchId);
      params.set('activity', '1');
      res.redirect(`/activity?${params.toString()}`);
      return;
    }

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

  app.post('/api/activity/auth', async (req, res) => {
    try {
      if (!config.discord.clientSecret) {
        throw new Error(t('en', 'dashboard.oauthSecretMissing'));
      }

      const code = String(req.body?.code || '').trim();
      if (!code) {
        res.status(400).json({ error: tr(req, 'dashboard.oauthIncomplete') });
        return;
      }

      const token = await fetchDiscordToken(code, config.discord.activityRedirectUri);
      const profile = await fetchDiscordProfile(token.access_token);
      const user = mapDiscordProfileToSessionUser(profile);

      req.session.user = user;
      req.session.locale = user.locale;

      const activityAuthToken = buildActivityAuthToken(user, user.locale);
      res.json({
        ok: true,
        token: activityAuthToken,
        user,
        locale: user.locale
      });
    } catch (error) {
      logger.error('Activity OAuth failed', error);
      res.status(500).json({ error: formatApiError(req, error, 'dashboard.oauthFailed') });
    }
  });

  app.post('/auth/logout', (req, res) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  app.get('/api/activity/config', (_req, res) => {
    res.json({
      clientId: config.discord.clientId,
      redirectUri: config.discord.activityRedirectUri,
      dashboardUrl: config.dashboard.publicUrl || '/'
    });
  });

  app.get('/api/me', (req, res) => {
    if (!req.session.user) {
      res.json({ authenticated: false, user: null, locale: 'en' });
      return;
    }

    if (!req.session.user.locale) {
      const recoveredLocale = normalizeLocale(req.session.user.discordLocale || req.session.locale || 'en');
      req.session.user.locale = recoveredLocale;
      req.session.locale = recoveredLocale;
    }

    const locale = getRequestLocale(req);
    res.json({ authenticated: true, user: req.session.user, locale });
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
        userLocale: userLocaleRaw
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

  app.use(
    '/vendor/embedded-app-sdk',
    express.static(path.join(__dirname, '..', '..', 'node_modules', '@discord', 'embedded-app-sdk', 'output'))
  );
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('*', (req, res) => {
    const isActivityLaunch =
      typeof req.query?.frame_id === 'string' ||
      typeof req.query?.instance_id === 'string' ||
      typeof req.query?.channel_id === 'string' ||
      typeof req.query?.guild_id === 'string';

    if (isActivityLaunch) {
      res.sendFile(path.join(__dirname, 'public', 'activity.html'));
      return;
    }

    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  const server = app.listen(config.dashboard.port, config.dashboard.host, () => {
    logger.info(`Dashboard online: http://${config.dashboard.host}:${config.dashboard.port}`);
  });

  return server;
};

module.exports = createDashboardServer;
