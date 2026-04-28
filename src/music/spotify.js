const SpotifyWebApi = require('spotify-web-api-node');

class SpotifyService {
  constructor({ clientId, clientSecret, market }) {
    this.enabled = Boolean(clientId && clientSecret);
    this.market = market || 'US';

    if (!this.enabled) {
      this.api = null;
      this.tokenRefreshTimer = null;
      return;
    }

    this.api = new SpotifyWebApi({ clientId, clientSecret });
    this.tokenRefreshTimer = null;
  }

  static isSpotifyUrl(query) {
    return /(?:https?:\/\/open\.spotify\.com\/|spotify:)(track|playlist|album)[/:]([a-zA-Z0-9]+)/.test(query);
  }

  static parseSpotifyUrl(query) {
    const match = query.match(/(?:https?:\/\/open\.spotify\.com\/|spotify:)(track|playlist|album)[/:]([a-zA-Z0-9]+)/);
    if (!match) return null;
    return { type: match[1], id: match[2] };
  }

  async init() {
    if (!this.enabled) return;
    await this.refreshToken();

    this.tokenRefreshTimer = setInterval(async () => {
      try {
        await this.refreshToken();
      } catch {
        // silent refresh retry on next cycle
      }
    }, 50 * 60 * 1000);

    this.tokenRefreshTimer.unref?.();
  }

  async refreshToken() {
    if (!this.enabled) throw new Error('Spotify credentials missing');
    const token = await this.api.clientCredentialsGrant();
    this.api.setAccessToken(token.body.access_token);
  }

  mapTrack(track, fallbackThumb = null) {
    const artists = track.artists?.map((a) => a.name).join(', ') || 'Unknown Artist';
    const thumbnail = track.album?.images?.[0]?.url || fallbackThumb || null;

    return {
      source: 'spotify',
      title: track.name,
      author: artists,
      duration: track.duration_ms,
      url: track.external_urls?.spotify || null,
      thumbnail
    };
  }

  async getTrack(urlOrUri) {
    const parsed = SpotifyService.parseSpotifyUrl(urlOrUri);
    if (!parsed || parsed.type !== 'track') throw new Error('Spotify track URL non valido');

    const { body } = await this.api.getTrack(parsed.id, { market: this.market });
    return {
      tracks: [this.mapTrack(body)],
      name: null,
      kind: 'track'
    };
  }

  async getAlbum(urlOrUri) {
    const parsed = SpotifyService.parseSpotifyUrl(urlOrUri);
    if (!parsed || parsed.type !== 'album') throw new Error('Spotify album URL non valido');

    const { body } = await this.api.getAlbum(parsed.id, { market: this.market });
    const tracks = body.tracks.items.map((t) => {
      const synthetic = { ...t, album: body };
      return this.mapTrack(synthetic, body.images?.[0]?.url || null);
    });

    return {
      tracks,
      name: body.name,
      kind: 'album'
    };
  }

  async getPlaylist(urlOrUri) {
    const parsed = SpotifyService.parseSpotifyUrl(urlOrUri);
    if (!parsed || parsed.type !== 'playlist') throw new Error('Spotify playlist URL non valido');

    const playlistMeta = await this.api.getPlaylist(parsed.id, { market: this.market });
    const all = [];
    let offset = 0;

    while (true) {
      const page = await this.api.getPlaylistTracks(parsed.id, {
        market: this.market,
        limit: 100,
        offset
      });

      for (const item of page.body.items) {
        if (!item.track || !item.track.name) continue;
        all.push(this.mapTrack(item.track, playlistMeta.body.images?.[0]?.url || null));
      }

      offset += page.body.items.length;
      if (!page.body.next) break;
    }

    return {
      tracks: all,
      name: playlistMeta.body.name,
      kind: 'playlist'
    };
  }

  async resolve(urlOrUri) {
    if (!this.enabled) {
      throw new Error('Spotify non configurato. Imposta SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET.');
    }

    const parsed = SpotifyService.parseSpotifyUrl(urlOrUri);
    if (!parsed) throw new Error('Link Spotify non valido');

    if (parsed.type === 'track') return this.getTrack(urlOrUri);
    if (parsed.type === 'album') return this.getAlbum(urlOrUri);
    if (parsed.type === 'playlist') return this.getPlaylist(urlOrUri);

    throw new Error('Tipo Spotify non supportato');
  }
}

module.exports = SpotifyService;
