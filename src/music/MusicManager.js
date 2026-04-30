const { Shoukaku, Connectors } = require('shoukaku');
const { inspect } = require('util');
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

  getPlayerPosition(queue) {
    if (!queue.current) return 0;

    const duration = queue.current.duration || 0;
    const playerPosition = Number(queue.player?.position);
    if (Number.isFinite(playerPosition) && playerPosition >= 0) {
      return duration > 0 ? Math.min(playerPosition, duration) : playerPosition;
    }

    const base = Math.max(0, queue.positionOffsetMs || 0);
    const elapsed = queue.paused ? 0 : Math.max(0, Date.now() - (queue.startedAt || Date.now()));
    const computed = base + elapsed;

    if (duration > 0) return Math.min(computed, duration);
    return computed;
  }

  resetPositionClock(queue, initialMs = 0) {
    queue.positionOffsetMs = Math.max(0, initialMs);
    queue.startedAt = Date.now();
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

  buildTrackKey(track) {
    const title = this.normalizeCompareText(this.cleanSpotifyTitle(track?.title || ''));
    const artist = this.normalizeCompareText(String(track?.author || '').split(',')[0].trim());
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

  async findSpotifySeedTrackId(seedTrack) {
    if (!this.spotify.enabled || !this.spotify.api || !seedTrack) return null;

    const directId = this.extractSpotifyTrackId(seedTrack.url);
    if (directId) return directId;

    const cleanTitle = this.cleanSpotifyTitle(seedTrack.title || '');
    const primaryArtist = String(seedTrack.author || '').split(',')[0].trim();
    const query = [cleanTitle, primaryArtist].filter(Boolean).join(' ').trim();
    if (!query) return null;

    try {
      const result = await this.spotify.api.searchTracks(query, {
        market: config.spotify.market,
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
      `ytmsearch:${rawTitle} ${spotifyTrack.author}`,
      `ytsearch:${rawTitle} ${spotifyTrack.author}`,
      `ytmsearch:${cleanTitle} ${primaryArtist}`,
      `ytsearch:${cleanTitle} ${primaryArtist}`,
      `ytmsearch:${cleanTitle}`,
      `ytsearch:${cleanTitle}`
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

  buildGenericFallbackQueries(track) {
    const primaryArtist = String(track.author || '').split(',')[0].trim();
    const cleanTitle = this.cleanSpotifyTitle(track.title);
    const rawTitle = String(track.title || '').trim();

    const queries = [
      `ytmsearch:${rawTitle} ${track.author || ''}`,
      `ytsearch:${rawTitle} ${track.author || ''}`,
      `ytmsearch:${cleanTitle} ${primaryArtist}`,
      `ytsearch:${cleanTitle} ${primaryArtist}`,
      `ytmsearch:${cleanTitle}`,
      `ytsearch:${cleanTitle}`
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

  buildFallbackSignature(rawTrack) {
    const info = rawTrack?.info || {};
    return `${rawTrack?.encoded || ''}|${info.uri || ''}|${info.identifier || ''}`;
  }

  async resolveFallbackForTrack(node, failedTrack) {
    const queries = this.buildGenericFallbackQueries(failedTrack);
    if (!queries.length) return null;

    const pseudoSpotifyTrack = {
      title: failedTrack.title,
      author: failedTrack.author,
      duration: failedTrack.duration
    };
    const triedSet = new Set(failedTrack.triedFallbackSignatures || []);
    triedSet.add(`${failedTrack.encoded || ''}|${failedTrack.url || ''}|`);

    let bestRaw = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const query of queries) {
      const result = await this.searchLavalink(node, query);
      const candidates = result.tracks.slice(0, 6);
      if (!candidates.length) continue;

      for (const raw of candidates) {
        const signature = this.buildFallbackSignature(raw);
        if (triedSet.has(signature)) continue;

        const score = this.scoreSpotifyCandidate(raw, pseudoSpotifyTrack);
        if (score > bestScore) {
          bestScore = score;
          bestRaw = raw;
        }
      }

      if (bestScore >= 85) break;
    }

    // Too low score usually means wrong song; better skip than play random.
    if (!bestRaw || bestScore < 42) return null;

    const signature = this.buildFallbackSignature(bestRaw);
    const triedFallbackSignatures = [...triedSet, signature];

    return this.buildTrack(bestRaw, failedTrack.requestedBy, {
      title: failedTrack.title,
      author: failedTrack.author,
      duration: failedTrack.duration,
      url: failedTrack.url,
      thumbnail: failedTrack.thumbnail,
      recoveryAttempts: Number(failedTrack.recoveryAttempts || 0) + 1,
      triedFallbackSignatures
    });
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

  async fetchSpotifyAutoplayCandidates(seedTrack, limit = 25) {
    if (!this.spotify.enabled || !this.spotify.api) return [];

    const seedTrackId = await this.findSpotifySeedTrackId(seedTrack);
    const collected = [];
    const seenUrls = new Set();

    const pushSpotifyTrack = (rawTrack) => {
      if (!rawTrack) return;
      const mapped = this.spotify.mapTrack(rawTrack);
      const url = mapped.url || '';
      if (url && seenUrls.has(url)) return;
      if (url) seenUrls.add(url);
      collected.push(mapped);
    };

    if (seedTrackId) {
      try {
        const recommendations = await this.spotify.api.getRecommendations({
          market: config.spotify.market,
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
      [primaryArtist, 'best hits'].filter(Boolean).join(' '),
      [cleanTitle, primaryArtist].filter(Boolean).join(' '),
      primaryArtist
    ].filter(Boolean);

    for (const query of queries) {
      if (collected.length >= limit) break;
      try {
        const result = await this.spotify.api.searchTracks(query, {
          market: config.spotify.market,
          limit: Math.min(15, limit)
        });
        for (const track of result.body?.tracks?.items || []) pushSpotifyTrack(track);
      } catch (error) {
        logger.warn(`Spotify fallback search failed (${query}): ${error.message || error}`);
      }
    }

    return collected;
  }

  async resolveAutoplayTrack(node, seedTrack, requestedBy, queue) {
    const excludedKeys = this.collectAutoplayExcludeKeys(queue, seedTrack);
    const spotifyCandidates = await this.fetchSpotifyAutoplayCandidates(seedTrack, 30);
    if (!spotifyCandidates.length) return null;

    const filtered = spotifyCandidates.filter((track) => {
      const key = this.buildTrackKey(track);
      return key && !excludedKeys.has(key);
    });
    if (!filtered.length) return null;

    const shuffled = filtered
      .map((track) => ({ track, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map((entry) => entry.track);

    const maxAttempts = Math.min(14, shuffled.length);
    for (let i = 0; i < maxAttempts; i += 1) {
      const candidate = shuffled[i];
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

    let autoTrack = null;
    try {
      autoTrack = await this.resolveAutoplayTrack(node, seedTrack, seedTrack.requestedBy, queue);
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

  async tryRecoverFailedTrack(queue, failedTrack) {
    const attempts = Number(failedTrack?.recoveryAttempts || 0);
    if (!failedTrack || attempts >= 2) return false;

    const node = queue.player.node || this.getIdealNodeSafe();
    if (!node) return false;

    let replacement;
    try {
      replacement = await this.resolveFallbackForTrack(node, failedTrack);
    } catch (error) {
      logger.warn(`Fallback resolve failed for guild ${queue.guildId}: ${error.message || error}`);
      return false;
    }

    if (!replacement) return false;

    queue.current = replacement;
    queue.currentSessionId += 1;
    queue.currentStarted = false;
    this.resetPositionClock(queue, 0);
    queue.paused = false;
    const locale = this.resolveQueueLocale(queue);

    await this.safeTextSend(queue.textChannelId, {
      embeds: [
        baseEmbed(t(locale, 'embeds.trackRecoverTitle'), config.theme.warning).setDescription(
          t(locale, 'embeds.trackRecoverFallbackMessage', { title: failedTrack.title })
        )
      ]
    });

    try {
      await queue.player.playTrack({
        track: {
          encoded: replacement.encoded
        }
      });
      this.armTrackStartTimeout(queue, queue.currentSessionId);
      return true;
    } catch (error) {
      logger.warn(`Fallback play failed for guild ${queue.guildId}: ${error.message || error}`);
      return false;
    }
  }

  async resolvePlayableTracks(node, query, requestedBy) {
    if (SpotifyService.isSpotifyUrl(query)) {
      const resolved = await this.spotify.resolve(query);
      const mapped = [];
      const batchSize = 6;
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

    const ytm = await this.searchLavalink(node, `ytmsearch:${query}`);
    let candidates = ytm.tracks;
    if (!candidates.length) {
      const yt = await this.searchLavalink(node, `ytsearch:${query}`);
      candidates = yt.tracks;
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

  async createQueue(interaction, voiceChannel, locale = 'en') {
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
      locale
    });

    this.attachPlayerEvents(queue);
    this.queues.set(interaction.guildId, queue);

    return queue;
  }

  async createQueueByIds({ guildId, voiceChannelId, textChannelId, locale = 'en' }) {
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
      locale
    });

    this.attachPlayerEvents(queue);
    this.queues.set(guildId, queue);

    return queue;
  }

  attachPlayerEvents(queue) {
    queue.player.on('start', async () => {
      queue.currentStarted = true;
      queue.clearTrackStartTimeout();
      this.resetPositionClock(queue, 0);
      queue.paused = false;
      await this.postNowPlaying(queue);
    });

    queue.player.on('end', async (event) => {
      queue.clearTrackStartTimeout();
      await this.onTrackEnd(queue, event?.reason);
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
    });

    queue.player.on('stuck', async (event) => {
      queue.clearTrackStartTimeout();
      this.logTrackFailureContext(queue, 'stuck', event, queue.current);
      const locale = this.resolveQueueLocale(queue);
      await this.safeTextSend(queue.textChannelId, {
        embeds: [errorEmbed(t(locale, 'embeds.trackStuckTitle'), t(locale, 'embeds.trackStuckMessage'), locale)]
      });
      await this.onTrackEnd(queue, 'loadFailed');
    });
  }

  armTrackStartTimeout(queue, expectedSessionId) {
    queue.clearTrackStartTimeout();
    queue.trackStartTimeout = setTimeout(async () => {
      const latest = this.queues.get(queue.guildId);
      if (!latest) return;
      if (!latest.current || latest.currentSessionId !== expectedSessionId) return;
      if (latest.currentStarted) return;
      const locale = this.resolveQueueLocale(latest);

      await this.safeTextSend(latest.textChannelId, {
        embeds: [
          baseEmbed(t(locale, 'embeds.trackRecoverTitle'), config.theme.warning).setDescription(
            t(locale, 'embeds.trackRecoverTimeoutMessage', { title: latest.current.title })
          )
        ]
      });

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

    if (reason === 'loadFailed' && finishedTrack) {
      const recovered = await this.tryRecoverFailedTrack(queue, finishedTrack);
      if (recovered) return;
      logger.warn(`Track recovery failed for guild ${queue.guildId}: ${finishedTrack.title} - ${finishedTrack.author}`);
    }

    const suspiciousInstantFinish =
      reason === 'finished' &&
      finishedTrack &&
      Number(finishedTrack.duration || 0) > 15000 &&
      playedMs > 0 &&
      playedMs < 3500;
    if (suspiciousInstantFinish) {
      const recovered = await this.tryRecoverFailedTrack(queue, finishedTrack);
      if (recovered) return;
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
    await this.playNext(queue, { lastTrack: finishedTrack, endReason: reason });
  }

  async playNext(queue, options = {}) {
    const { lastTrack = null, endReason = 'manual' } = options;
    queue.clearDisconnectTimer();

    const next = queue.tracks.shift();

    if (!next) {
      const allowAutoplay = ['finished', 'loadFailed', 'cleanup'].includes(endReason);
      if (allowAutoplay) {
        const startedAutoplay = await this.tryAutoplayWhenQueueEnds(queue, lastTrack);
        if (startedAutoplay) return this.playNext(queue, { endReason: 'autoplay' });
      }

      queue.current = null;
      await this.markNowPlayingAsEnded(queue, t(this.resolveQueueLocale(queue), 'embeds.nowPlayingEnded'));
      return;
    }

    queue.current = next;
    queue.currentSessionId += 1;
    queue.currentStarted = false;

    try {
      await queue.player.playTrack({
        track: {
          encoded: next.encoded
        }
      });
      this.armTrackStartTimeout(queue, queue.currentSessionId);
    } catch (error) {
      logger.error('Failed to play track.', error);
      queue.current = null;
      queue.currentStarted = false;
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
      queue.clearDisconnectTimer();
      queue.clearNowPlayingTimer();
      queue.clearTrackStartTimeout();
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

  async enqueueQuery({ guildId, query, voiceChannelId, textChannelId, requestedBy, locale = 'en' }) {
    this.assertLavalinkAvailable();
    const existing = this.getQueue(guildId);
    const queue =
      existing || (await this.createQueueByIds({ guildId, voiceChannelId, textChannelId, locale: normalizeLocale(locale) }));

    if (existing && existing.voiceChannelId !== voiceChannelId) {
      throw new Error('Sono gia attivo in un altro canale vocale.');
    }

    queue.textChannelId = textChannelId;
    this.setQueueLocale(queue, locale);

    const node = queue.player.node || this.getIdealNodeSafe();
    if (!node) throw new Error('Nessun nodo Lavalink disponibile.');

    const resolved = await this.resolvePlayableTracks(node, query, requestedBy);
    if (!resolved.tracks.length) {
      throw new Error('Nessun risultato trovato per la tua richiesta.');
    }

    const currentSize = queue.tracks.length + (queue.current ? 1 : 0);
    const available = config.music.maxQueueSize - currentSize;
    if (available <= 0) {
      throw new Error(`Coda piena. Limite massimo: ${config.music.maxQueueSize} brani.`);
    }

    const toAdd = resolved.tracks.slice(0, available);
    const willStartImmediately = !queue.current;
    queue.tracks.push(...toAdd);

    if (willStartImmediately) {
      await this.playNext(queue);
    }

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

  async play(interaction, query, voiceChannel) {
    const locale = getInteractionLocale(interaction);
    const result = await this.enqueueQuery({
      guildId: interaction.guildId,
      query,
      voiceChannelId: voiceChannel.id,
      textChannelId: interaction.channelId,
      requestedBy: interaction.user.id,
      locale
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
      return { created: false, voiceChannelId: existing.voiceChannelId };
    }

    const queue = await this.createQueue(interaction, voiceChannel, locale);
    queue.joinedByUserId = interaction.user.id;
    queue.joinedAt = Date.now();
    this.setQueueLocale(queue, locale);
    return { created: true, voiceChannelId: queue.voiceChannelId };
  }

  async pause(guildId) {
    const queue = this.getQueue(guildId);
    if (!queue || !queue.current) throw new Error('Nessun brano in riproduzione.');
    queue.positionOffsetMs = this.getPlayerPosition(queue);
    await queue.player.setPaused(true);
    queue.paused = true;
    return queue;
  }

  async resume(guildId) {
    const queue = this.getQueue(guildId);
    if (!queue || !queue.current) throw new Error('Nessun brano in riproduzione.');
    await queue.player.setPaused(false);
    queue.paused = false;
    queue.startedAt = Date.now();
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

    await this.markNowPlayingAsEnded(queue, t(locale, 'embeds.nowPlayingStopped'));

    const channel = await this.client.channels.fetch(queue.voiceChannelId).catch(() => null);
    if (channel && channel.isVoiceBased()) {
      const humanMembers = channel.members.filter((m) => !m.user.bot);
      if (humanMembers.size === 0) this.scheduleDisconnectIfAlone(queue);
      else queue.clearDisconnectTimer();
    }
  }

  async setVolume(guildId, value) {
    const queue = this.getQueue(guildId);
    if (!queue) throw new Error('Nessuna sessione attiva.');

    const volume = Math.max(0, Math.min(200, value));
    queue.volume = volume;
    await queue.player.setGlobalVolume(volume);
    return queue;
  }

  async setLoop(guildId, mode) {
    const queue = this.getQueue(guildId);
    if (!queue) throw new Error('Nessuna sessione attiva.');

    if (!['off', 'song', 'queue'].includes(mode)) {
      throw new Error('Modalita loop non valida. Usa: off, song, queue');
    }

    queue.loopMode = mode;
    return queue;
  }

  async shuffle(guildId) {
    const queue = this.getQueue(guildId);
    if (!queue) throw new Error('Nessuna sessione attiva.');

    for (let i = queue.tracks.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue.tracks[i], queue.tracks[j]] = [queue.tracks[j], queue.tracks[i]];
    }

    return queue;
  }

  async removeAt(guildId, index) {
    const queue = this.getQueue(guildId);
    if (!queue) throw new Error('Nessuna sessione attiva.');
    if (!Number.isInteger(index)) throw new Error('Indice non valido.');
    if (index < 1 || index > queue.tracks.length) throw new Error('Indice non valido.');

    const removed = queue.tracks.splice(index - 1, 1)[0];
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
      return picked;
    }

    await queue.player.stopTrack();
    return picked;
  }

  async clearQueue(guildId) {
    const queue = this.getQueue(guildId);
    if (!queue) throw new Error('Nessuna sessione attiva.');

    queue.tracks = [];
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

    if (source === 'spotify') {
      if (!this.spotify.enabled || !this.spotify.api) {
        throw new Error('Spotify non configurato. Imposta SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET.');
      }

      const result = await this.spotify.api.searchTracks(query, {
        limit,
        market: config.spotify.market
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

    const result = await this.searchLavalink(node, `ytmsearch:${query}`);
    return result.tracks.slice(0, limit).map((raw) => {
      const track = this.buildTrack(raw, 'dashboard');
      return {
        title: track.title,
        author: track.author,
        duration: track.duration,
        url: track.url,
        thumbnail: track.thumbnail,
        source: 'youtube'
      };
    });
  }
}

module.exports = MusicManager;
