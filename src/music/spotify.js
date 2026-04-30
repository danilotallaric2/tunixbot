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
    return Boolean(SpotifyService.parseSpotifyUrl(query));
  }

  static parseSpotifyUrl(query) {
    const value = String(query || '').trim();
    if (!value) return null;

    // spotify:track:<id> / spotify:album:<id> / spotify:playlist:<id>
    const uriMatch = value.match(/^spotify:(track|album|playlist):([a-zA-Z0-9]+)$/i);
    if (uriMatch) {
      return { type: uriMatch[1].toLowerCase(), id: uriMatch[2] };
    }

    let url;
    try {
      url = new URL(value);
    } catch {
      return null;
    }

    if (url.hostname.toLowerCase() !== 'open.spotify.com') return null;

    const rawParts = url.pathname.split('/').filter(Boolean);
    if (!rawParts.length) return null;

    // Handle new Spotify locale prefix links: /intl-it/album/<id>
    const parts = rawParts[0].toLowerCase().startsWith('intl-') ? rawParts.slice(1) : rawParts;
    if (parts.length < 2) return null;

    const type = parts[0].toLowerCase();
    const id = parts[1];
    if (!['track', 'album', 'playlist'].includes(type)) return null;
    if (!/^[a-zA-Z0-9]+$/.test(id)) return null;

    return { type, id };
  }

  mapSpotifyError(error) {
    const msg = String(error?.message || '').toLowerCase();
    if (msg.includes('fetch failed') || msg.includes('network')) {
      return 'Spotify API non raggiungibile in questo momento. Riprova tra poco.';
    }
    return typeof error?.message === 'string' && error.message.trim()
      ? error.message
      : 'Errore Spotify durante il recupero dei brani.';
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
      spotifyId: track.id || null,
      title: track.name,
      author: artists,
      duration: track.duration_ms,
      url: track.external_urls?.spotify || null,
      thumbnail,
      popularity: Number.isFinite(track.popularity) ? track.popularity : null
    };
  }

  async getTrack(urlOrUri) {
    const parsed = SpotifyService.parseSpotifyUrl(urlOrUri);
    if (!parsed || parsed.type !== 'track') throw new Error('Spotify track URL non valido');
    try {
      const { body } = await this.api.getTrack(parsed.id, { market: this.market });
      return {
        tracks: [this.mapTrack(body)],
        name: null,
        kind: 'track'
      };
    } catch (error) {
      throw new Error(this.mapSpotifyError(error));
    }
  }

  async getAlbum(urlOrUri) {
    const parsed = SpotifyService.parseSpotifyUrl(urlOrUri);
    if (!parsed || parsed.type !== 'album') throw new Error('Spotify album URL non valido');
    try {
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
    } catch (error) {
      throw new Error(this.mapSpotifyError(error));
    }
  }

  async getPlaylist(urlOrUri) {
    const parsed = SpotifyService.parseSpotifyUrl(urlOrUri);
    if (!parsed || parsed.type !== 'playlist') throw new Error('Spotify playlist URL non valido');
    try {
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
    } catch (error) {
      throw new Error(this.mapSpotifyError(error));
    }
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
