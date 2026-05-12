const { Shoukaku, Connectors } = require('shoukaku');
const { inspect } = require('util');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');
const GuildQueue = require('./GuildQueue');
const SpotifyService = require('./spotify');
const { FILTER_PRESETS } = require('./filters');
const {
  errorEmbed,
  nowPlayingEmbed,
  queueEmbed,
  volumeEmbed,
  filtersEmbed,
  playlistLoadedEmbed,
  nowPlayingControls,
  volumeControls,
  baseEmbed
} = require('../utils/embeds');
const {
  normalizeLocale,
  getInteractionLocale,
  t,
  localizeErrorMessage
} = require('../utils/i18n');

class MusicManager {
  constructor(client) {
    this.client = client;
    this.queues = new Map();
    this.spotify = new SpotifyService(config.spotify);
    this.sessionPersistence = config.music.sessionPersistence || {};
    this.sessionStateSaveTimer = null;
    this.sessionStateSavePending = false;
    this.sessionStateSaveInFlight = false;
    this.sessionStateLastSerialized = null;
    this.restoreStarted = false;
    this.lavalinkCloseStats = {
      lastLogAt: 0,
      suppressedCount: 0,
      lastName: null,
      lastCode: null,
      lastReason: ''
    };

    this.shoukaku = new Shoukaku(
      new Connectors.DiscordJS(client),
      config.lavalink.nodes,
      {
        resume: Boolean(config.lavalink.resume),
        resumeTimeout: Math.max(10, Number(config.lavalink.resumeTimeoutSec || 120)),
        resumeByLibrary: Boolean(config.lavalink.resumeByLibrary),
        reconnectTries: config.lavalink.reconnectTries,
        reconnectInterval: Math.max(1, Math.round(config.lavalink.reconnectIntervalMs / 1000)),
        nodeResolver: (nodes) => {
          if (nodes instanceof Map) return nodes.values().next().value;
          if (Array.isArray(nodes)) return nodes[0];
          return null;
        }
      }
    );

    this.attachShoukakuEvents();
  }

  static ALONE_DISCONNECT_MS = 10000;
  static TRACK_START_TIMEOUT_MS = 12000;
  static LAVALINK_CLOSE_LOG_WINDOW_MS = 5000;
  static PLAYLIST_LOAD_ADD_INTERVAL_MS = 100;
  static PLAYLIST_RESOLVE_CONCURRENCY = 2;

  attachShoukakuEvents() {
    this.shoukaku.on('ready', (name) => {
      this.flushSuppressedCloseLogs();
      logger.info(`Lavalink node ready: ${name}`);
    });
    this.shoukaku.on('error', (name, error) => logger.error(`Lavalink node error (${name})`, error));
    this.shoukaku.on('close', (name, code, reason) => {
      const message = `Lavalink node closed (${name}) code=${code} reason=${String(reason || '')}`;
      const now = Date.now();
      const sinceLast = now - this.lavalinkCloseStats.lastLogAt;

      if (sinceLast < MusicManager.LAVALINK_CLOSE_LOG_WINDOW_MS) {
        this.lavalinkCloseStats.suppressedCount += 1;
        this.lavalinkCloseStats.lastName = name;
        this.lavalinkCloseStats.lastCode = code;
        this.lavalinkCloseStats.lastReason = String(reason || '');
        return;
      }

      this.flushSuppressedCloseLogs();
      logger.warn(message);
      this.lavalinkCloseStats.lastLogAt = now;
    });
  }

  flushSuppressedCloseLogs() {
    const count = Number(this.lavalinkCloseStats.suppressedCount || 0);
    if (!count) return;

    logger.warn(
      `Lavalink close spam ridotto: altri ${count} eventi close soppressi ` +
        `(last=${this.lavalinkCloseStats.lastName || '-'} code=${this.lavalinkCloseStats.lastCode ?? '-'} ` +
        `reason=${this.lavalinkCloseStats.lastReason || ''})`
    );

    this.lavalinkCloseStats.suppressedCount = 0;
    this.lavalinkCloseStats.lastName = null;
    this.lavalinkCloseStats.lastCode = null;
    this.lavalinkCloseStats.lastReason = '';
    this.lavalinkCloseStats.lastLogAt = Date.now();
  }

  getIdealNodeSafe() {
    try {
      return this.shoukaku.getIdealNode();
    } catch {
      return null;
    }
  }

  assertLavalinkAvailable() {
    const node = this.getIdealNodeSafe();
    if (!node) {
      throw new Error(
        'Lavalink non e connesso al momento. Spotify e YouTube non possono riprodurre audio finche il nodo non torna online.'
      );
    }
    return node;
  }

  async init() {
    try {
      await this.spotify.init();
      if (this.spotify.enabled) logger.info('Spotify API initialized.');
      else logger.warn('Spotify is disabled. Missing SPOTIFY_CLIENT_ID/SPOTIFY_CLIENT_SECRET.');
    } catch (error) {
      logger.error('Spotify initialization failed.', error);
    }
  }

  getQueue(guildId) {
    return this.queues.get(guildId);
  }

  resolveQueueLocale(queue, fallback = 'en') {
    return normalizeLocale(queue?.locale || fallback);
  }

  setQueueLocale(queue, locale) {
    if (!queue) return;
    queue.locale = normalizeLocale(locale || queue.locale || 'en');
  }

  getDefaultSpotifyMarket() {
    const configured = String(config.spotify.market || '').trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(configured)) return configured;
    return 'IT';
  }

  resolveSpotifyMarket(input = null, fallback = null) {
    const fallbackMarket = SpotifyService.normalizeMarketCode(fallback || this.getDefaultSpotifyMarket(), 'IT');
    const raw = String(input || '').trim();
    if (!raw) return fallbackMarket;

    const normalizedRaw = raw.replace(/_/g, '-');
    const directMarket = normalizedRaw.toUpperCase();
    if (/^[A-Z]{2}$/.test(directMarket)) return directMarket;

    const localeLower = normalizedRaw.toLowerCase();
    const regionMatch = localeLower.match(/^[a-z]{2,3}-([a-z]{2})$/);
    if (regionMatch) {
      return SpotifyService.normalizeMarketCode(regionMatch[1], fallbackMarket);
    }

    const language = localeLower.match(/^([a-z]{2,3})/)?.[1] || '';
    const languageToMarket = {
      it: 'IT',
      en: 'US',
      ru: 'RU',
      uk: 'UA',
      es: 'ES',
      pt: 'BR',
      fr: 'FR',
      de: 'DE',
      nl: 'NL',
      pl: 'PL',
      tr: 'TR',
      ro: 'RO',
      hu: 'HU',
      cs: 'CZ',
      sk: 'SK',
      bg: 'BG',
      el: 'GR',
      sv: 'SE',
      no: 'NO',
      da: 'DK',
      fi: 'FI',
      hr: 'HR',
      sr: 'RS',
      sl: 'SI',
      et: 'EE',
      lv: 'LV',
      lt: 'LT',
      id: 'ID',
      ms: 'MY',
      vi: 'VN',
      th: 'TH',
      ko: 'KR',
      ja: 'JP',
      zh: 'TW',
      ar: 'SA',
      he: 'IL',
      hi: 'IN'
    };

    return languageToMarket[language] || fallbackMarket;
  }

  getPlayerPosition(queue) {
    if (!queue.current) return 0;

    const now = Date.now();
    const duration = queue.current.duration || 0;
    const base = Math.max(0, queue.positionOffsetMs || 0);
    const elapsed = queue.paused ? 0 : Math.max(0, now - (queue.startedAt || now));
    let computed = base + elapsed;
    if (duration > 0) computed = Math.min(computed, duration);

    // Hard gate: before the real Lavalink `start` event, keep position stable.
    // This prevents dashboard/lyrics from running ahead while the track is still buffering/loading.
    if (!queue.currentStarted) {
      return duration > 0 ? Math.min(base, duration) : base;
    }

    const playerPosition = Number(queue.player?.position);
    if (Number.isFinite(playerPosition) && playerPosition >= 0) {
      const safePlayer = duration > 0 ? Math.min(playerPosition, duration) : playerPosition;
      if (queue.lastNodePositionMs !== safePlayer) {
        queue.lastNodePositionMs = safePlayer;
        queue.lastNodePositionChangedAt = now;
      }

      if (queue.paused) {
        // While paused keep position stable and never move backward due stale node samples.
        computed = Math.max(base, safePlayer);
      } else {
        // Keep timer in sync with Lavalink when divergence is clearly real.
        const nodeAheadMs = safePlayer - computed;
        const localAheadMs = computed - safePlayer;
        const nodeSampleFresh = now - Number(queue.lastNodePositionChangedAt || 0) <= 1600;

        if (nodeAheadMs > 900) {
          this.resetPositionClock(queue, safePlayer);
          computed = safePlayer;
        } else if (nodeSampleFresh && localAheadMs > 1200) {
          this.resetPositionClock(queue, safePlayer);
          computed = safePlayer;
        }
      }
    }

    return computed;
  }

  resetPositionClock(queue, initialMs = 0) {
    queue.positionOffsetMs = Math.max(0, initialMs);
    queue.startedAt = Date.now();
  }

  isSessionPersistenceEnabled() {
    return Boolean(this.sessionPersistence?.enabled && this.sessionPersistence?.filePath);
  }

  getSessionPersistenceFilePath() {
    return String(this.sessionPersistence?.filePath || '').trim();
  }

  serializeTrackForState(track) {
    if (!track || typeof track !== 'object') return null;
    if (!track.encoded || typeof track.encoded !== 'string') return null;

    return {
      encoded: track.encoded,
      title: String(track.title || 'Unknown Title'),
      author: String(track.author || 'Unknown Author'),
      duration: Math.max(0, Number(track.duration || 0)),
      url: track.url || null,
      thumbnail: track.thumbnail || null,
      requestedBy: track.requestedBy || null,
      recoveryAttempts: Math.max(0, Number(track.recoveryAttempts || 0)),
      triedFallbackSignatures: Array.isArray(track.triedFallbackSignatures) ? track.triedFallbackSignatures : []
    };
  }

  deserializeTrackFromState(trackData) {
    if (!trackData || typeof trackData !== 'object') return null;
    const encoded = typeof trackData.encoded === 'string' ? trackData.encoded : null;
    if (!encoded) return null;

    return {
      encoded,
      title: String(trackData.title || 'Unknown Title'),
      author: String(trackData.author || 'Unknown Author'),
      duration: Math.max(0, Number(trackData.duration || 0)),
      url: trackData.url || null,
      thumbnail: trackData.thumbnail || null,
      requestedBy: trackData.requestedBy || 'system',
      recoveryAttempts: Math.max(0, Number(trackData.recoveryAttempts || 0)),
      triedFallbackSignatures: Array.isArray(trackData.triedFallbackSignatures) ? trackData.triedFallbackSignatures : []
    };
  }

  buildQueueSessionState(queue) {
    if (!queue) return null;
    const current = this.serializeTrackForState(queue.current);
    const tracks = Array.isArray(queue.tracks)
      ? queue.tracks.map((track) => this.serializeTrackForState(track)).filter(Boolean)
      : [];
    const positionMs = current ? Math.max(0, Math.floor(this.getPlayerPosition(queue))) : 0;

    return {
      guildId: queue.guildId,
      voiceChannelId: queue.voiceChannelId,
      textChannelId: queue.textChannelId,
      joinedByUserId: queue.joinedByUserId || null,
      joinedAt: Number(queue.joinedAt || 0),
      locale: this.resolveQueueLocale(queue),
      spotifyMarket: this.resolveSpotifyMarket(queue.spotifyMarket || queue.locale || 'it'),
      volume: Math.max(0, Math.min(200, Number(queue.volume || config.music.defaultVolume))),
      loopMode: ['off', 'song', 'queue'].includes(queue.loopMode) ? queue.loopMode : 'off',
      filter: queue.filter || 'clear',
      paused: Boolean(queue.paused),
      positionMs,
      current,
      tracks,
      recentTrackKeys: Array.isArray(queue.recentTrackKeys) ? queue.recentTrackKeys.slice(-40) : [],
      savedAt: Date.now()
    };
  }

  buildSessionStatePayload() {
    const queues = [...this.queues.values()]
      .map((queue) => this.buildQueueSessionState(queue))
      .filter((entry) => entry && (entry.current || (Array.isArray(entry.tracks) && entry.tracks.length > 0)));

    return {
      version: 1,
      savedAt: Date.now(),
      queues
    };
  }

  scheduleSessionStateSave(delayMs = null) {
    if (!this.isSessionPersistenceEnabled()) return;
    this.sessionStateSavePending = true;

    if (this.sessionStateSaveTimer) {
      clearTimeout(this.sessionStateSaveTimer);
      this.sessionStateSaveTimer = null;
    }

    const waitMs =
      delayMs === null
        ? Math.max(200, Number(this.sessionPersistence?.saveDebounceMs || 450))
        : Math.max(0, Number(delayMs || 0));

    this.sessionStateSaveTimer = setTimeout(() => {
      this.persistSessionState().catch((error) => {
        logger.warn(`Session persistence save failed: ${error?.message || error}`);
      });
    }, waitMs);
    this.sessionStateSaveTimer.unref?.();
  }

  async persistSessionState(force = false) {
    if (!this.isSessionPersistenceEnabled()) return false;

    if (this.sessionStateSaveTimer) {
      clearTimeout(this.sessionStateSaveTimer);
      this.sessionStateSaveTimer = null;
    }

    if (this.sessionStateSaveInFlight) {
      this.sessionStateSavePending = true;
      return false;
    }

    this.sessionStateSaveInFlight = true;
    try {
      do {
        this.sessionStateSavePending = false;
        const payload = this.buildSessionStatePayload();
        const serialized = JSON.stringify(payload, null, 2);

        if (!force && serialized === this.sessionStateLastSerialized) continue;

        const filePath = this.getSessionPersistenceFilePath();
        const dir = path.dirname(filePath);
        const tmpPath = `${filePath}.tmp`;

        await fs.promises.mkdir(dir, { recursive: true });
        await fs.promises.writeFile(tmpPath, serialized, 'utf8');
        await fs.promises.rename(tmpPath, filePath);

        this.sessionStateLastSerialized = serialized;
      } while (this.sessionStateSavePending);
    } finally {
      this.sessionStateSaveInFlight = false;
    }

    return true;
  }

  async loadSessionStatePayload() {
    if (!this.isSessionPersistenceEnabled()) return null;
    const filePath = this.getSessionPersistenceFilePath();

    try {
      const raw = await fs.promises.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (!Array.isArray(parsed.queues)) return null;
      return parsed;
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      logger.warn(`Session persistence read failed: ${error?.message || error}`);
      return null;
    }
  }

  async waitForLavalinkReady(timeoutMs = 15000) {
    if (this.getIdealNodeSafe()) return true;
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      await this.sleep(350);
      if (this.getIdealNodeSafe()) return true;
    }
    return false;
  }

  isQueueStateTooOld(savedAt) {
    const maxAge = Math.max(60000, Number(this.sessionPersistence?.maxAgeMs || 1000 * 60 * 60 * 8));
    const stamp = Number(savedAt || 0);
    if (!stamp) return false;
    return Date.now() - stamp > maxAge;
  }

  async resolveValidRestoreTextChannel(guild, textChannelId) {
    const candidate =
      (textChannelId && (guild.channels.cache.get(textChannelId) || (await guild.channels.fetch(textChannelId).catch(() => null)))) ||
      null;
    if (candidate && candidate.isTextBased()) return candidate.id;

    const fallback = guild.channels.cache.find((ch) => ch?.isTextBased?.() && ch?.viewable);
    if (fallback) return fallback.id;

    if (guild.systemChannelId) {
      const system = guild.channels.cache.get(guild.systemChannelId) || (await guild.channels.fetch(guild.systemChannelId).catch(() => null));
      if (system && system.isTextBased()) return system.id;
    }

    return null;
  }

  async restoreSingleQueueFromState(queueState) {
    const guildId = String(queueState?.guildId || '').trim();
    const voiceChannelId = String(queueState?.voiceChannelId || '').trim();
    if (!guildId || !voiceChannelId) return { ok: false, reason: 'missing_ids' };

    if (this.getQueue(guildId)) return { ok: true, reason: 'already_restored' };

    const guild = this.client.guilds.cache.get(guildId) || (await this.client.guilds.fetch(guildId).catch(() => null));
    if (!guild) return { ok: false, reason: 'guild_unavailable' };

    const me = guild.members.me || (await guild.members.fetchMe().catch(() => null));
    if (!me) return { ok: false, reason: 'bot_member_unavailable' };

    const voiceChannel =
      guild.channels.cache.get(voiceChannelId) || (await guild.channels.fetch(voiceChannelId).catch(() => null));
    if (!voiceChannel || !voiceChannel.isVoiceBased()) return { ok: false, reason: 'voice_missing' };

    const perms = voiceChannel.permissionsFor(me);
    if (!perms?.has(['ViewChannel', 'Connect', 'Speak'])) return { ok: false, reason: 'missing_permissions' };

    const textChannelId = await this.resolveValidRestoreTextChannel(guild, queueState?.textChannelId || null);
    if (!textChannelId) return { ok: false, reason: 'text_missing' };

    let queue;
    try {
      queue = await this.createQueueByIds({
        guildId,
        voiceChannelId: voiceChannel.id,
        textChannelId,
        locale: normalizeLocale(queueState?.locale || 'en'),
        spotifyMarket: this.resolveSpotifyMarket(queueState?.spotifyMarket || queueState?.locale || 'it')
      });
    } catch (error) {
      return { ok: false, reason: `join_failed:${error?.message || error}` };
    }

    queue.joinedByUserId = queueState?.joinedByUserId || null;
    queue.joinedAt = Number(queueState?.joinedAt || 0);
    queue.loopMode = ['off', 'song', 'queue'].includes(queueState?.loopMode) ? queueState.loopMode : 'off';
    queue.filter = queueState?.filter || 'clear';
    queue.volume = Math.max(0, Math.min(200, Number(queueState?.volume || config.music.defaultVolume)));
    queue.recentTrackKeys = Array.isArray(queueState?.recentTrackKeys) ? queueState.recentTrackKeys.slice(-40) : [];
    this.setQueueLocale(queue, queueState?.locale || 'en');
    queue.spotifyMarket = this.resolveSpotifyMarket(queueState?.spotifyMarket || queueState?.locale || 'it');

    await queue.player.setGlobalVolume(queue.volume).catch(() => null);
    if (queue.filter && queue.filter !== 'clear' && FILTER_PRESETS[queue.filter]) {
      await queue.player.setFilters(FILTER_PRESETS[queue.filter]).catch(() => null);
    }

    const restoredCurrent = this.deserializeTrackFromState(queueState?.current);
    const restoredTracks = Array.isArray(queueState?.tracks)
      ? queueState.tracks.map((track) => this.deserializeTrackFromState(track)).filter(Boolean)
      : [];

    queue.tracks = restoredTracks;

    if (!restoredCurrent) {
      if (queue.tracks.length > 0) {
        await this.playNext(queue).catch(() => null);
      }
      return { ok: true, reason: 'restored_queue_only', guildId };
    }

    queue.current = restoredCurrent;
    queue.currentSessionId += 1;
    queue.currentStarted = false;
    queue.clearDisconnectTimer();

    const targetPosition = Math.max(0, Number(queueState?.positionMs || 0));
    const maxDuration = Number(restoredCurrent.duration || 0);
    const safePosition = maxDuration > 0 ? Math.min(targetPosition, maxDuration) : targetPosition;
    const shouldStartPaused = Boolean(queueState?.paused);

    try {
      await queue.player.playTrack({
        track: { encoded: restoredCurrent.encoded },
        position: safePosition,
        paused: shouldStartPaused
      });
      this.resetPositionClock(queue, safePosition);
      queue.paused = shouldStartPaused;
      this.armTrackStartTimeout(queue, queue.currentSessionId);
    } catch (error) {
      logger.warn(`Failed to restore playing track for guild ${guildId}: ${error?.message || error}`);
      queue.current = null;
      queue.currentStarted = false;
      if (queue.tracks.length > 0) {
        await this.playNext(queue).catch(() => null);
      }
    }

    return { ok: true, reason: 'restored_playing', guildId };
  }

  async restoreSessionsFromDisk() {
    if (!this.isSessionPersistenceEnabled()) return { restored: 0, skipped: 0, attempted: 0 };
    if (!this.sessionPersistence?.restoreOnStart) return { restored: 0, skipped: 0, attempted: 0 };
    if (this.restoreStarted) return { restored: 0, skipped: 0, attempted: 0 };
    this.restoreStarted = true;

    const nodeReady = await this.waitForLavalinkReady(20000);
    if (!nodeReady) {
      logger.warn('Skipping queue restore: Lavalink not ready in time.');
      return { restored: 0, skipped: 0, attempted: 0 };
    }

    const payload = await this.loadSessionStatePayload();
    const entries = Array.isArray(payload?.queues) ? payload.queues : [];
    if (!entries.length) return { restored: 0, skipped: 0, attempted: 0 };

    let restored = 0;
    let skipped = 0;
    let attempted = 0;

    for (const queueState of entries) {
      attempted += 1;
      if (this.isQueueStateTooOld(queueState?.savedAt)) {
        skipped += 1;
        continue;
      }

      try {
        const result = await this.restoreSingleQueueFromState(queueState);
        if (result?.ok) restored += 1;
        else skipped += 1;
      } catch (error) {
        skipped += 1;
        logger.warn(`Queue restore failed: ${error?.message || error}`);
      }
    }

    this.scheduleSessionStateSave(1500);
    logger.info(`Queue restore completed: restored=${restored} skipped=${skipped} attempted=${attempted}`);
    return { restored, skipped, attempted };
  }

  async shutdown() {
    try {
      await this.persistSessionState(true);
    } catch (error) {
      logger.warn(`Session persistence flush on shutdown failed: ${error?.message || error}`);
    }
  }

  isUrl(value) {
    return /^https?:\/\//i.test(value);
  }

  normalizeLoadResult(result) {
    if (!result) return { tracks: [], playlistName: null };

    if (result.loadType === 'track') {
      return { tracks: [result.data], playlistName: null };
    }

    if (result.loadType === 'search') {
      return { tracks: Array.isArray(result.data) ? result.data : [], playlistName: null };
    }

    if (result.loadType === 'playlist') {
      return {
        tracks: Array.isArray(result.data?.tracks) ? result.data.tracks : [],
        playlistName: result.data?.info?.name || null
      };
    }

    if (Array.isArray(result.tracks)) {
      return {
        tracks: result.tracks,
        playlistName: result.playlistInfo?.name || null
      };
    }

    return { tracks: [], playlistName: null };
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
  }

  sanitizeVoiceChannelStatus(value) {
    if (value === null) return null;
    const text = String(value || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) return '';
    return text.slice(0, 120);
  }

  formatTrackVoiceChannelStatus(track) {
    if (!track) return null;
    const title = this.sanitizeVoiceChannelStatus(track.title || '');
    if (!title) return null;
    return `🎵 ${title}`;
  }

  async setVoiceChannelStatus(queue, statusText) {
    if (!queue?.voiceChannelId) return false;
    const normalized = this.sanitizeVoiceChannelStatus(statusText);
    const cacheKey = `${queue.voiceChannelId}:${normalized === null ? '__CLEARED__' : normalized}`;
    if (queue.lastVoiceChannelStatus === cacheKey) return true;

    const body = normalized === null ? { status: null } : { status: normalized };

    try {
      await this.client.rest.put(`/channels/${queue.voiceChannelId}/voice-status`, { body });
      queue.lastVoiceChannelStatus = cacheKey;
      return true;
    } catch (error) {
      const code = Number(error?.code || 0);
      const status = Number(error?.status || 0);
      const ignorable = code === 50013 || code === 50001 || status === 403 || status === 404;

      if (!ignorable) {
        logger.warn(
          `Voice status update failed (guild=${queue.guildId} channel=${queue.voiceChannelId}): ${error?.message || error}`
        );
      }
      return false;
    }
  }

  async clearVoiceChannelStatus(queue) {
    const cleared = await this.setVoiceChannelStatus(queue, null);
    if (cleared) return true;
    return this.setVoiceChannelStatus(queue, '');
  }

  isPlaylistLoadRunning(queue) {
    return Boolean(queue?.playlistLoadJob?.active);
  }

  buildPlaylistLoadSnapshot(job) {
    if (!job) return null;
    const total = Math.max(0, Number(job.total || 0));
    const processedRaw = Math.max(0, Number(job.processed || 0));
    const processed = total > 0 ? Math.min(processedRaw, total) : processedRaw;
    const added = Math.max(0, Number(job.added || 0));
    const skipped = Math.max(0, Number(job.skipped || 0));
    const progress = total > 0 ? Math.max(0, Math.min(1, processed / total)) : 0;

    return {
      id: String(job.id || ''),
      active: Boolean(job.active),
      status: String(job.status || 'running'),
      sourceKind: String(job.sourceKind || 'playlist'),
      playlistName: job.playlistName || null,
      total,
      processed,
      added,
      skipped,
      requestedCount: Math.max(0, Number(job.requestedCount || total || 0)),
      progress,
      cancelRequested: Boolean(job.cancelRequested),
      startedAt: Number(job.startedAt || 0),
      updatedAt: Number(job.updatedAt || 0),
      finishedAt: Number(job.finishedAt || 0),
      message: job.message || null,
      error: job.error || null
    };
  }

  getPlaylistLoadSnapshot(guildId) {
    const queue = this.getQueue(guildId);
    if (!queue?.playlistLoadJob) return null;
    return this.buildPlaylistLoadSnapshot(queue.playlistLoadJob);
  }

  createPlaylistLoadJob(queue, initial = {}) {
    queue.clearPlaylistLoadCleanupTimer?.();
    const now = Date.now();
    const job = {
      id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      active: true,
      status: String(initial.status || 'running'),
      sourceKind: String(initial.sourceKind || 'playlist'),
      playlistName: initial.playlistName || null,
      total: Math.max(0, Number(initial.total || 0)),
      processed: Math.max(0, Number(initial.processed || 0)),
      added: Math.max(0, Number(initial.added || 0)),
      skipped: Math.max(0, Number(initial.skipped || 0)),
      requestedCount: Math.max(0, Number(initial.requestedCount || initial.total || 0)),
      cancelRequested: false,
      startedAt: now,
      updatedAt: now,
      finishedAt: 0,
      message: initial.message || null,
      error: null
    };

    queue.playlistLoadJob = job;
    return job;
  }

  updatePlaylistLoadJob(job, patch = {}) {
    if (!job) return;
    Object.assign(job, patch);
    job.updatedAt = Date.now();
    this.scheduleSessionStateSave();
  }

  finalizePlaylistLoadJob(queue, job, status, patch = {}) {
    if (!queue || !job) return;
    if (queue.playlistLoadJob !== job) return;

    const finishedAt = Date.now();
    Object.assign(job, patch, {
      active: false,
      status,
      finishedAt,
      updatedAt: finishedAt
    });

    queue.clearPlaylistLoadCleanupTimer?.();
    queue.playlistLoadCleanupTimer = setTimeout(() => {
      const live = queue.playlistLoadJob;
      if (!live || live.id !== job.id) return;
      if (live.active) return;
      queue.playlistLoadJob = null;
      this.scheduleSessionStateSave();
    }, 5000);
    queue.playlistLoadCleanupTimer.unref?.();
    this.scheduleSessionStateSave();
  }

  async cancelPlaylistLoad(guildId, options = {}) {
    const queue = this.getQueue(guildId);
    if (!queue) {
      if (options.silent) return null;
      throw new Error('Nessuna sessione attiva.');
    }

    const job = queue.playlistLoadJob;
    if (!job || !job.active) {
      if (options.silent) return null;
      throw new Error('Nessun caricamento playlist attivo.');
    }

    this.updatePlaylistLoadJob(job, {
      cancelRequested: true,
      status: 'cancelling',
      message: 'Cancellation requested'
    });

    return this.buildPlaylistLoadSnapshot(job);
  }

  getQueueCurrentSize(queue) {
    return queue.tracks.length + (queue.current ? 1 : 0);
  }

  async queuePlaylistTrackWithProgress(queue, job, track) {
    if (!queue || !job) return false;
    if (!this.queues.has(queue.guildId)) return false;
    if (queue.playlistLoadJob !== job) return false;

    const maxSize = Math.max(1, Number(config.music.maxQueueSize || 500));
    const currentSize = this.getQueueCurrentSize(queue);
    if (currentSize >= maxSize) return false;

    queue.tracks.push(track);
    if (!queue.current) {
      await this.playNext(queue);
    }
    this.scheduleSessionStateSave();

    return true;
  }

  async runMappedPlaylistLoad(queue, job, tracks) {
    const total = Math.max(0, Number(tracks?.length || 0));
    this.updatePlaylistLoadJob(job, {
      total,
      requestedCount: total,
      status: 'running'
    });

    if (!total) {
      this.finalizePlaylistLoadJob(queue, job, 'failed', {
        error: 'Nessun brano trovato nella playlist.'
      });
      return;
    }

    for (let i = 0; i < tracks.length; i += 1) {
      if (!this.queues.has(queue.guildId) || queue.playlistLoadJob !== job) return;
      if (job.cancelRequested) {
        this.finalizePlaylistLoadJob(queue, job, 'cancelled');
        return;
      }

      const track = tracks[i];
      let added = false;
      if (track) {
        try {
          added = await this.queuePlaylistTrackWithProgress(queue, job, track);
        } catch (error) {
          logger.warn(`Playlist queue push failed (${queue.guildId}): ${error.message || error}`);
        }
      }

      if (!added && !track) {
        job.skipped += 1;
      } else if (!added) {
        const remaining = total - job.processed;
        job.skipped += Math.max(1, remaining);
        job.processed = total;
        this.updatePlaylistLoadJob(job, {
          message: `Queue limit reached (${config.music.maxQueueSize})`
        });
        this.finalizePlaylistLoadJob(queue, job, 'completed');
        return;
      } else {
        job.added += 1;
      }

      job.processed += 1;
      job.updatedAt = Date.now();

      if (i < tracks.length - 1) {
        await this.sleep(MusicManager.PLAYLIST_LOAD_ADD_INTERVAL_MS);
      }
    }

    if (!this.queues.has(queue.guildId) || queue.playlistLoadJob !== job) return;
    if (job.cancelRequested) {
      this.finalizePlaylistLoadJob(queue, job, 'cancelled');
      return;
    }

    this.finalizePlaylistLoadJob(queue, job, 'completed');
  }

  async startSpotifyPlaylistLoad(queue, job, query, requestedBy, spotifyMarket) {
    const node = queue.player.node || this.getIdealNodeSafe();
    if (!node) {
      this.finalizePlaylistLoadJob(queue, job, 'failed', {
        error: 'Nessun nodo Lavalink disponibile.'
      });
      return;
    }

    let resolved;
    try {
      resolved = await this.spotify.resolve(query, { market: spotifyMarket });
    } catch (error) {
      this.finalizePlaylistLoadJob(queue, job, 'failed', {
        error: error.message || String(error)
      });
      return;
    }

    const spotifyTracks = Array.isArray(resolved?.tracks) ? resolved.tracks : [];
    this.updatePlaylistLoadJob(job, {
      status: 'running',
      sourceKind: resolved?.kind || 'playlist',
      playlistName: resolved?.name || null,
      total: spotifyTracks.length,
      requestedCount: spotifyTracks.length
    });

    if (!spotifyTracks.length) {
      this.finalizePlaylistLoadJob(queue, job, 'failed', {
        error: 'Nessun brano trovato nella playlist.'
      });
      return;
    }

    const concurrency = Math.max(1, Number(MusicManager.PLAYLIST_RESOLVE_CONCURRENCY || 1));
    for (let batchStart = 0; batchStart < spotifyTracks.length; batchStart += concurrency) {
      if (!this.queues.has(queue.guildId) || queue.playlistLoadJob !== job) return;
      if (job.cancelRequested) {
        this.finalizePlaylistLoadJob(queue, job, 'cancelled');
        return;
      }

      const batch = spotifyTracks.slice(batchStart, batchStart + concurrency);
      const batchResolved = await Promise.all(
        batch.map(async (spotifyTrack) => {
          try {
            return await this.resolveSingleSpotifyTrack(node, spotifyTrack, requestedBy);
          } catch (error) {
            logger.warn(`Spotify track resolve failed (${queue.guildId}): ${error.message || error}`);
            return null;
          }
        })
      );

      for (let i = 0; i < batchResolved.length; i += 1) {
        if (!this.queues.has(queue.guildId) || queue.playlistLoadJob !== job) return;
        if (job.cancelRequested) {
          this.finalizePlaylistLoadJob(queue, job, 'cancelled');
          return;
        }

        const absoluteIndex = batchStart + i;
        const resolvedTrack = batchResolved[i];
        let added = false;
        if (resolvedTrack) {
          try {
            added = await this.queuePlaylistTrackWithProgress(queue, job, resolvedTrack);
          } catch (error) {
            logger.warn(`Spotify playlist queue push failed (${queue.guildId}): ${error.message || error}`);
          }
        }

        if (!added && !resolvedTrack) {
          job.skipped += 1;
        } else if (!added) {
          const remaining = spotifyTracks.length - job.processed;
          job.skipped += Math.max(1, remaining);
          job.processed = spotifyTracks.length;
          this.updatePlaylistLoadJob(job, {
            message: `Queue limit reached (${config.music.maxQueueSize})`
          });
          this.finalizePlaylistLoadJob(queue, job, 'completed');
          return;
        } else {
          job.added += 1;
        }

        job.processed += 1;
        job.updatedAt = Date.now();

        // Keep queue growth smooth for UX, but only delay when a track is actually added.
        if (added && absoluteIndex < spotifyTracks.length - 1) {
          await this.sleep(MusicManager.PLAYLIST_LOAD_ADD_INTERVAL_MS);
        }
      }
    }

    if (!this.queues.has(queue.guildId) || queue.playlistLoadJob !== job) return;
    if (job.cancelRequested) {
      this.finalizePlaylistLoadJob(queue, job, 'cancelled');
      return;
    }

    this.finalizePlaylistLoadJob(queue, job, 'completed');
  }

  async startSpotifyTrackListLoad(queue, job, spotifyTracks, requestedBy) {
    const node = queue.player.node || this.getIdealNodeSafe();
    if (!node) {
      this.finalizePlaylistLoadJob(queue, job, 'failed', {
        error: 'Nessun nodo Lavalink disponibile.'
      });
      return;
    }

    if (!Array.isArray(spotifyTracks) || !spotifyTracks.length) {
      this.finalizePlaylistLoadJob(queue, job, 'failed', {
        error: 'Nessun brano trovato nella playlist.'
      });
      return;
    }

    const concurrency = Math.max(1, Number(MusicManager.PLAYLIST_RESOLVE_CONCURRENCY || 1));
    for (let batchStart = 0; batchStart < spotifyTracks.length; batchStart += concurrency) {
      if (!this.queues.has(queue.guildId) || queue.playlistLoadJob !== job) return;
      if (job.cancelRequested) {
        this.finalizePlaylistLoadJob(queue, job, 'cancelled');
        return;
      }

      const batch = spotifyTracks.slice(batchStart, batchStart + concurrency);
      const batchResolved = await Promise.all(
        batch.map(async (spotifyTrack) => {
          try {
            return await this.resolveSingleSpotifyTrack(node, spotifyTrack, requestedBy);
          } catch (error) {
            logger.warn(`Spotify track-list resolve failed (${queue.guildId}): ${error.message || error}`);
            return null;
          }
        })
      );

      for (let i = 0; i < batchResolved.length; i += 1) {
        if (!this.queues.has(queue.guildId) || queue.playlistLoadJob !== job) return;
        if (job.cancelRequested) {
          this.finalizePlaylistLoadJob(queue, job, 'cancelled');
          return;
        }

        const absoluteIndex = batchStart + i;
        const resolvedTrack = batchResolved[i];
        let added = false;
        if (resolvedTrack) {
          try {
            added = await this.queuePlaylistTrackWithProgress(queue, job, resolvedTrack);
          } catch (error) {
            logger.warn(`Spotify track-list queue push failed (${queue.guildId}): ${error.message || error}`);
          }
        }

        if (!added && !resolvedTrack) {
          job.skipped += 1;
        } else if (!added) {
          const remaining = spotifyTracks.length - job.processed;
          job.skipped += Math.max(1, remaining);
          job.processed = spotifyTracks.length;
          this.updatePlaylistLoadJob(job, {
            message: `Queue limit reached (${config.music.maxQueueSize})`
          });
          this.finalizePlaylistLoadJob(queue, job, 'completed');
          return;
        } else {
          job.added += 1;
        }

        job.processed += 1;
        job.updatedAt = Date.now();

        if (added && absoluteIndex < spotifyTracks.length - 1) {
          await this.sleep(MusicManager.PLAYLIST_LOAD_ADD_INTERVAL_MS);
        }
      }
    }

    if (!this.queues.has(queue.guildId) || queue.playlistLoadJob !== job) return;
    if (job.cancelRequested) {
      this.finalizePlaylistLoadJob(queue, job, 'cancelled');
      return;
    }

    this.finalizePlaylistLoadJob(queue, job, 'completed');
  }

  buildTrack(rawTrack, requestedBy, metadata = null) {
    const info = rawTrack.info || {};

    return {
      encoded: rawTrack.encoded,
      title: metadata?.title || info.title || 'Unknown Title',
      author: metadata?.author || info.author || 'Unknown Author',
      duration: metadata?.duration || info.length || 0,
      url: metadata?.url || info.uri || null,
      thumbnail: metadata?.thumbnail || info.artworkUrl || null,
      requestedBy,
      recoveryAttempts: Number(metadata?.recoveryAttempts || 0),
      triedFallbackSignatures: Array.isArray(metadata?.triedFallbackSignatures) ? metadata.triedFallbackSignatures : []
    };
  }

  async searchLavalink(node, query) {
    const result = await node.rest.resolve(query);
    const normalized = this.normalizeLoadResult(result);
    return normalized;
  }

  logTrackFailureContext(queue, type, event = null, track = null) {
    const t = track || queue?.current || null;
    const payload = {
      type,
      guildId: queue?.guildId || null,
      voiceChannelId: queue?.voiceChannelId || null,
      textChannelId: queue?.textChannelId || null,
      currentTrack: t
        ? {
            title: t.title,
            author: t.author,
            url: t.url,
            duration: t.duration,
            recoveryAttempts: t.recoveryAttempts || 0
          }
        : null,
      event: event || null
    };

    logger.error(`Track failure context: ${type}`, inspect(payload, { depth: 5, colors: false }));
  }

  normalizeCompareText(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  cleanSpotifyTitle(title) {
    return String(title || '')
      .replace(/\((feat|ft)\.?[^)]*\)/gi, '')
      .replace(/\[(feat|ft)\.?[^\]]*\]/gi, '')
      .replace(/\((official|audio|video|lyrics?|live|remaster(ed)?|sped up|slowed)[^)]*\)/gi, '')
      .replace(/\[(official|audio|video|lyrics?|live|remaster(ed)?|sped up|slowed)[^\]]*\]/gi, '')
      .replace(/\s+-\s+(remaster(ed)?|live|radio edit|acoustic).*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  cleanPrimaryAuthor(author) {
    return String(author || '')
      .split(',')[0]
      .replace(/\s*-\s*topic$/i, '')
      .replace(/\s*vevo$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  tokenizeText(value) {
    return new Set(
      this.normalizeCompareText(value)
        .split(' ')
        .map((token) => token.trim())
        .filter((token) => token.length >= 2)
    );
  }

  titleHasLowQualityTag(title) {
    const normalized = this.normalizeCompareText(title);
    if (!normalized) return false;
    return /(slowed|sped up|nightcore|reverb|8d|bass ?boost|mashup|karaoke|instrumental|fanmade|chipmunk)/i.test(
      normalized
    );
  }

  scoreAutoplaySpotifyCandidate(candidate, seedTrack) {
    const candidateTitle = this.normalizeCompareText(this.cleanSpotifyTitle(candidate?.title || ''));
    const seedTitle = this.normalizeCompareText(this.cleanSpotifyTitle(seedTrack?.title || ''));
    const candidateArtist = this.normalizeCompareText(this.cleanPrimaryAuthor(candidate?.author || ''));
    const seedArtist = this.normalizeCompareText(this.cleanPrimaryAuthor(seedTrack?.author || ''));

    let score = 0;

    if (candidateTitle && seedTitle && candidateTitle === seedTitle) score -= 220;

    if (seedArtist && candidateArtist) {
      if (candidateArtist === seedArtist) score += 50;
      else if (candidateArtist.includes(seedArtist) || seedArtist.includes(candidateArtist)) score += 34;
    }

    const seedTitleTokens = this.tokenizeText(seedTitle);
    const candidateTitleTokens = this.tokenizeText(candidateTitle);
    if (seedTitleTokens.size && candidateTitleTokens.size) {
      let common = 0;
      for (const token of seedTitleTokens) {
        if (candidateTitleTokens.has(token)) common += 1;
      }
      const overlap = common / Math.max(1, Math.min(seedTitleTokens.size, candidateTitleTokens.size));
      score += Math.round(overlap * 22);
    }

    const seedDuration = Number(seedTrack?.duration || 0);
    const candidateDuration = Number(candidate?.duration || 0);
    if (seedDuration > 0 && candidateDuration > 0) {
      const diff = Math.abs(candidateDuration - seedDuration);
      if (diff <= 2500) score += 16;
      else if (diff <= 6000) score += 12;
      else if (diff <= 12000) score += 8;
      else if (diff <= 22000) score += 3;
      else if (diff > 60000) score -= 12;
    }

    if (this.titleHasLowQualityTag(candidate?.title || '')) score -= 40;

    const popularity = Number(candidate?.popularity);
    if (Number.isFinite(popularity) && popularity > 0) {
      score += Math.round(Math.max(0, Math.min(20, (popularity - 35) / 3.25)));
    }

    return score;
  }

  buildTrackKey(track) {
    const title = this.normalizeCompareText(this.cleanSpotifyTitle(track?.title || ''));
    const artist = this.normalizeCompareText(this.cleanPrimaryAuthor(track?.author || ''));
    if (!title) return '';
    return `${title}::${artist}`;
  }

  rememberFinishedTrack(queue, track) {
    if (!queue || !track) return;
    const key = this.buildTrackKey(track);
    if (!key) return;

    queue.recentTrackKeys = Array.isArray(queue.recentTrackKeys) ? queue.recentTrackKeys : [];
    queue.recentTrackKeys.push(key);
    if (queue.recentTrackKeys.length > 40) {
      queue.recentTrackKeys.splice(0, queue.recentTrackKeys.length - 40);
    }
  }

  extractSpotifyTrackId(urlOrUri) {
    const parsed = SpotifyService.parseSpotifyUrl(urlOrUri);
    if (!parsed || parsed.type !== 'track') return null;
    return parsed.id;
  }

  async findSpotifySeedTrackId(seedTrack, market = null) {
    if (!this.spotify.enabled || !this.spotify.api || !seedTrack) return null;
    const resolvedMarket = this.resolveSpotifyMarket(market);

    const directId = this.extractSpotifyTrackId(seedTrack.url);
    if (directId) return directId;

    const cleanTitle = this.cleanSpotifyTitle(seedTrack.title || '');
    const primaryArtist = String(seedTrack.author || '').split(',')[0].trim();
    const query = [cleanTitle, primaryArtist].filter(Boolean).join(' ').trim();
    if (!query) return null;

    try {
      const result = await this.spotify.api.searchTracks(query, {
        market: resolvedMarket,
        limit: 5
      });
      const items = result.body?.tracks?.items || [];
      if (!items.length) return null;

      const seedKey = this.buildTrackKey(seedTrack);
      for (const item of items) {
        const mapped = this.spotify.mapTrack(item);
        if (this.buildTrackKey(mapped) === seedKey) {
          return item.id || null;
        }
      }
      return items[0].id || null;
    } catch (error) {
      logger.warn(`Spotify seed lookup failed: ${error.message || error}`);
      return null;
    }
  }

  buildSpotifySearchQueries(spotifyTrack) {
    const primaryArtist = String(spotifyTrack.author || '').split(',')[0].trim();
    const cleanTitle = this.cleanSpotifyTitle(spotifyTrack.title);
    const rawTitle = String(spotifyTrack.title || '').trim();

    const queries = [
      `ytsearch:${rawTitle} ${spotifyTrack.author}`,
      `ytmsearch:${rawTitle} ${spotifyTrack.author}`,
      `ytsearch:${cleanTitle} ${primaryArtist}`,
      `ytmsearch:${cleanTitle} ${primaryArtist}`,
      `ytsearch:${cleanTitle}`,
      `ytmsearch:${cleanTitle}`
    ];

    const unique = [];
    const seen = new Set();
    for (const q of queries) {
      const key = this.normalizeCompareText(q);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push(q);
    }

    return unique;
  }

  scoreSpotifyCandidate(rawTrack, spotifyTrack) {
    const info = rawTrack.info || {};
    const candidateTitle = this.normalizeCompareText(info.title);
    const candidateAuthor = this.normalizeCompareText(info.author);
    const cleanTitle = this.normalizeCompareText(this.cleanSpotifyTitle(spotifyTrack.title));
    const primaryArtist = this.normalizeCompareText(String(spotifyTrack.author || '').split(',')[0].trim());
    const spotifyDuration = Number(spotifyTrack.duration || 0);
    const candidateDuration = Number(info.length || 0);

    let score = 0;

    if (cleanTitle && candidateTitle.includes(cleanTitle)) score += 55;
    else if (cleanTitle) {
      const titleTokens = cleanTitle.split(' ').filter(Boolean);
      const matched = titleTokens.filter((t) => candidateTitle.includes(t)).length;
      if (titleTokens.length) score += Math.floor((matched / titleTokens.length) * 40);
    }

    if (primaryArtist && candidateAuthor.includes(primaryArtist)) score += 28;

    if (spotifyDuration > 0 && candidateDuration > 0) {
      const diff = Math.abs(candidateDuration - spotifyDuration);
      if (diff <= 3000) score += 24;
      else if (diff <= 7000) score += 16;
      else if (diff <= 12000) score += 10;
      else if (diff <= 20000) score += 4;
      else score -= 15;
    }

    return score;
  }

  async resolveSingleSpotifyTrack(node, spotifyTrack, requestedBy) {
    const queries = this.buildSpotifySearchQueries(spotifyTrack);
    let bestRaw = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const query of queries) {
      const result = await this.searchLavalink(node, query);
      const candidates = result.tracks.slice(0, 5);
      if (!candidates.length) continue;

      for (const raw of candidates) {
        const score = this.scoreSpotifyCandidate(raw, spotifyTrack);
        if (score > bestScore) {
          bestScore = score;
          bestRaw = raw;
        }
      }

      if (bestScore >= 85) break;
    }

    if (!bestRaw) return null;
    return this.buildTrack(bestRaw, requestedBy, spotifyTrack);
  }

  collectAutoplayExcludeKeys(queue, seedTrack) {
    const excluded = new Set();

    const push = (track) => {
      const key = this.buildTrackKey(track);
      if (key) excluded.add(key);
    };

    push(seedTrack);
    push(queue.current);
    for (const queued of queue.tracks) push(queued);
    for (const key of queue.recentTrackKeys || []) {
      if (key) excluded.add(key);
    }

    return excluded;
  }

  async fetchSpotifyAutoplayCandidates(seedTrack, limit = 25, market = null) {
    if (!this.spotify.enabled || !this.spotify.api) return [];
    const resolvedMarket = this.resolveSpotifyMarket(market);

    const seedTrackId = await this.findSpotifySeedTrackId(seedTrack, resolvedMarket);
    const collected = [];
    const seenIds = new Set();
    const seenUrls = new Set();

    const pushSpotifyTrack = (rawTrack) => {
      if (!rawTrack) return;
      const spotifyId = String(rawTrack.id || '').trim();
      if (spotifyId && seenIds.has(spotifyId)) return;
      const mapped = this.spotify.mapTrack(rawTrack);
      const url = mapped.url || '';
      if (url && seenUrls.has(url)) return;
      if (spotifyId) seenIds.add(spotifyId);
      if (url) seenUrls.add(url);
      collected.push(mapped);
    };

    if (seedTrackId) {
      try {
        const recommendations = await this.spotify.api.getRecommendations({
          market: resolvedMarket,
          seed_tracks: [seedTrackId],
          limit
        });
        for (const track of recommendations.body?.tracks || []) pushSpotifyTrack(track);
      } catch (error) {
        logger.warn(`Spotify recommendations failed: ${error.message || error}`);
      }
    }

    if (collected.length >= 8) return collected;

    const primaryArtist = String(seedTrack?.author || '').split(',')[0].trim();
    const cleanTitle = this.cleanSpotifyTitle(seedTrack?.title || '');
    const queries = [
      [cleanTitle, primaryArtist].filter(Boolean).join(' '),
      [primaryArtist, 'official'].filter(Boolean).join(' '),
      primaryArtist
    ].filter(Boolean);

    for (const query of queries) {
      if (collected.length >= limit) break;
      try {
        const result = await this.spotify.api.searchTracks(query, {
          market: resolvedMarket,
          limit: Math.min(15, limit)
        });
        for (const track of result.body?.tracks?.items || []) pushSpotifyTrack(track);
      } catch (error) {
        logger.warn(`Spotify fallback search failed (${query}): ${error.message || error}`);
      }
    }

    return collected;
  }

  async resolveAutoplayTrack(node, seedTrack, requestedBy, queue, market = null) {
    const excludedKeys = this.collectAutoplayExcludeKeys(queue, seedTrack);
    const spotifyCandidates = await this.fetchSpotifyAutoplayCandidates(seedTrack, 30, market);
    if (!spotifyCandidates.length) return null;

    const filtered = spotifyCandidates.filter((track) => {
      const key = this.buildTrackKey(track);
      return key && !excludedKeys.has(key);
    });
    if (!filtered.length) return null;

    const ranked = filtered
      .map((track) => ({
        track,
        score: this.scoreAutoplaySpotifyCandidate(track, seedTrack)
      }))
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.track);

    const maxAttempts = Math.min(18, ranked.length);
    for (let i = 0; i < maxAttempts; i += 1) {
      const candidate = ranked[i];
      const resolved = await this.resolveSingleSpotifyTrack(node, candidate, requestedBy);
      if (!resolved) continue;

      const resolvedKey = this.buildTrackKey(resolved);
      if (!resolvedKey || excludedKeys.has(resolvedKey)) continue;
      return resolved;
    }

    return null;
  }

  async tryAutoplayWhenQueueEnds(queue, seedTrack) {
    if (!config.music.autoPlayRelatedWhenQueueEnds) return false;
    if (!seedTrack) return false;
    if (queue.loopMode !== 'off') return false;
    if (queue.tracks.length > 0 || queue.current) return false;

    const node = queue.player.node || this.getIdealNodeSafe();
    if (!node) return false;
    const market = this.resolveSpotifyMarket(queue.spotifyMarket || queue.locale || 'it');

    let autoTrack = null;
    try {
      autoTrack = await this.resolveAutoplayTrack(node, seedTrack, seedTrack.requestedBy, queue, market);
    } catch (error) {
      logger.warn(`Autoplay related lookup failed for guild ${queue.guildId}: ${error.message || error}`);
      return false;
    }
    if (!autoTrack) return false;

    queue.tracks.push(autoTrack);
    const locale = this.resolveQueueLocale(queue);

    await this.safeTextSend(queue.textChannelId, {
      embeds: [
        baseEmbed(t(locale, 'embeds.autoplayTitle'), config.theme.secondary).setDescription(
          t(locale, 'embeds.autoplayMessage', { title: autoTrack.title, author: autoTrack.author })
        )
      ]
    });

    return true;
  }

  async resolvePlayableTracks(node, query, requestedBy, options = {}) {
    const resolvedMarket = this.resolveSpotifyMarket(options.spotifyMarket || options.locale);
    const source = ['spotify', 'youtube_music', 'youtube'].includes(options.source) ? options.source : 'spotify';

    if (SpotifyService.isSpotifyUrl(query)) {
      const resolved = await this.spotify.resolve(query, { market: resolvedMarket });
      const mapped = [];
      const batchSize = Math.max(1, Number(MusicManager.PLAYLIST_RESOLVE_CONCURRENCY || 1));
      const requestedCount = resolved.tracks.length;

      for (let i = 0; i < resolved.tracks.length; i += batchSize) {
        const chunk = resolved.tracks.slice(i, i + batchSize);
        const chunkResolved = await Promise.all(
          chunk.map(async (spotifyTrack) => {
            return this.resolveSingleSpotifyTrack(node, spotifyTrack, requestedBy);
          })
        );

        for (const track of chunkResolved) {
          if (track) mapped.push(track);
        }
      }

      return {
        tracks: mapped,
        playlistName: resolved.name,
        sourceKind: resolved.kind,
        requestedCount,
        skippedCount: Math.max(0, requestedCount - mapped.length)
      };
    }

    const isDirectUrl = this.isUrl(query);
    if (isDirectUrl) {
      const result = await this.searchLavalink(node, query);
      const mappedTracks = result.tracks.map((t) => this.buildTrack(t, requestedBy));

      return {
        tracks: mappedTracks,
        playlistName: result.playlistName,
        sourceKind: result.playlistName ? 'playlist' : 'track',
        requestedCount: mappedTracks.length,
        skippedCount: 0
      };
    }

    let candidates = [];

    if (source === 'spotify') {
      if (!this.spotify.enabled || !this.spotify.api) {
        throw new Error('Spotify non configurato. Imposta SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET.');
      }

      const result = await this.spotify.api.searchTracks(query, {
        limit: 1,
        market: resolvedMarket
      });
      const spotifyTrack = result.body?.tracks?.items?.[0] ? this.spotify.mapTrack(result.body.tracks.items[0]) : null;
      const resolvedTrack = spotifyTrack ? await this.resolveSingleSpotifyTrack(node, spotifyTrack, requestedBy) : null;
      return {
        tracks: resolvedTrack ? [resolvedTrack] : [],
        playlistName: null,
        sourceKind: 'track',
        requestedCount: resolvedTrack ? 1 : 0,
        skippedCount: resolvedTrack ? 0 : 1
      };
    } else {
      const primaryPrefix = source === 'youtube_music' ? 'ytmsearch' : 'ytsearch';
      const fallbackPrefix = source === 'youtube_music' ? 'ytsearch' : 'ytmsearch';
      const primary = await this.searchLavalink(node, `${primaryPrefix}:${query}`);
      candidates = primary.tracks;

      if (!candidates.length) {
        const fallback = await this.searchLavalink(node, `${fallbackPrefix}:${query}`);
        candidates = fallback.tracks;
      }
    }

    const mappedTracks = candidates.map((t) => this.buildTrack(t, requestedBy));
    const tracks = mappedTracks.slice(0, 1);

    return {
      tracks,
      playlistName: null,
      sourceKind: 'track',
      requestedCount: tracks.length,
      skippedCount: 0
    };
  }

  async createQueue(interaction, voiceChannel, locale = 'en', spotifyMarket = null) {
    this.assertLavalinkAvailable();
    const shardId = Number.isInteger(interaction.guild.shardId) ? interaction.guild.shardId : 0;

    const player = await this.shoukaku.joinVoiceChannel({
      guildId: interaction.guildId,
      channelId: voiceChannel.id,
      shardId,
      deaf: true
    });

    await player.setGlobalVolume(config.music.defaultVolume);

    const queue = new GuildQueue({
      guildId: interaction.guildId,
      textChannelId: interaction.channelId,
      voiceChannelId: voiceChannel.id,
      player,
      defaultVolume: config.music.defaultVolume,
      autoDisconnectMs: config.music.autoDisconnectMs,
      locale,
      spotifyMarket: this.resolveSpotifyMarket(spotifyMarket || interaction?.locale || interaction?.guildLocale || locale)
    });

    this.attachPlayerEvents(queue);
    this.queues.set(interaction.guildId, queue);
    this.scheduleSessionStateSave();

    return queue;
  }

  async createQueueByIds({ guildId, voiceChannelId, textChannelId, locale = 'en', spotifyMarket = null }) {
    this.assertLavalinkAvailable();
    const guild = this.client.guilds.cache.get(guildId) || (await this.client.guilds.fetch(guildId).catch(() => null));
    if (!guild) throw new Error('Guild non trovata.');

    const shardId = Number.isInteger(guild.shardId) ? guild.shardId : 0;

    const player = await this.shoukaku.joinVoiceChannel({
      guildId,
      channelId: voiceChannelId,
      shardId,
      deaf: true
    });

    await player.setGlobalVolume(config.music.defaultVolume);

    const queue = new GuildQueue({
      guildId,
      textChannelId,
      voiceChannelId,
      player,
      defaultVolume: config.music.defaultVolume,
      autoDisconnectMs: config.music.autoDisconnectMs,
      locale,
      spotifyMarket: this.resolveSpotifyMarket(spotifyMarket || locale)
    });

    this.attachPlayerEvents(queue);
    this.queues.set(guildId, queue);
    this.scheduleSessionStateSave();

    return queue;
  }

  attachPlayerEvents(queue) {
    queue.player.on('start', async () => {
      queue.currentStarted = true;
      queue.clearTrackStartTimeout();
      this.resetPositionClock(queue, 0);
      queue.paused = false;
      await this.setVoiceChannelStatus(queue, this.formatTrackVoiceChannelStatus(queue.current));

      // Prefetch synced lyrics server-side as soon as playback starts,
      // so dashboard /api/lyrics is usually hot from cache.
      const prefetchLyrics = this.client?.prefetchDashboardLyrics;
      if (typeof prefetchLyrics === 'function' && queue.current) {
        Promise.resolve(prefetchLyrics(queue.current)).catch(() => {});
      }

      await this.postNowPlaying(queue);
      this.scheduleSessionStateSave();
    });

    queue.player.on('end', async (event) => {
      queue.clearTrackStartTimeout();
      await this.onTrackEnd(queue, event?.reason);
      this.scheduleSessionStateSave();
    });

    queue.player.on('exception', async (event) => {
      queue.clearTrackStartTimeout();
      logger.error(`Track exception in guild ${queue.guildId}: ${event?.exception?.message || 'Unknown error'}`);
      this.logTrackFailureContext(queue, 'exception', event, queue.current);
      const locale = this.resolveQueueLocale(queue);
      await this.safeTextSend(queue.textChannelId, {
        embeds: [errorEmbed(t(locale, 'embeds.trackErrorTitle'), t(locale, 'embeds.trackErrorMessage'), locale)]
      });
      await this.onTrackEnd(queue, 'loadFailed');
      this.scheduleSessionStateSave();
    });

    queue.player.on('stuck', async (event) => {
      queue.clearTrackStartTimeout();
      this.logTrackFailureContext(queue, 'stuck', event, queue.current);
      const locale = this.resolveQueueLocale(queue);
      await this.safeTextSend(queue.textChannelId, {
        embeds: [errorEmbed(t(locale, 'embeds.trackStuckTitle'), t(locale, 'embeds.trackStuckMessage'), locale)]
      });
      await this.onTrackEnd(queue, 'loadFailed');
      this.scheduleSessionStateSave();
    });
  }

  armTrackStartTimeout(queue, expectedSessionId) {
    queue.clearTrackStartTimeout();
    queue.trackStartTimeout = setTimeout(async () => {
      const latest = this.queues.get(queue.guildId);
      if (!latest) return;
      if (!latest.current || latest.currentSessionId !== expectedSessionId) return;
      if (latest.currentStarted) return;

      logger.warn(
        `Track start timeout in guild ${latest.guildId}. Skipping to next track: ${latest.current?.title || 'Unknown Title'}`
      );

      await this.onTrackEnd(latest, 'loadFailed');
    }, MusicManager.TRACK_START_TIMEOUT_MS);

    queue.trackStartTimeout.unref?.();
  }

  async onTrackEnd(queue, reason = 'finished') {
    if (!this.queues.has(queue.guildId)) return;

    if (reason === 'replaced') return;

    const finishedTrack = queue.current;
    const playedMs = this.getPlayerPosition(queue);

    if (reason !== 'finished') {
      this.logTrackFailureContext(queue, `track_end:${reason}`, { reason, playedMs }, finishedTrack);
    }

    if (reason === 'finished' && finishedTrack) {
      if (queue.loopMode === 'song') {
        queue.tracks.unshift(finishedTrack);
      } else if (queue.loopMode === 'queue') {
        queue.tracks.push(finishedTrack);
      }
    }

    if (finishedTrack) {
      this.rememberFinishedTrack(queue, finishedTrack);
    }

    queue.current = null;
    queue.currentStarted = false;
    queue.paused = false;
    queue.positionOffsetMs = 0;
    queue.startedAt = 0;
    queue.lastNodePositionMs = null;
    queue.lastNodePositionChangedAt = 0;
    await this.playNext(queue, { lastTrack: finishedTrack, endReason: reason });
    this.scheduleSessionStateSave();
  }

  async playNext(queue, options = {}) {
    const { lastTrack = null, endReason = 'manual' } = options;
    queue.clearDisconnectTimer();

    const next = queue.tracks.shift();

    if (!next) {
      const allowAutoplay = ['finished', 'loadFailed', 'cleanup', 'stopped'].includes(endReason);
      if (allowAutoplay) {
        const startedAutoplay = await this.tryAutoplayWhenQueueEnds(queue, lastTrack);
        if (startedAutoplay) return this.playNext(queue, { endReason: 'autoplay' });
      }

      queue.current = null;
      await this.clearVoiceChannelStatus(queue);
      await this.markNowPlayingAsEnded(queue, t(this.resolveQueueLocale(queue), 'embeds.nowPlayingEnded'));
      this.scheduleSessionStateSave();
      return;
    }

    queue.current = next;
    queue.currentSessionId += 1;
    queue.currentStarted = false;
    queue.positionOffsetMs = 0;
    queue.startedAt = 0;
    queue.lastNodePositionMs = null;
    queue.lastNodePositionChangedAt = 0;

    try {
      await queue.player.playTrack({
        track: {
          encoded: next.encoded
        }
      });
      this.armTrackStartTimeout(queue, queue.currentSessionId);
      this.scheduleSessionStateSave();
    } catch (error) {
      logger.error('Failed to play track.', error);
      queue.current = null;
      queue.currentStarted = false;
      this.scheduleSessionStateSave();
      await this.playNext(queue);
    }
  }

  scheduleDisconnectIfAlone(queue) {
    queue.clearDisconnectTimer();

    queue.disconnectTimer = setTimeout(async () => {
      const checkQueue = this.queues.get(queue.guildId);
      if (!checkQueue) return;

      const channel = await this.client.channels.fetch(checkQueue.voiceChannelId).catch(() => null);
      if (!channel || !channel.isVoiceBased()) return;

      const humanMembers = channel.members.filter((m) => !m.user.bot);
      if (humanMembers.size > 0) return;
      const locale = this.resolveQueueLocale(checkQueue);

      await this.safeTextSend(checkQueue.textChannelId, {
        embeds: [
          baseEmbed(t(locale, 'embeds.voiceAutoDisconnectTitle'), config.theme.warning).setDescription(
            t(locale, 'embeds.voiceAutoDisconnectMessage')
          )
        ]
      });

      await this.destroyQueue(checkQueue.guildId);
    }, MusicManager.ALONE_DISCONNECT_MS);

    queue.disconnectTimer.unref?.();
  }

  async handleVoiceStateUpdate(oldState, newState) {
    const guildId = oldState.guild?.id || newState.guild?.id;
    if (!guildId) return;

    const queue = this.getQueue(guildId);
    if (!queue) return;

    const botUserId = this.client.user?.id;
    const stateUserId = oldState.id || newState.id;
    const isBotStateChange = Boolean(botUserId && stateUserId === botUserId);

    if (isBotStateChange) {
      const trackedChannelId = queue.voiceChannelId;
      const movedFromTracked = oldState.channelId === trackedChannelId && newState.channelId && newState.channelId !== trackedChannelId;
      const disconnectedFromTracked = oldState.channelId === trackedChannelId && !newState.channelId;

      if (movedFromTracked) {
        queue.voiceChannelId = newState.channelId;
        queue.clearDisconnectTimer();
        await this.setVoiceChannelStatus(queue, this.formatTrackVoiceChannelStatus(queue.current));
        this.scheduleSessionStateSave();
      } else if (disconnectedFromTracked) {
        const locale = this.resolveQueueLocale(queue);
        await this.safeTextSend(queue.textChannelId, {
          embeds: [
            baseEmbed(t(locale, 'embeds.sessionClosedTitle'), config.theme.warning).setDescription(
              t(locale, 'embeds.sessionClosedMessage')
            )
          ]
        });
        await this.destroyQueue(queue.guildId);
        return;
      }
    }

    if (oldState.channelId !== queue.voiceChannelId && newState.channelId !== queue.voiceChannelId) {
      return;
    }

    const guild = oldState.guild || newState.guild;
    const channel = guild.channels.cache.get(queue.voiceChannelId) || (await guild.channels.fetch(queue.voiceChannelId).catch(() => null));
    if (!channel || !channel.isVoiceBased()) return;

    const humanMembers = channel.members.filter((m) => !m.user.bot);
    if (humanMembers.size === 0) {
      this.scheduleDisconnectIfAlone(queue);
    } else {
      queue.clearDisconnectTimer();
    }
  }

  async destroyQueue(guildId, options = {}) {
    const { deleteNowPlayingMessage = true } = options;
    const queue = this.queues.get(guildId);
    if (!queue) return;

    try {
      await this.cancelPlaylistLoad(guildId, { silent: true });
      queue.clearDisconnectTimer();
      queue.clearNowPlayingTimer();
      queue.clearTrackStartTimeout();
      queue.clearPlaylistLoadCleanupTimer?.();
      await this.clearVoiceChannelStatus(queue);
      if (deleteNowPlayingMessage && queue.nowPlayingMessageId) {
        const channel = await this.client.channels.fetch(queue.textChannelId).catch(() => null);
        if (channel && channel.isTextBased()) {
          const oldMessage = await channel.messages.fetch(queue.nowPlayingMessageId).catch(() => null);
          if (oldMessage) await oldMessage.delete().catch(() => null);
        }
      }
      await queue.player.destroy();
    } catch {
      // fallback below
    }

    try {
      await this.shoukaku.leaveVoiceChannel(guildId);
    } catch {
      // noop
    }

    this.queues.delete(guildId);
    this.scheduleSessionStateSave();
  }

  async safeTextSend(channelId, payload) {
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) return null;
      return await channel.send(payload);
    } catch {
      return null;
    }
  }

  async enqueueQuery({
    guildId,
    query,
    voiceChannelId,
    textChannelId,
    requestedBy,
    locale = 'en',
    userLocale = null,
    spotifyMarket = null,
    allowAsyncPlaylistLoad = false,
    source = 'spotify'
  }) {
    this.assertLavalinkAvailable();
    const resolvedSpotifyMarket = this.resolveSpotifyMarket(spotifyMarket || userLocale || locale);
    const existing = this.getQueue(guildId);
    const queue =
      existing ||
      (await this.createQueueByIds({
        guildId,
        voiceChannelId,
        textChannelId,
        locale: normalizeLocale(locale),
        spotifyMarket: resolvedSpotifyMarket
      }));

    if (existing && existing.voiceChannelId !== voiceChannelId) {
      throw new Error('Sono gia attivo in un altro canale vocale.');
    }

    queue.textChannelId = textChannelId;
    this.setQueueLocale(queue, locale);
    queue.spotifyMarket = resolvedSpotifyMarket;
    this.scheduleSessionStateSave();

    const node = queue.player.node || this.getIdealNodeSafe();
    if (!node) throw new Error('Nessun nodo Lavalink disponibile.');

    if (allowAsyncPlaylistLoad && this.isPlaylistLoadRunning(queue)) {
      throw new Error('E gia in corso un caricamento playlist. Annullalo prima di iniziarne un altro.');
    }

    const currentSize = this.getQueueCurrentSize(queue);
    const available = config.music.maxQueueSize - currentSize;
    if (available <= 0) {
      throw new Error(`Coda piena. Limite massimo: ${config.music.maxQueueSize} brani.`);
    }

    const parsedSpotify = SpotifyService.parseSpotifyUrl(query);
    if (allowAsyncPlaylistLoad && parsedSpotify && parsedSpotify.type !== 'track') {
      const job = this.createPlaylistLoadJob(queue, {
        status: 'resolving',
        sourceKind: parsedSpotify.type === 'album' ? 'album' : 'playlist',
        playlistName: null,
        total: 0,
        requestedCount: 0,
        message: 'Resolving playlist'
      });

      this.startSpotifyPlaylistLoad(queue, job, query, requestedBy, resolvedSpotifyMarket).catch((error) => {
        logger.error(`Spotify playlist load failed (${queue.guildId})`, error);
        this.finalizePlaylistLoadJob(queue, job, 'failed', {
          error: error?.message || String(error)
        });
      });

      return {
        loading: true,
        addedCount: 0,
        sourceKind: job.sourceKind,
        playlistName: job.playlistName,
        requestedCount: 0,
        skippedCount: 0,
        firstTrack: null,
        willStartImmediately: !queue.current,
        playlistLoad: this.buildPlaylistLoadSnapshot(job)
      };
    }

    let resolved = null;
    if (allowAsyncPlaylistLoad && this.isUrl(query) && !SpotifyService.isSpotifyUrl(query)) {
      const direct = await this.searchLavalink(node, query);
      const mappedTracks = direct.tracks.map((t) => this.buildTrack(t, requestedBy));
      const isPlaylist = Boolean(direct.playlistName) && mappedTracks.length > 1;

      if (isPlaylist) {
        const job = this.createPlaylistLoadJob(queue, {
          status: 'running',
          sourceKind: 'playlist',
          playlistName: direct.playlistName || null,
          total: mappedTracks.length,
          requestedCount: mappedTracks.length
        });

        this.runMappedPlaylistLoad(queue, job, mappedTracks).catch((error) => {
          logger.error(`Playlist load failed (${queue.guildId})`, error);
          this.finalizePlaylistLoadJob(queue, job, 'failed', {
            error: error?.message || String(error)
          });
        });

        return {
          loading: true,
          addedCount: 0,
          sourceKind: 'playlist',
          playlistName: direct.playlistName || null,
          requestedCount: mappedTracks.length,
          skippedCount: 0,
          firstTrack: null,
          willStartImmediately: !queue.current,
          playlistLoad: this.buildPlaylistLoadSnapshot(job)
        };
      }

      resolved = {
        tracks: mappedTracks,
        playlistName: direct.playlistName,
        sourceKind: direct.playlistName ? 'playlist' : 'track',
        requestedCount: mappedTracks.length,
        skippedCount: 0
      };
    }

    if (!resolved) {
      resolved = await this.resolvePlayableTracks(node, query, requestedBy, {
        locale,
        spotifyMarket: resolvedSpotifyMarket,
        source
      });
    }
    if (!resolved.tracks.length) {
      throw new Error('Nessun risultato trovato per la tua richiesta.');
    }

    const toAdd = resolved.tracks.slice(0, available);
    const willStartImmediately = !queue.current;
    const isSingleTrackRequest = resolved.sourceKind === 'track' && toAdd.length === 1;
    const shouldPrioritizeSingleTrack = isSingleTrackRequest && (queue.current || queue.tracks.length > 0);
    if (shouldPrioritizeSingleTrack) {
      queue.tracks.unshift(toAdd[0]);
    } else {
      queue.tracks.push(...toAdd);
    }

    if (willStartImmediately) {
      await this.playNext(queue);
    }
    this.scheduleSessionStateSave();

    return {
      addedCount: toAdd.length,
      sourceKind: resolved.sourceKind,
      playlistName: resolved.playlistName,
      requestedCount: resolved.requestedCount || toAdd.length,
      skippedCount: Math.max(0, resolved.skippedCount || 0),
      firstTrack: toAdd[0] || null,
      willStartImmediately
    };
  }

  async enqueueSpotifyTrackList({
    guildId,
    voiceChannelId,
    textChannelId,
    requestedBy,
    spotifyTracks,
    locale = 'en',
    userLocale = null,
    spotifyMarket = null,
    sourceKind = 'playlist',
    playlistName = null
  }) {
    this.assertLavalinkAvailable();
    const resolvedSpotifyMarket = this.resolveSpotifyMarket(spotifyMarket || userLocale || locale);
    const existing = this.getQueue(guildId);
    const queue =
      existing ||
      (await this.createQueueByIds({
        guildId,
        voiceChannelId,
        textChannelId,
        locale: normalizeLocale(locale),
        spotifyMarket: resolvedSpotifyMarket
      }));

    if (existing && existing.voiceChannelId !== voiceChannelId) {
      throw new Error('Sono gia attivo in un altro canale vocale.');
    }

    queue.textChannelId = textChannelId;
    this.setQueueLocale(queue, locale);
    queue.spotifyMarket = resolvedSpotifyMarket;
    this.scheduleSessionStateSave();

    if (this.isPlaylistLoadRunning(queue)) {
      throw new Error('E gia in corso un caricamento playlist. Annullalo prima di iniziarne un altro.');
    }

    const normalizedTracks = Array.isArray(spotifyTracks) ? spotifyTracks.filter((track) => track && track.title) : [];
    if (!normalizedTracks.length) throw new Error('Nessun brano trovato nella playlist.');

    const currentSize = this.getQueueCurrentSize(queue);
    const available = config.music.maxQueueSize - currentSize;
    if (available <= 0) {
      throw new Error(`Coda piena. Limite massimo: ${config.music.maxQueueSize} brani.`);
    }

    const cappedTracks = normalizedTracks.slice(0, available);
    const cappedByQueueLimit = Math.max(0, normalizedTracks.length - cappedTracks.length);
    if (!cappedTracks.length) {
      throw new Error(`Coda piena. Limite massimo: ${config.music.maxQueueSize} brani.`);
    }

    const job = this.createPlaylistLoadJob(queue, {
      status: 'running',
      sourceKind: String(sourceKind || 'playlist'),
      playlistName: playlistName || null,
      total: cappedTracks.length,
      requestedCount: normalizedTracks.length
    });

    this.startSpotifyTrackListLoad(queue, job, cappedTracks, requestedBy).catch((error) => {
      logger.error(`Spotify track-list load failed (${queue.guildId})`, error);
      this.finalizePlaylistLoadJob(queue, job, 'failed', {
        error: error?.message || String(error)
      });
    });

    return {
      loading: true,
      addedCount: 0,
      sourceKind: job.sourceKind,
      playlistName: job.playlistName,
      requestedCount: normalizedTracks.length,
      skippedCount: cappedByQueueLimit,
      firstTrack: null,
      willStartImmediately: !queue.current,
      playlistLoad: this.buildPlaylistLoadSnapshot(job)
    };
  }

  async play(interaction, query, voiceChannel, options = {}) {
    const locale = getInteractionLocale(interaction);
    const userLocale = interaction?.locale || interaction?.guildLocale || locale;
    const result = await this.enqueueQuery({
      guildId: interaction.guildId,
      query,
      voiceChannelId: voiceChannel.id,
      textChannelId: interaction.channelId,
      requestedBy: interaction.user.id,
      locale,
      userLocale,
      source: options.source || 'spotify'
    });

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    if (result.sourceKind === 'playlist' || result.addedCount > 1) {
      const skippedSuffix =
        result.skippedCount > 0
          ? locale === 'it'
            ? `\nSaltati (non trovati): **${result.skippedCount}**`
            : `\nSkipped (not found): **${result.skippedCount}**`
          : '';
      await interaction.editReply({
        embeds: [
          playlistLoadedEmbed(result.playlistName, result.addedCount, locale).setDescription(
            `${t(locale, 'embeds.playlistLoadedMessage', {
              count: result.addedCount,
              suffix:
                result.playlistName && locale === 'it'
                  ? ` dalla playlist **${result.playlistName}**`
                  : result.playlistName
                    ? ` from playlist **${result.playlistName}**`
                    : ''
            })}${skippedSuffix}`
          )
        ]
      });
    } else if (!result.willStartImmediately) {
      const single = result.firstTrack;
      const embed = baseEmbed(t(locale, 'embeds.queueTrackAddedTitle'), config.theme.success).setDescription(
        t(locale, 'embeds.queueTrackAddedMessage', { title: single.title })
      );
      if (single.thumbnail) embed.setThumbnail(single.thumbnail);

      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.deleteReply().catch(() => null);
    }
  }

  async join(interaction, voiceChannel) {
    const locale = getInteractionLocale(interaction);
    const userLocale = interaction?.locale || interaction?.guildLocale || locale;
    const spotifyMarket = this.resolveSpotifyMarket(userLocale || locale);
    this.assertLavalinkAvailable();
    const existing = this.getQueue(interaction.guildId);
    if (existing) {
      if (existing.voiceChannelId !== voiceChannel.id) {
        throw new Error('Sono gia collegato a un altro canale vocale.');
      }
      existing.textChannelId = interaction.channelId;
      existing.joinedByUserId = interaction.user.id;
      existing.joinedAt = Date.now();
      this.setQueueLocale(existing, locale);
      existing.spotifyMarket = spotifyMarket;
      this.scheduleSessionStateSave();
      return { created: false, voiceChannelId: existing.voiceChannelId };
    }

    const queue = await this.createQueue(interaction, voiceChannel, locale, spotifyMarket);
    queue.joinedByUserId = interaction.user.id;
    queue.joinedAt = Date.now();
    this.setQueueLocale(queue, locale);
    queue.spotifyMarket = spotifyMarket;
    this.scheduleSessionStateSave();
    return { created: true, voiceChannelId: queue.voiceChannelId };
  }

  async pause(guildId) {
    const queue = this.getQueue(guildId);
    if (!queue || !queue.current) throw new Error('Nessun brano in riproduzione.');
    queue.positionOffsetMs = this.getPlayerPosition(queue);
    await queue.player.setPaused(true);
    queue.paused = true;
    this.scheduleSessionStateSave();
    return queue;
  }

  async resume(guildId) {
    const queue = this.getQueue(guildId);
    if (!queue || !queue.current) throw new Error('Nessun brano in riproduzione.');
    await queue.player.setPaused(false);
    queue.paused = false;
    queue.startedAt = Date.now();
    this.scheduleSessionStateSave();
    return queue;
  }

  async skip(guildId) {
    const queue = this.getQueue(guildId);
    if (!queue || !queue.current) throw new Error('Nessun brano da skippare.');
    await queue.player.stopTrack();
    return queue;
  }

  async stop(guildId) {
    const queue = this.getQueue(guildId);
    if (!queue) throw new Error('Nessuna sessione attiva.');
    const locale = this.resolveQueueLocale(queue);
    await this.cancelPlaylistLoad(guildId, { silent: true });

    queue.tracks = [];
    const hadCurrent = Boolean(queue.current);
    queue.current = null;
    queue.currentStarted = false;
    queue.paused = false;
    queue.positionOffsetMs = 0;
    queue.startedAt = 0;
    queue.clearNowPlayingTimer();
    queue.clearTrackStartTimeout();

    if (hadCurrent) {
      await queue.player.stopTrack().catch(() => null);
    }

    await this.clearVoiceChannelStatus(queue);
    await this.markNowPlayingAsEnded(queue, t(locale, 'embeds.nowPlayingStopped'));

    const channel = await this.client.channels.fetch(queue.voiceChannelId).catch(() => null);
    if (channel && channel.isVoiceBased()) {
      const humanMembers = channel.members.filter((m) => !m.user.bot);
      if (humanMembers.size === 0) this.scheduleDisconnectIfAlone(queue);
      else queue.clearDisconnectTimer();
    }
    this.scheduleSessionStateSave();
  }

  async setVolume(guildId, value) {
    const queue = this.getQueue(guildId);
    if (!queue) throw new Error('Nessuna sessione attiva.');

    const volume = Math.max(0, Math.min(200, value));
    queue.volume = volume;
    await queue.player.setGlobalVolume(volume);
    this.scheduleSessionStateSave();
    return queue;
  }

  async setLoop(guildId, mode) {
    const queue = this.getQueue(guildId);
    if (!queue) throw new Error('Nessuna sessione attiva.');

    if (!['off', 'song', 'queue'].includes(mode)) {
      throw new Error('Modalita loop non valida. Usa: off, song, queue');
    }

    queue.loopMode = mode;
    this.scheduleSessionStateSave();
    return queue;
  }

  async shuffle(guildId) {
    const queue = this.getQueue(guildId);
    if (!queue) throw new Error('Nessuna sessione attiva.');

    for (let i = queue.tracks.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue.tracks[i], queue.tracks[j]] = [queue.tracks[j], queue.tracks[i]];
    }
    this.scheduleSessionStateSave();

    return queue;
  }

  async removeAt(guildId, index) {
    const queue = this.getQueue(guildId);
    if (!queue) throw new Error('Nessuna sessione attiva.');
    if (!Number.isInteger(index)) throw new Error('Indice non valido.');
    if (index < 1 || index > queue.tracks.length) throw new Error('Indice non valido.');

    const removed = queue.tracks.splice(index - 1, 1)[0];
    this.scheduleSessionStateSave();
    return removed;
  }

  async playFromQueueAt(guildId, index) {
    const queue = this.getQueue(guildId);
    if (!queue) throw new Error('Nessuna sessione attiva.');
    if (!Number.isInteger(index)) throw new Error('Indice non valido.');
    if (index < 1 || index > queue.tracks.length) throw new Error('Indice non valido.');

    const [picked] = queue.tracks.splice(index - 1, 1);
    if (!picked) throw new Error('Brano non trovato in coda.');

    queue.tracks.unshift(picked);

    if (!queue.current) {
      await this.playNext(queue);
      this.scheduleSessionStateSave();
      return picked;
    }

    await queue.player.stopTrack();
    this.scheduleSessionStateSave();
    return picked;
  }

  async clearQueue(guildId) {
    const queue = this.getQueue(guildId);
    if (!queue) throw new Error('Nessuna sessione attiva.');

    await this.cancelPlaylistLoad(guildId, { silent: true });
    queue.tracks = [];
    this.scheduleSessionStateSave();
    return queue;
  }

  async seek(guildId, positionMs) {
    const queue = this.getQueue(guildId);
    if (!queue || !queue.current) throw new Error('Nessun brano in riproduzione.');
    if (queue.current.duration > 0 && positionMs > queue.current.duration) {
      throw new Error('Tempo oltre la durata del brano.');
    }

    const target = Math.max(0, positionMs);
    await queue.player.seekTo(target);
    queue.positionOffsetMs = target;
    queue.startedAt = Date.now();
    this.scheduleSessionStateSave();
    return queue;
  }

  async applyFilter(guildId, filterName) {
    const queue = this.getQueue(guildId);
    if (!queue) throw new Error('Nessuna sessione attiva.');

    const preset = FILTER_PRESETS[filterName];
    if (!preset) throw new Error('Filtro non valido.');

    if (filterName === 'clear') {
      await queue.player.clearFilters();
    } else {
      await queue.player.setFilters(preset);
    }

    queue.filter = filterName;
    this.scheduleSessionStateSave();
    return queue;
  }

  getQueueEmbed(guildId, page = 0, locale = null) {
    const queue = this.getQueue(guildId);
    const resolvedLocale = normalizeLocale(locale || this.resolveQueueLocale(queue));
    if (!queue) return queueEmbed([], page, 10, null, resolvedLocale);
    return queueEmbed(queue.tracks, page, 10, queue.current, resolvedLocale);
  }

  getNowPlayingData(guildId) {
    const queue = this.getQueue(guildId);
    if (!queue || !queue.current) return null;

    return {
      queue,
      track: queue.current,
      state: {
        volume: queue.volume,
        loop: queue.loopMode,
        paused: queue.paused,
        position: this.getPlayerPosition(queue)
      }
    };
  }

  async postNowPlaying(queue) {
    if (!queue.current) return;

    const channel = await this.client.channels.fetch(queue.textChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    if (queue.nowPlayingMessageId) {
      const oldMessage = await channel.messages.fetch(queue.nowPlayingMessageId).catch(() => null);
      if (oldMessage) await oldMessage.delete().catch(() => null);
      queue.nowPlayingMessageId = null;
    }
    queue.clearNowPlayingTimer();

    const locale = this.resolveQueueLocale(queue);
    const payload = {
      embeds: [
        nowPlayingEmbed(queue.current, {
          volume: queue.volume,
          loop: queue.loopMode,
          paused: queue.paused,
          position: this.getPlayerPosition(queue)
        }, locale)
      ],
      components: [nowPlayingControls({ paused: queue.paused, loop: queue.loopMode }, locale), volumeControls(locale)]
    };

    const message = await channel.send(payload).catch(() => null);
    if (!message) return;

    queue.nowPlayingMessageId = message.id;
    this.startNowPlayingUpdater(queue);
  }

  startNowPlayingUpdater(queue) {
    queue.clearNowPlayingTimer();

    queue.nowPlayingUpdateTimer = setInterval(async () => {
      await this.updateNowPlayingMessage(queue);
    }, 5000);

    queue.nowPlayingUpdateTimer.unref?.();
  }

  async updateNowPlayingMessage(queue) {
    if (!queue.current || !queue.nowPlayingMessageId) {
      queue.clearNowPlayingTimer();
      return;
    }

    const channel = await this.client.channels.fetch(queue.textChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      queue.clearNowPlayingTimer();
      return;
    }

    const message = await channel.messages.fetch(queue.nowPlayingMessageId).catch(() => null);
    if (!message) {
      queue.nowPlayingMessageId = null;
      queue.clearNowPlayingTimer();
      return;
    }

    const locale = this.resolveQueueLocale(queue);
    await message
      .edit({
        embeds: [
          nowPlayingEmbed(queue.current, {
            volume: queue.volume,
            loop: queue.loopMode,
            paused: queue.paused,
            position: this.getPlayerPosition(queue)
          }, locale)
        ],
        components: [nowPlayingControls({ paused: queue.paused, loop: queue.loopMode }, locale), volumeControls(locale)]
      })
      .catch(() => null);
  }

  async markNowPlayingAsEnded(queue, description = null) {
    queue.clearNowPlayingTimer();

    if (!queue.nowPlayingMessageId) return;

    const channel = await this.client.channels.fetch(queue.textChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const message = await channel.messages.fetch(queue.nowPlayingMessageId).catch(() => null);
    if (!message) {
      queue.nowPlayingMessageId = null;
      return;
    }

    const locale = this.resolveQueueLocale(queue);
    const finalDescription = description || t(locale, 'embeds.sessionEndedMessage');
    await message
      .edit({
        embeds: [baseEmbed(t(locale, 'embeds.endedTitle'), config.theme.warning).setDescription(finalDescription)],
        components: []
      })
      .catch(() => null);
  }

  async getLyrics(guildId, locale = 'en') {
    const queue = this.getQueue(guildId);
    if (!queue || !queue.current) throw new Error('Nessun brano in riproduzione.');

    const artist = encodeURIComponent(queue.current.author.split(',')[0].trim());
    const title = encodeURIComponent(queue.current.title);

    const response = await fetch(`https://api.lyrics.ovh/v1/${artist}/${title}`);
    if (!response.ok) throw new Error('Testo non trovato.');

    const data = await response.json();
    if (!data.lyrics) throw new Error('Testo non trovato.');

    const trimmed = data.lyrics.length > 3900 ? `${data.lyrics.slice(0, 3900)}\n...` : data.lyrics;

    return baseEmbed(t(locale, 'embeds.lyricsTitle'), config.theme.secondary)
      .setDescription(`**${queue.current.title}** - ${queue.current.author}\n\n${trimmed}`);
  }

  async handleButton(interaction) {
    if (!interaction.customId.startsWith('tunixbot:')) return;

    const action = interaction.customId.split(':')[1];
    const queue = this.getQueue(interaction.guildId);
    const locale = getInteractionLocale(interaction);

    if (!queue) {
      await interaction.reply({
        embeds: [errorEmbed(t(locale, 'errors.sessionTitle'), t(locale, 'errors.sessionMissing'), locale)],
        ephemeral: true
      });
      return;
    }
    this.setQueueLocale(queue, locale);

    const sameChannel = interaction.member.voice?.channelId === queue.voiceChannelId;
    if (!sameChannel) {
      await interaction.reply({
        embeds: [errorEmbed(t(locale, 'errors.invalidChannelTitle'), t(locale, 'errors.invalidChannelMessage'), locale)],
        ephemeral: true
      });
      return;
    }

    try {
      if (action === 'toggle_pause') {
        if (queue.paused) await this.resume(interaction.guildId);
        else await this.pause(interaction.guildId);
      } else if (action === 'skip') {
        await this.skip(interaction.guildId);
      } else if (action === 'stop') {
        await interaction.update({
          embeds: [baseEmbed(t(locale, 'embeds.endedTitle'), config.theme.warning).setDescription(t(locale, 'embeds.nowPlayingStopped'))],
          components: []
        });
        await this.stop(interaction.guildId);
        return;
      } else if (action === 'queue') {
        await interaction.reply({ embeds: [this.getQueueEmbed(interaction.guildId, 0, locale)], ephemeral: true });
        return;
      } else if (action === 'loop') {
        const modes = ['off', 'song', 'queue'];
        const next = modes[(modes.indexOf(queue.loopMode) + 1) % modes.length];
        await this.setLoop(interaction.guildId, next);
      } else if (action === 'vol_down') {
        await this.setVolume(interaction.guildId, queue.volume - 10);
      } else if (action === 'vol_up') {
        await this.setVolume(interaction.guildId, queue.volume + 10);
      }

      const now = this.getNowPlayingData(interaction.guildId);
      if (now) {
        await interaction.update({
          embeds: [nowPlayingEmbed(now.track, now.state, locale)],
          components: [
            nowPlayingControls({ paused: now.state.paused, loop: now.state.loop }, locale),
            volumeControls(locale)
          ]
        });
      } else {
        await interaction.update({
          embeds: [baseEmbed(t(locale, 'embeds.endedTitle'), config.theme.warning).setDescription(t(locale, 'embeds.sessionEndedMessage'))],
          components: []
        });
      }
    } catch (error) {
      await interaction.reply({
        embeds: [errorEmbed(t(locale, 'errors.buttonTitle'), localizeErrorMessage(locale, error), locale)],
        ephemeral: true
      });
    }
  }

  buildVolumeEmbed(volume, locale = 'en') {
    return volumeEmbed(volume, locale);
  }

  buildFilterEmbed(filter, locale = 'en') {
    return filtersEmbed(filter, locale);
  }

  async searchTracks(query, options = {}) {
    const source = options.source || 'spotify';
    const limit = options.limit || 20;
    const market = this.resolveSpotifyMarket(options.spotifyMarket || options.locale);

    if (source === 'spotify') {
      if (!this.spotify.enabled || !this.spotify.api) {
        throw new Error('Spotify non configurato. Imposta SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET.');
      }

      const result = await this.spotify.api.searchTracks(query, {
        limit,
        market
      });

      return (result.body?.tracks?.items || []).map((track) => {
        const artists = (track.artists || []).map((a) => a.name).join(', ') || 'Unknown Artist';
        return {
          title: track.name,
          author: artists,
          duration: track.duration_ms,
          url: track.external_urls?.spotify || null,
          thumbnail: track.album?.images?.[0]?.url || null,
          source: 'spotify'
        };
      });
    }

    const node = this.getIdealNodeSafe();
    if (!node) throw new Error('Nessun nodo Lavalink disponibile.');

    const prefix = source === 'youtube_music' ? 'ytmsearch' : 'ytsearch';
    const result = await this.searchLavalink(node, `${prefix}:${query}`);
    return result.tracks.slice(0, limit).map((raw) => {
      const track = this.buildTrack(raw, 'dashboard');
      return {
        title: track.title,
        author: track.author,
        duration: track.duration,
        url: track.url,
        thumbnail: track.thumbnail,
        source: source === 'youtube_music' ? 'youtube_music' : 'youtube'
      };
    });
  }
}

module.exports = MusicManager;
