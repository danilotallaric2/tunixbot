const { normalizeLocale } = require('../utils/i18n');

class GuildQueue {
  constructor({
    guildId,
    textChannelId,
    voiceChannelId,
    player,
    defaultVolume,
    autoDisconnectMs,
    locale = 'en',
    spotifyMarket = 'IT'
  }) {
    this.guildId = guildId;
    this.textChannelId = textChannelId;
    this.voiceChannelId = voiceChannelId;
    this.player = player;

    this.current = null;
    this.tracks = [];

    this.volume = defaultVolume;
    this.loopMode = 'off';
    this.filter = 'clear';

    this.paused = false;
    this.nowPlayingMessageId = null;
    this.startedAt = 0;
    this.positionOffsetMs = 0;
    this.currentSessionId = 0;
    this.currentStarted = false;
    this.trackStartTimeout = null;
    this.nowPlayingUpdateTimer = null;
    this.recentTrackKeys = [];
    this.joinedByUserId = null;
    this.joinedAt = 0;
    this.locale = normalizeLocale(locale);
    this.spotifyMarket = String(spotifyMarket || 'IT').toUpperCase();

    this.autoDisconnectMs = autoDisconnectMs;
    this.disconnectTimer = null;
  }

  clearDisconnectTimer() {
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
  }

  clearNowPlayingTimer() {
    if (this.nowPlayingUpdateTimer) {
      clearInterval(this.nowPlayingUpdateTimer);
      this.nowPlayingUpdateTimer = null;
    }
  }

  clearTrackStartTimeout() {
    if (this.trackStartTimeout) {
      clearTimeout(this.trackStartTimeout);
      this.trackStartTimeout = null;
    }
  }
}

module.exports = GuildQueue;
