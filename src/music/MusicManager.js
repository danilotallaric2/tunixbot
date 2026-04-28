const { Shoukaku, Connectors } = require('shoukaku');
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

class MusicManager {
  constructor(client) {
    this.client = client;
    this.queues = new Map();
    this.spotify = new SpotifyService(config.spotify);

    this.shoukaku = new Shoukaku(
      new Connectors.DiscordJS(client),
      config.lavalink.nodes,
      {
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

  attachShoukakuEvents() {
    this.shoukaku.on('ready', (name) => logger.info(`Lavalink node ready: ${name}`));
    this.shoukaku.on('error', (name, error) => logger.error(`Lavalink node error (${name})`, error));
    this.shoukaku.on('close', (name, code, reason) => {
      logger.warn(`Lavalink node closed (${name}) code=${code} reason=${String(reason)}`);
    });
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

  getPlayerPosition(queue) {
    if (!queue.current) return 0;

    const duration = queue.current.duration || 0;
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
      requestedBy
    };
  }

  async searchLavalink(node, query) {
    const result = await node.rest.resolve(query);
    const normalized = this.normalizeLoadResult(result);
    return normalized;
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
    const identifier = isDirectUrl ? query : `ytmsearch:${query}`;
    const result = await this.searchLavalink(node, identifier);
    const mappedTracks = result.tracks.map((t) => this.buildTrack(t, requestedBy));

    // For plain text queries, queue only the first match.
    // Full lists are kept for explicit playlist/album URLs.
    const tracks = isDirectUrl ? mappedTracks : mappedTracks.slice(0, 1);

    return {
      tracks,
      playlistName: result.playlistName,
      sourceKind: result.playlistName ? 'playlist' : 'track',
      requestedCount: tracks.length,
      skippedCount: 0
    };
  }

  async createQueue(interaction, voiceChannel) {
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
      autoDisconnectMs: config.music.autoDisconnectMs
    });

    this.attachPlayerEvents(queue);
    this.queues.set(interaction.guildId, queue);

    return queue;
  }

  async createQueueByIds({ guildId, voiceChannelId, textChannelId }) {
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
      autoDisconnectMs: config.music.autoDisconnectMs
    });

    this.attachPlayerEvents(queue);
    this.queues.set(guildId, queue);

    return queue;
  }

  attachPlayerEvents(queue) {
    queue.player.on('start', async () => {
      this.resetPositionClock(queue, 0);
      queue.paused = false;
      await this.postNowPlaying(queue);
    });

    queue.player.on('end', async (event) => {
      await this.onTrackEnd(queue, event?.reason);
    });

    queue.player.on('exception', async (event) => {
      logger.error(`Track exception in guild ${queue.guildId}: ${event?.exception?.message || 'Unknown error'}`);
      await this.safeTextSend(queue.textChannelId, {
        embeds: [errorEmbed('Errore Traccia', 'Il brano corrente ha generato un errore. Passo al prossimo...')]
      });
      await this.onTrackEnd(queue, 'loadFailed');
    });

    queue.player.on('stuck', async () => {
      await this.safeTextSend(queue.textChannelId, {
        embeds: [errorEmbed('Traccia Bloccata', 'La traccia si e bloccata. Passo al prossimo brano...')]
      });
      await this.onTrackEnd(queue, 'loadFailed');
    });
  }

  async onTrackEnd(queue, reason = 'finished') {
    if (!this.queues.has(queue.guildId)) return;

    if (reason === 'replaced') return;

    const finishedTrack = queue.current;

    if (reason === 'finished' && finishedTrack) {
      if (queue.loopMode === 'song') {
        queue.tracks.unshift(finishedTrack);
      } else if (queue.loopMode === 'queue') {
        queue.tracks.push(finishedTrack);
      }
    }

    queue.current = null;
    queue.paused = false;
    queue.positionOffsetMs = 0;
    queue.startedAt = 0;
    await this.playNext(queue);
  }

  async playNext(queue) {
    queue.clearDisconnectTimer();

    const next = queue.tracks.shift();

    if (!next) {
      queue.current = null;
      await this.markNowPlayingAsEnded(queue, 'La coda e terminata.');
      return;
    }

    queue.current = next;
    queue.currentSessionId += 1;

    try {
      await queue.player.playTrack({
        track: {
          encoded: next.encoded
        }
      });
    } catch (error) {
      logger.error('Failed to play track.', error);
      queue.current = null;
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

      await this.safeTextSend(checkQueue.textChannelId, {
        embeds: [baseEmbed('Auto Disconnect', config.theme.warning).setDescription('Sono rimasto da solo nel canale vocale per 10 secondi. Mi disconnetto ora.')]
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

    if (oldState.channelId !== queue.voiceChannelId && newState.channelId !== queue.voiceChannelId) {
      return;
    }

    const channel = oldState.guild.channels.cache.get(queue.voiceChannelId) || (await oldState.guild.channels.fetch(queue.voiceChannelId).catch(() => null));
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

  async enqueueQuery({ guildId, query, voiceChannelId, textChannelId, requestedBy }) {
    const existing = this.getQueue(guildId);
    const queue = existing || (await this.createQueueByIds({ guildId, voiceChannelId, textChannelId }));

    if (existing && existing.voiceChannelId !== voiceChannelId) {
      throw new Error('Sono gia attivo in un altro canale vocale.');
    }

    queue.textChannelId = textChannelId;

    const node = queue.player.node || this.shoukaku.getIdealNode();
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
    const result = await this.enqueueQuery({
      guildId: interaction.guildId,
      query,
      voiceChannelId: voiceChannel.id,
      textChannelId: interaction.channelId,
      requestedBy: interaction.user.id
    });

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    if (result.sourceKind === 'playlist' || result.addedCount > 1) {
      const skippedSuffix = result.skippedCount > 0 ? `\nSaltati (non trovati): **${result.skippedCount}**` : '';
      await interaction.editReply({
        embeds: [
          playlistLoadedEmbed(result.playlistName, result.addedCount).setDescription(
            `Aggiunti **${result.addedCount}** brani${result.playlistName ? ` dalla playlist **${result.playlistName}**` : ''}.${skippedSuffix}`
          )
        ]
      });
    } else if (!result.willStartImmediately) {
      const single = result.firstTrack;
      const embed = baseEmbed('Brano In Coda', config.theme.success).setDescription(`Aggiunto **${single.title}**`);
      if (single.thumbnail) embed.setThumbnail(single.thumbnail);

      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.deleteReply().catch(() => null);
    }
  }

  async join(interaction, voiceChannel) {
    const existing = this.getQueue(interaction.guildId);
    if (existing) {
      if (existing.voiceChannelId !== voiceChannel.id) {
        throw new Error('Sono gia collegato a un altro canale vocale.');
      }
      existing.textChannelId = interaction.channelId;
      existing.joinedByUserId = interaction.user.id;
      existing.joinedAt = Date.now();
      return { created: false, voiceChannelId: existing.voiceChannelId };
    }

    const queue = await this.createQueue(interaction, voiceChannel);
    queue.joinedByUserId = interaction.user.id;
    queue.joinedAt = Date.now();
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

    queue.tracks = [];
    const hadCurrent = Boolean(queue.current);
    queue.current = null;
    queue.paused = false;
    queue.positionOffsetMs = 0;
    queue.startedAt = 0;
    queue.clearNowPlayingTimer();

    if (hadCurrent) {
      await queue.player.stopTrack().catch(() => null);
    }

    await this.markNowPlayingAsEnded(queue, 'Riproduzione fermata. Il bot resta nel canale vocale.');

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

  getQueueEmbed(guildId, page = 0) {
    const queue = this.getQueue(guildId);
    if (!queue) return queueEmbed([], page, 10, null);
    return queueEmbed(queue.tracks, page, 10, queue.current);
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

    const payload = {
      embeds: [
        nowPlayingEmbed(queue.current, {
          volume: queue.volume,
          loop: queue.loopMode,
          paused: queue.paused,
          position: this.getPlayerPosition(queue)
        })
      ],
      components: [nowPlayingControls({ paused: queue.paused, loop: queue.loopMode }), volumeControls()]
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

    await message
      .edit({
        embeds: [
          nowPlayingEmbed(queue.current, {
            volume: queue.volume,
            loop: queue.loopMode,
            paused: queue.paused,
            position: this.getPlayerPosition(queue)
          })
        ],
        components: [nowPlayingControls({ paused: queue.paused, loop: queue.loopMode }), volumeControls()]
      })
      .catch(() => null);
  }

  async markNowPlayingAsEnded(queue, description = 'La sessione e terminata.') {
    queue.clearNowPlayingTimer();

    if (!queue.nowPlayingMessageId) return;

    const channel = await this.client.channels.fetch(queue.textChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const message = await channel.messages.fetch(queue.nowPlayingMessageId).catch(() => null);
    if (!message) {
      queue.nowPlayingMessageId = null;
      return;
    }

    await message
      .edit({
        embeds: [baseEmbed('Riproduzione Terminata', config.theme.warning).setDescription(description)],
        components: []
      })
      .catch(() => null);
  }

  async getLyrics(guildId) {
    const queue = this.getQueue(guildId);
    if (!queue || !queue.current) throw new Error('Nessun brano in riproduzione.');

    const artist = encodeURIComponent(queue.current.author.split(',')[0].trim());
    const title = encodeURIComponent(queue.current.title);

    const response = await fetch(`https://api.lyrics.ovh/v1/${artist}/${title}`);
    if (!response.ok) throw new Error('Testo non trovato.');

    const data = await response.json();
    if (!data.lyrics) throw new Error('Testo non trovato.');

    const trimmed = data.lyrics.length > 3900 ? `${data.lyrics.slice(0, 3900)}\n...` : data.lyrics;

    return baseEmbed('Lyrics', config.theme.secondary)
      .setDescription(`**${queue.current.title}** - ${queue.current.author}\n\n${trimmed}`);
  }

  async handleButton(interaction) {
    if (!interaction.customId.startsWith('tunixbot:')) return;

    const action = interaction.customId.split(':')[1];
    const queue = this.getQueue(interaction.guildId);

    if (!queue) {
      await interaction.reply({ embeds: [errorEmbed('Sessione Non Trovata', 'Nessuna sessione musicale attiva.')], ephemeral: true });
      return;
    }

    const sameChannel = interaction.member.voice?.channelId === queue.voiceChannelId;
    if (!sameChannel) {
      await interaction.reply({
        embeds: [errorEmbed('Canale Non Valido', 'Devi essere nello stesso canale vocale del bot per usare i pulsanti.')],
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
          embeds: [baseEmbed('Riproduzione Fermata', config.theme.warning).setDescription('Coda svuotata. Il bot resta nel canale vocale.')],
          components: []
        });
        await this.stop(interaction.guildId);
        return;
      } else if (action === 'queue') {
        await interaction.reply({ embeds: [this.getQueueEmbed(interaction.guildId)], ephemeral: true });
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
          embeds: [nowPlayingEmbed(now.track, now.state)],
          components: [nowPlayingControls({ paused: now.state.paused, loop: now.state.loop }), volumeControls()]
        });
      } else {
        await interaction.update({
          embeds: [baseEmbed('Riproduzione Terminata', config.theme.warning).setDescription('La sessione e terminata.')],
          components: []
        });
      }
    } catch (error) {
      await interaction.reply({
        embeds: [errorEmbed('Errore Pulsante', error.message || 'Operazione non riuscita.')],
        ephemeral: true
      });
    }
  }

  buildVolumeEmbed(volume) {
    return volumeEmbed(volume);
  }

  buildFilterEmbed(filter) {
    return filtersEmbed(filter);
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

    const node = this.shoukaku.getIdealNode();
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
