const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const config = require('../config');
const logger = require('../utils/logger');
const { formatDuration } = require('../utils/time');
const SpotifyUserStore = require('./spotifyUserStore');

const DISCORD_API = 'https://discord.com/api/v10';
const LRCLIB_API = 'https://lrclib.net/api/get';
const SPOTIFY_ACCOUNTS_API = 'https://accounts.spotify.com';
const SPOTIFY_API = 'https://api.spotify.com/v1';

const parseLoopMode = (value) => {
  if (!value) return null;
  if (['off', 'song', 'queue'].includes(value)) return value;
  return null;
};

const parseSearchSource = (value) => {
  if (value === 'youtube') return 'youtube';
  return 'spotify';
};

const sessionSecret = process.env.DASHBOARD_SESSION_SECRET || crypto.randomBytes(32).toString('hex');

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
  const spotifyStore = new SpotifyUserStore(path.join(__dirname, '..', 'data', 'spotify-users.json'));
  const spotifyEnabled = Boolean(config.spotify.clientId && config.spotify.clientSecret && config.spotify.redirectUri);
  app.use(express.json({ limit: '1mb' }));
  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        maxAge: 1000 * 60 * 60 * 24 * 7
      }
    })
  );

  const requireAuth = (req, res, next) => {
    if (!req.session.user) {
      res.status(401).json({ error: 'Login richiesto' });
      return;
    }
    next();
  };

  const requireSpotifyEnabled = (res) => {
    if (spotifyEnabled) return true;
    res.status(500).json({ error: 'Spotify OAuth non configurato. Imposta SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET e SPOTIFY_REDIRECT_URI.' });
    return false;
  };

  const spotifyBasicAuth = () =>
    Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString('base64');

  const buildSpotifyState = () => crypto.randomBytes(24).toString('hex');

  const saveSpotifyAccount = async (discordUserId, account) => {
    await spotifyStore.set(discordUserId, {
      ...account,
      updatedAt: Date.now()
    });
  };

  const fetchSpotifyToken = async (bodyParams) => {
    const body = new URLSearchParams(bodyParams);
    const response = await fetch(`${SPOTIFY_ACCOUNTS_API}/api/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${spotifyBasicAuth()}`
      },
      body
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error_description || data.error || 'Token Spotify non valido.');
    }
    return data;
  };

  const fetchSpotifyProfile = async (accessToken) => {
    const response = await fetch(`${SPOTIFY_API}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error?.message || 'Impossibile leggere profilo Spotify.');
    }
    return data;
  };

  const ensureSpotifyAccessToken = async (discordUserId) => {
    const account = spotifyStore.get(discordUserId);
    if (!account) throw new Error('Nessun account Spotify collegato.');

    const expiresAt = Number(account.expiresAt || 0);
    const now = Date.now();
    if (account.accessToken && expiresAt > now + 20_000) return account;
    if (!account.refreshToken) throw new Error('Sessione Spotify scaduta. Ricollega il tuo account.');

    const refreshed = await fetchSpotifyToken({
      grant_type: 'refresh_token',
      refresh_token: account.refreshToken
    });

    const next = {
      ...account,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token || account.refreshToken,
      tokenType: refreshed.token_type || 'Bearer',
      scope: refreshed.scope || account.scope || '',
      expiresAt: Date.now() + Number(refreshed.expires_in || 3600) * 1000
    };

    await saveSpotifyAccount(discordUserId, next);
    return next;
  };

  const spotifyRequest = async (discordUserId, endpoint, query = {}) => {
    const account = await ensureSpotifyAccessToken(discordUserId);
    const url = new URL(`${SPOTIFY_API}${endpoint}`);
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      url.searchParams.set(k, String(v));
    }

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${account.accessToken}` }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error?.message || 'Errore richiesta Spotify.');
    }
    return data;
  };

  const fetchDiscordToken = async (code) => {
    const body = new URLSearchParams({
      client_id: config.discord.clientId,
      client_secret: config.discord.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.discord.redirectUri
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
    const queue = await findSessionQueueForUser(req);
    if (!queue) {
      return {
        session: null,
        state: buildStateFromQueue(client, null),
        canControl: false,
        message: 'Nessuna sessione trovata. Usa /join da Discord nel canale vocale desiderato.'
      };
    }

    const guild = client.guilds.cache.get(queue.guildId) || (await client.guilds.fetch(queue.guildId).catch(() => null));
    if (!guild) {
      return {
        session: null,
        state: buildStateFromQueue(client, null),
        canControl: false,
        message: 'La guild della sessione non e piu disponibile.'
      };
    }

    const userVoiceChannelId = await getMemberVoiceChannelId(guild, req.session.user.id);
    const canControl = Boolean(userVoiceChannelId && userVoiceChannelId === queue.voiceChannelId);

    const voiceChannel = guild.channels.cache.get(queue.voiceChannelId) || (await guild.channels.fetch(queue.voiceChannelId).catch(() => null));
    const textChannel = guild.channels.cache.get(queue.textChannelId) || (await guild.channels.fetch(queue.textChannelId).catch(() => null));

    return {
      session: {
        guildId: queue.guildId,
        guildName: guild.name,
        voiceChannelId: queue.voiceChannelId,
        voiceChannelName: voiceChannel?.name || 'Unknown Voice',
        textChannelId: queue.textChannelId,
        textChannelName: textChannel?.name || 'Unknown Text',
        joinedAt: queue.joinedAt || 0
      },
      state: buildStateFromQueue(client, queue),
      canControl,
      userVoiceChannelId,
      message: canControl ? 'Connesso e autorizzato.' : 'Entra nella stessa vocale del bot per controllare la musica.'
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
    if (!queue) throw new Error('Nessuna sessione musicale attiva.');
    if (!queue.current) throw new Error('Nessun brano in riproduzione.');

    return {
      session: sessionPayload.session,
      queue
    };
  };

  const fetchSyncedLyrics = async (track) => {
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
      throw new Error('Lyrics non trovate.');
    }

    const data = await response.json();
    return {
      syncedLyrics: data.syncedLyrics || data.synced_lyrics || null,
      plainLyrics: data.plainLyrics || data.plain_lyrics || null
    };
  };

  app.get('/auth/discord/login', (req, res) => {
    if (!config.discord.clientSecret) {
      res.status(500).send('DISCORD_CLIENT_SECRET mancante nel .env');
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
      if (!req.query.code || !req.query.state) {
        throw new Error('Callback OAuth incompleto');
      }

      if (req.session.oauthState !== req.query.state) {
        throw new Error('State OAuth non valido');
      }

      const token = await fetchDiscordToken(String(req.query.code));
      const profile = await fetchDiscordProfile(token.access_token);

      req.session.user = {
        id: profile.user.id,
        username: profile.user.username,
        globalName: profile.user.global_name || profile.user.username,
        avatar: profile.user.avatar,
        avatarUrl: buildUserAvatar(profile.user),
        guilds: profile.guilds.map((g) => ({ id: g.id, name: g.name }))
      };

      delete req.session.oauthState;
      res.redirect('/');
    } catch (error) {
      logger.error('OAuth callback failed', error);
      res.status(500).send(`Login fallito: ${error.message}`);
    }
  });

  app.get('/auth/spotify/login', requireAuth, (req, res) => {
    if (!requireSpotifyEnabled(res)) return;

    const state = buildSpotifyState();
    req.session.spotifyOAuthState = state;

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.spotify.clientId,
      scope: config.spotify.scopes.join(' '),
      redirect_uri: config.spotify.redirectUri,
      state,
      show_dialog: 'false'
    });

    res.redirect(`${SPOTIFY_ACCOUNTS_API}/authorize?${params.toString()}`);
  });

  app.get('/auth/spotify/callback', requireAuth, async (req, res) => {
    if (!requireSpotifyEnabled(res)) return;

    try {
      const code = String(req.query.code || '');
      const state = String(req.query.state || '');
      if (!code || !state) throw new Error('Callback Spotify incompleto.');
      if (req.session.spotifyOAuthState !== state) throw new Error('State Spotify non valido.');

      const token = await fetchSpotifyToken({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.spotify.redirectUri
      });

      const profile = await fetchSpotifyProfile(token.access_token);
      const account = {
        spotifyUserId: profile.id,
        displayName: profile.display_name || profile.id,
        country: profile.country || null,
        avatarUrl: profile.images?.[0]?.url || null,
        accessToken: token.access_token,
        refreshToken: token.refresh_token || null,
        tokenType: token.token_type || 'Bearer',
        scope: token.scope || '',
        expiresAt: Date.now() + Number(token.expires_in || 3600) * 1000,
        linkedAt: Date.now()
      };

      await saveSpotifyAccount(req.session.user.id, account);
      delete req.session.spotifyOAuthState;
      req.session.spotifyLinked = true;
      res.redirect('/');
    } catch (error) {
      logger.error('Spotify OAuth callback failed', error);
      res.status(500).send(`Collegamento Spotify fallito: ${error.message}`);
    }
  });

  app.post('/auth/spotify/logout', requireAuth, async (req, res) => {
    try {
      await spotifyStore.remove(req.session.user.id);
      req.session.spotifyLinked = false;
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Errore disconnessione Spotify' });
    }
  });

  app.post('/auth/logout', (req, res) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  app.get('/api/me', (req, res) => {
    if (!req.session.user) {
      res.json({ authenticated: false, user: null });
      return;
    }

    res.json({ authenticated: true, user: req.session.user });
  });

  app.get('/api/spotify/status', requireAuth, async (req, res) => {
    if (!requireSpotifyEnabled(res)) return;
    try {
      const saved = spotifyStore.get(req.session.user.id);
      if (!saved) {
        res.json({ connected: false, profile: null });
        return;
      }

      const account = await ensureSpotifyAccessToken(req.session.user.id);
      res.json({
        connected: true,
        profile: {
          spotifyUserId: account.spotifyUserId,
          displayName: account.displayName,
          avatarUrl: account.avatarUrl,
          country: account.country
        }
      });
    } catch (error) {
      res.status(401).json({ connected: false, error: error.message || 'Spotify non collegato' });
    }
  });

  app.get('/api/spotify/library', requireAuth, async (req, res) => {
    if (!requireSpotifyEnabled(res)) return;

    const type = String(req.query.type || 'playlists');
    const limit = Math.max(1, Math.min(50, Number.parseInt(String(req.query.limit || '20'), 10) || 20));
    const offset = Math.max(0, Number.parseInt(String(req.query.offset || '0'), 10) || 0);

    try {
      if (type === 'playlists') {
        const data = await spotifyRequest(req.session.user.id, '/me/playlists', { limit, offset });
        const items = (data.items || []).map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description || '',
          owner: p.owner?.display_name || p.owner?.id || 'Unknown',
          tracksCount: p.tracks?.total || 0,
          image: p.images?.[0]?.url || null,
          uri: p.uri || null,
          url: p.external_urls?.spotify || (p.id ? `https://open.spotify.com/playlist/${p.id}` : null),
          type: 'playlist'
        }));
        res.json({
          type,
          items,
          total: Number(data.total || items.length),
          limit: Number(data.limit || limit),
          offset: Number(data.offset || offset)
        });
        return;
      }

      if (type === 'liked') {
        const data = await spotifyRequest(req.session.user.id, '/me/tracks', {
          market: config.spotify.market,
          limit,
          offset
        });
        const items = (data.items || [])
          .map((entry) => entry.track)
          .filter(Boolean)
          .map((t) => ({
            id: t.id,
            name: t.name,
            artists: (t.artists || []).map((a) => a.name).join(', '),
            album: t.album?.name || '',
            durationMs: t.duration_ms || 0,
            image: t.album?.images?.[0]?.url || null,
            uri: t.uri || null,
            url: t.external_urls?.spotify || (t.id ? `https://open.spotify.com/track/${t.id}` : null),
            type: 'track'
          }));

        res.json({
          type,
          items,
          total: Number(data.total || items.length),
          limit: Number(data.limit || limit),
          offset: Number(data.offset || offset)
        });
        return;
      }

      res.status(400).json({ error: 'Tipo libreria non supportato. Usa playlists o liked.' });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Errore libreria Spotify' });
    }
  });

  app.get('/api/session', requireAuth, async (req, res) => {
    try {
      const payload = await buildSessionPayload(req);
      res.json(payload);
    } catch (error) {
      res.status(500).json({ error: error.message || 'Errore sessione' });
    }
  });

  app.get('/api/search', requireAuth, async (req, res) => {
    const q = String(req.query.q || '').trim();
    const source = parseSearchSource(String(req.query.source || 'spotify').toLowerCase());
    if (!q) {
      res.json({ tracks: [] });
      return;
    }

    try {
      const tracks = await client.musicManager.searchTracks(q, { source, limit: 30 });
      res.json({ tracks, source });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Errore ricerca' });
    }
  });

  app.get('/api/discover', requireAuth, async (_req, res) => {
    try {
      const seeds = ['italian rap', 'pop 2026', 'chill mix', 'night drive', 'viral hits', 'dance playlist'];

      const sections = [];
      for (const seed of seeds) {
        const tracks = await client.musicManager.searchTracks(seed, 8);
        sections.push({ title: seed, tracks });
      }

      res.json({ sections });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Errore discover' });
    }
  });

  app.post('/api/play', requireAuth, async (req, res) => {
    const { query } = req.body || {};

    if (!query) {
      res.status(400).json({ error: 'Parametro mancante: query' });
      return;
    }

    try {
      const { session, queue } = await requireControllableSession(req);

      const result = await client.musicManager.enqueueQuery({
        guildId: session.guildId,
        voiceChannelId: queue.voiceChannelId,
        textChannelId: queue.textChannelId,
        query,
        requestedBy: req.session.user.id
      });

      const payload = await buildSessionPayload(req);
      res.json({ ok: true, result, ...payload });
    } catch (error) {
      res.status(403).json({ error: error.message || 'Errore play' });
    }
  });

  app.post('/api/control', requireAuth, async (req, res) => {
    const { action, value } = req.body || {};
    if (!action) {
      res.status(400).json({ error: 'Parametro mancante: action' });
      return;
    }

    try {
      const { session } = await requireControllableSession(req);
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
        if (!mode) throw new Error('Loop mode non valido');
        await client.musicManager.setLoop(guildId, mode);
      } else {
        throw new Error('Azione non supportata');
      }

      const payload = await buildSessionPayload(req);
      res.json({ ok: true, ...payload });
    } catch (error) {
      res.status(403).json({ error: error.message || 'Errore control' });
    }
  });

  app.get('/api/lyrics', requireAuth, async (req, res) => {
    try {
      const { queue } = await requireSessionQueue(req);
      const lyrics = await fetchSyncedLyrics(queue.current);

      if (!lyrics.syncedLyrics && !lyrics.plainLyrics) {
        throw new Error('Lyrics non disponibili per questo brano.');
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
      res.status(404).json({ error: error.message || 'Lyrics non disponibili' });
    }
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
