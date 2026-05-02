const authGate = document.getElementById('authGate');
const appRoot = document.getElementById('appRoot');
const bootSplash = document.getElementById('bootSplash');
const joinPopup = document.getElementById('joinPopup');
const toastViewport = document.getElementById('toastViewport');
const versionPopup = document.getElementById('versionPopup');
const versionPopupCloseBtn = document.getElementById('versionPopupCloseBtn');
const versionConfetti = document.getElementById('versionConfetti');

const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const logoutBtn = document.getElementById('logoutBtn');
const discordLoginBtn = document.querySelector('.discord-login');

const sessionGuild = document.getElementById('sessionGuild');
const sessionVoice = document.getElementById('sessionVoice');
const sessionText = document.getElementById('sessionText');

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const playBtn = document.getElementById('playBtn');
const searchSourceSelect = document.getElementById('searchSourceSelect');
const sourceOptionButtons = [...document.querySelectorAll('[data-source-option]')];
const discoverSection = document.getElementById('discoverSection');
const resultsSection = document.getElementById('resultsSection');

const chips = document.getElementById('chips');
const discoverWrap = document.getElementById('discoverWrap');
const results = document.getElementById('results');
const resultsCount = document.getElementById('resultsCount');
const queueList = document.getElementById('queueList');
const clearQueueBtn = document.getElementById('clearQueueBtn');
const playlistLoadCard = document.getElementById('playlistLoadCard');
const playlistLoadTitle = document.getElementById('playlistLoadTitle');
const playlistLoadPercent = document.getElementById('playlistLoadPercent');
const playlistLoadFill = document.getElementById('playlistLoadFill');
const playlistLoadMeta = document.getElementById('playlistLoadMeta');
const playlistLoadCancelBtn = document.getElementById('playlistLoadCancelBtn');
const statusPill = document.getElementById('statusPill');
const statusTitleEl = statusPill?.querySelector('.status-title') || null;
const statusTextEl = statusPill?.querySelector('.status-text') || null;
const spotifyUserPanel = document.getElementById('spotifyUserPanel');
const spotifyPanelTitle = document.getElementById('spotifyPanelTitle');
const spotifyUserLabel = document.getElementById('spotifyUserLabel');
const spotifyConnectBtn = document.getElementById('spotifyConnectBtn');
const spotifyDisconnectBtn = document.getElementById('spotifyDisconnectBtn');
const spotifyRefreshBtn = document.getElementById('spotifyRefreshBtn');
const spotifyLikedBulk = document.getElementById('spotifyLikedBulk');
const spotifyLikedTitle = document.getElementById('spotifyLikedTitle');
const spotifyLikedCount = document.getElementById('spotifyLikedCount');
const spotifyLibraryList = document.getElementById('spotifyLibraryList');
const spotifyPlaylistPanel = document.getElementById('spotifyPlaylistPanel');
const spotifyPlaylistTitle = document.getElementById('spotifyPlaylistTitle');
const spotifyPlaylistMeta = document.getElementById('spotifyPlaylistMeta');
const spotifyPlaylistTracks = document.getElementById('spotifyPlaylistTracks');
const spotifyPlaylistCloseBtn = document.getElementById('spotifyPlaylistCloseBtn');
const spotifyPlaylistQueueAllBtn = document.getElementById('spotifyPlaylistQueueAllBtn');
const spotifyPlaylistLoadMoreBtn = document.getElementById('spotifyPlaylistLoadMoreBtn');

const npThumb = document.getElementById('npThumb');
const npTitle = document.getElementById('npTitle');
const npArtist = document.getElementById('npArtist');
const progressText = document.getElementById('progressText');
const seekRange = document.getElementById('seekRange');
const volumeRange = document.getElementById('volumeRange');
const volumeText = document.getElementById('volumeText');
const currentEffect = document.getElementById('currentEffect');

const playPauseBtn = document.getElementById('playPauseBtn');
const loopBtn = document.getElementById('loopBtn');
const refreshBtn = document.getElementById('refreshBtn');
const lyricsBtn = document.getElementById('lyricsBtn');
const effectsBtn = document.getElementById('effectsBtn');
const lyricsPanel = document.getElementById('lyricsPanel');
const lyricsCloseBtn = document.getElementById('lyricsCloseBtn');
const lyricsBody = document.getElementById('lyricsBody');
const lyricsLinesWrap = document.getElementById('lyricsLines');
const lyricsTrackLabel = document.getElementById('lyricsTrackLabel');
const lyricsNpThumb = document.getElementById('lyricsNpThumb');
const lyricsNpTitle = document.getElementById('lyricsNpTitle');
const lyricsNpArtist = document.getElementById('lyricsNpArtist');
const lyricsProgressText = document.getElementById('lyricsProgressText');
const lyricsSeekRange = document.getElementById('lyricsSeekRange');
const lyricsCurrentEffect = document.getElementById('lyricsCurrentEffect');
const lyricsPlayPauseBtn = document.getElementById('lyricsPlayPauseBtn');
const lyricsSkipBtn = document.getElementById('lyricsSkipBtn');
const lyricsStopBtn = document.getElementById('lyricsStopBtn');
const lyricsShuffleBtn = document.getElementById('lyricsShuffleBtn');
const lyricsLoopBtn = document.getElementById('lyricsLoopBtn');
const effectsPanel = document.getElementById('effectsPanel');
const effectsCloseBtn = document.getElementById('effectsCloseBtn');
const effectButtons = [...effectsPanel.querySelectorAll('[data-effect]')];
const trackInfoPanel = document.getElementById('trackInfoPanel');
const trackInfoCloseBtn = document.getElementById('trackInfoCloseBtn');
const trackInfoThumb = document.getElementById('trackInfoThumb');
const trackInfoTitle = document.getElementById('trackInfoTitle');
const trackInfoArtist = document.getElementById('trackInfoArtist');
const trackInfoDuration = document.getElementById('trackInfoDuration');
const trackInfoSource = document.getElementById('trackInfoSource');
const trackInfoStatus = document.getElementById('trackInfoStatus');
const trackInfoQueuePos = document.getElementById('trackInfoQueuePos');
const trackInfoContext = document.getElementById('trackInfoContext');
const trackInfoUrl = document.getElementById('trackInfoUrl');
const nowPlayingInfoTrigger = document.getElementById('nowPlayingInfoTrigger');

const loopModes = ['off', 'song', 'queue'];
const ANNOUNCEMENT_VERSION = '1.0.5';
const ANNOUNCEMENT_COOKIE = 'tunixbot_announcement_dismissed';
// Negative value means "show lyrics earlier than audio".
const LYRICS_SYNC_DELAY_MS = -1000;
const SERVER_PROGRESS_BACKWARD_TOLERANCE_MS = 350;
const SERVER_PROGRESS_HARD_RESET_BACKWARD_MS = 3500;
const SERVER_PROGRESS_SOFT_SYNC_DEADZONE_MS = 120;
const SERVER_PROGRESS_SOFT_SYNC_FORWARD_STEP_MS = 480;
const SERVER_PROGRESS_SOFT_SYNC_BACKWARD_STEP_MS = 220;
let sessionInfo = null;
let state = null;
let canControl = false;
let pollTimer = null;
let localProgressTimer = null;
let pollingActive = false;
let pollInFlight = false;
let lastPlaylistLoadToastKey = null;
let progressAnchorMs = 0;
let progressAnchorTs = 0;
let progressTrackKey = null;
let lyricsOpen = false;
let lyricsLines = [];
let lyricsTrackKey = null;
let activeLyricIndex = -1;
let lyricsRequestSeq = 0;
let lyricsBackwardSyncUntilTs = 0;
let pendingHardBackwardSync = null;
let currentLocale = 'en';
let spotifyAllowed = false;
let spotifyLibrary = null;
let spotifySelectedPlaylist = null;
let spotifyPlaylistNextOffset = null;
const lyricsCache = new Map();
const lyricsInflight = new Map();
const LYRICS_CACHE_MAX_ENTRIES = 80;

const markLyricsBackwardSyncWindow = (ms = 2200) => {
  lyricsBackwardSyncUntilTs = Date.now() + Math.max(250, Number(ms) || 0);
};

const I18N = {
  en: {
    errors: {
      api: 'API request failed.',
      noSession: 'No active session. Use /join in your Discord voice channel.',
      botNotInVoice: 'The bot is not in voice. Use /join again on Discord.',
      sameVoiceRequired: 'You must be in the same voice channel as the bot to use the dashboard.',
      syncedLyricsUnavailable: 'Synced lyrics are not available for this track.',
      unavailable: 'Unavailable'
    },
    ui: {
      versionBadge: 'New version',
      versionTitle: 'TunixBot 1.0.5',
      versionUpdates: 'What we updated:',
      versionClose: 'Got it',
      joinPopupTitle: 'Session not found',
      joinPopupText: 'Join a voice channel on Discord and run /join. The dashboard will refresh automatically.',
      lyricsLive: 'Lyrics Live',
      close: 'Close',
      effectsTitle: 'Audio Effects',
      effectsSub: 'Choose a filter to apply to the current player',
      trackDetails: 'Track Details',
      trackTitle: 'Title',
      trackArtist: 'Artist',
      trackDuration: 'Duration',
      trackSource: 'Source',
      trackStatus: 'Status',
      trackQueuePos: 'Queue position',
      trackLink: 'Link',
      logout: 'Logout',
      sessionTitle: 'Session',
      sessionServer: 'Server',
      sessionVoice: 'Bot Voice',
      sessionText: 'Text Channel',
      statusReady: 'Ready',
      statusCardReadyTitle: 'Session Ready',
      statusCardInfoTitle: 'Session Update',
      statusCardErrorTitle: 'Session Alert',
      discover: 'Discover',
      discoverSuggested: 'Suggested tracks',
      resultsTitle: 'Search results',
      queueTitle: 'Queue',
      queueClear: 'Clear',
      effectLabel: 'Effect:',
      noTrack: 'No track',
      queueEmpty: 'Queue is empty.',
      searchPlaceholder: 'What do you want to hear?',
      search: 'Search',
      playQuery: 'Play Query',
      detailsResultContext: 'Search result details',
      detailsResultStatus: 'Ready for queue',
      detailsQueueContext: 'Queue item details',
      detailsQueueStatus: 'Queued',
      detailsNowContext: 'Now playing details',
      detailsPaused: 'Paused',
      detailsPlaying: 'Playing',
      playNow: 'Play Now',
      remove: 'Remove',
      playlistLoadingTitle: 'Loading playlist...',
      cancel: 'Cancel',
      spotifyPanelTitle: 'Spotify Library',
      spotifyConnectPrompt: 'Connect your Spotify account to use your playlists and liked songs.',
      spotifyConnect: 'Connect Spotify',
      spotifyDisconnect: 'Disconnect',
      spotifyRefresh: 'Refresh',
      spotifyLikedTitle: 'Liked Songs',
      spotifyOpenLiked: 'Open Liked Songs',
      spotifyTracksCount: '{count} tracks',
      spotifyPlaylistsEmpty: 'No playlists found on this account.',
      spotifyPlaylistQueue: 'Queue Playlist',
      spotifyPlaylistQueueAll: 'Add All to Queue',
      spotifyLikedQueueAll: 'Queue All Liked Songs',
      spotifyLinkedAs: 'Connected as {name}',
      spotifyOpenPlaylist: 'Open',
      spotifyQueueTrack: 'Queue Track',
      spotifyPlaylistTracksEmpty: 'No tracks available in this playlist.',
      spotifyPlaylistLoadMore: 'Load More',
      spotifyPlaylistTitle: 'Playlist',
      spotifyRefreshAria: 'Refresh Spotify library',
      spotifyDisconnectAria: 'Disconnect Spotify account'
    },
    status: {
      searching: 'Searching...',
      foundTracks: 'Found {count} tracks on {source}',
      queueAdding: 'Adding to queue...',
      queueAddedAndSkipped: 'Added {added} tracks, skipped {skipped} (not found in audio source)',
      queueAddedMany: 'Added {added} tracks to queue',
      queueAddedOne: 'Track added',
      nextTrack: 'Next track',
      stopped: 'Playback stopped',
      shuffled: 'Queue shuffled',
      loopSet: 'Loop set: {mode}',
      removedAt: 'Track #{index} removed from queue',
      jumpingTo: 'Jumping to track #{index}...',
      queueCleared: 'Queue cleared',
      effectApplied: 'Effect applied: {effect}',
      loadingLyrics: 'Loading lyrics...',
      playlistLoadingStarted: 'Playlist loading started',
      playlistLoadingCompleted: 'Playlist loaded: {added} tracks',
      playlistLoadingCancelled: 'Playlist loading cancelled',
      playlistLoadingFailed: 'Playlist loading failed',
      spotifyLoadingLibrary: 'Loading Spotify library...',
      spotifyLibraryReady: 'Spotify library loaded',
      spotifyDisconnected: 'Spotify disconnected',
      spotifyQueuePlaylistStarted: 'Spotify playlist loading started',
      spotifyQueueLikedStarted: 'Liked songs loading started',
      spotifyLoadingPlaylistTracks: 'Loading playlist tracks...',
      spotifyLoadingLikedTracks: 'Loading liked songs...',
      spotifyTrackQueued: 'Track queued from playlist'
    },
    buttons: {
      ariaResume: 'Resume playback',
      ariaPause: 'Pause playback',
      toastClose: 'Close notification'
    },
    sources: {
      spotify: 'Spotify',
      youtube: 'YouTube',
      external: 'External Link'
    },
    connection: {
      sessionMissing: 'Session not found',
      sameVoice: 'Join the same voice channel',
      ready: 'Connected and ready'
    },
    versionList: [
      'Improved Spotify/YouTube source search',
      'Lyrics sync improved',
      'Queue management improved (play index, remove, clear)',
      'Smart autoplay: when queue ends, a similar track starts automatically'
    ],
    chips: ['italian rap', 'italian trap', 'pop hits', 'chill vibes', 'night drive', 'deep house', 'anime opening']
  },
  it: {
    errors: {
      api: 'Errore API',
      noSession: 'Nessuna sessione attiva. Usa /join su Discord nel canale vocale.',
      botNotInVoice: 'Il bot non e in vocale. Rifai /join su Discord.',
      sameVoiceRequired: 'Devi essere nello stesso canale vocale del bot per usare la dashboard.',
      syncedLyricsUnavailable: 'Lyrics sincronizzate non disponibili per questo brano.',
      unavailable: 'Non disponibile'
    },
    ui: {
      versionBadge: 'Nuova versione',
      versionTitle: 'TunixBot 1.0.5',
      versionUpdates: 'Abbiamo aggiornato:',
      versionClose: 'Ho capito',
      joinPopupTitle: 'Sessione non trovata',
      joinPopupText: 'Entra in vocale su Discord e usa /join. La dashboard si aggiornera automaticamente.',
      lyricsLive: 'Lyrics Live',
      close: 'Chiudi',
      effectsTitle: 'Effetti Audio',
      effectsSub: 'Scegli un filtro da applicare al player corrente',
      trackDetails: 'Dettagli Brano',
      trackTitle: 'Titolo',
      trackArtist: 'Artista',
      trackDuration: 'Durata',
      trackSource: 'Sorgente',
      trackStatus: 'Stato',
      trackQueuePos: 'Posizione coda',
      trackLink: 'Link',
      logout: 'Logout',
      sessionTitle: 'Sessione',
      sessionServer: 'Server',
      sessionVoice: 'Vocale Bot',
      sessionText: 'Canale Testo',
      statusReady: 'Pronto',
      statusCardReadyTitle: 'Sessione Pronta',
      statusCardInfoTitle: 'Aggiornamento Sessione',
      statusCardErrorTitle: 'Attenzione Sessione',
      discover: 'Scopri',
      discoverSuggested: 'Brani consigliati',
      resultsTitle: 'Risultati ricerca',
      queueTitle: 'Coda',
      queueClear: 'Svuota',
      effectLabel: 'Effetto:',
      noTrack: 'Nessun brano',
      queueEmpty: 'Coda vuota.',
      searchPlaceholder: 'Cosa vuoi ascoltare?',
      search: 'Cerca',
      playQuery: 'Play Query',
      detailsResultContext: 'Dettaglio risultato',
      detailsResultStatus: 'Pronto per la coda',
      detailsQueueContext: 'Dettaglio dalla coda',
      detailsQueueStatus: 'In coda',
      detailsNowContext: 'Dettaglio ora in riproduzione',
      detailsPaused: 'In pausa',
      detailsPlaying: 'In riproduzione',
      playNow: 'Riproduci Ora',
      remove: 'Rimuovi',
      playlistLoadingTitle: 'Caricamento playlist...',
      cancel: 'Annulla',
      spotifyPanelTitle: 'Libreria Spotify',
      spotifyConnectPrompt: 'Collega il tuo account Spotify per usare playlist e brani preferiti.',
      spotifyConnect: 'Collega Spotify',
      spotifyDisconnect: 'Scollega',
      spotifyRefresh: 'Aggiorna',
      spotifyLikedTitle: 'Brani Preferiti',
      spotifyOpenLiked: 'Apri Preferiti',
      spotifyTracksCount: '{count} brani',
      spotifyPlaylistsEmpty: 'Nessuna playlist trovata su questo account.',
      spotifyPlaylistQueue: 'Metti Playlist in Coda',
      spotifyPlaylistQueueAll: 'Aggiungi Tutto in Coda',
      spotifyLikedQueueAll: 'Aggiungi Tutti i Preferiti in Coda',
      spotifyLinkedAs: 'Collegato come {name}',
      spotifyOpenPlaylist: 'Apri',
      spotifyQueueTrack: 'Metti Brano in Coda',
      spotifyPlaylistTracksEmpty: 'Nessun brano disponibile in questa playlist.',
      spotifyPlaylistLoadMore: 'Carica altri',
      spotifyPlaylistTitle: 'Playlist',
      spotifyRefreshAria: 'Aggiorna libreria Spotify',
      spotifyDisconnectAria: 'Scollega account Spotify'
    },
    status: {
      searching: 'Ricerca in corso...',
      foundTracks: 'Trovate {count} tracce su {source}',
      queueAdding: 'Aggiunta in coda...',
      queueAddedAndSkipped: 'Aggiunti {added} brani, saltati {skipped} (non trovati in sorgente audio)',
      queueAddedMany: 'Aggiunti {added} brani in coda',
      queueAddedOne: 'Brano aggiunto',
      nextTrack: 'Brano successivo',
      stopped: 'Riproduzione fermata',
      shuffled: 'Coda mischiata',
      loopSet: 'Loop impostato: {mode}',
      removedAt: 'Brano #{index} rimosso dalla coda',
      jumpingTo: 'Passo al brano #{index}...',
      queueCleared: 'Coda svuotata',
      effectApplied: 'Effetto applicato: {effect}',
      loadingLyrics: 'Caricamento lyrics...',
      playlistLoadingStarted: 'Caricamento playlist avviato',
      playlistLoadingCompleted: 'Playlist caricata: {added} brani',
      playlistLoadingCancelled: 'Caricamento playlist annullato',
      playlistLoadingFailed: 'Caricamento playlist fallito',
      spotifyLoadingLibrary: 'Caricamento libreria Spotify...',
      spotifyLibraryReady: 'Libreria Spotify caricata',
      spotifyDisconnected: 'Spotify scollegato',
      spotifyQueuePlaylistStarted: 'Caricamento playlist Spotify avviato',
      spotifyQueueLikedStarted: 'Caricamento preferiti avviato',
      spotifyLoadingPlaylistTracks: 'Caricamento brani playlist...',
      spotifyLoadingLikedTracks: 'Caricamento preferiti...',
      spotifyTrackQueued: 'Brano messo in coda dalla playlist'
    },
    buttons: {
      ariaResume: 'Riprendi riproduzione',
      ariaPause: 'Metti in pausa',
      toastClose: 'Chiudi notifica'
    },
    sources: {
      spotify: 'Spotify',
      youtube: 'YouTube',
      external: 'Link esterno'
    },
    connection: {
      sessionMissing: 'Sessione non trovata',
      sameVoice: 'Entra nella stessa vocale',
      ready: 'Connesso e pronto'
    },
    versionList: [
      'Ricerca sorgenti Spotify/YouTube migliorata',
      'Lyrics syncata',
      'Gestione coda migliorata (play index, remove, clear)',
      'Autoplay smart: quando la coda finisce parte un brano simile all ultimo'
    ],
    chips: ['italian rap', 'trap italia', 'pop hits', 'chill vibes', 'night drive', 'deep house', 'anime opening']
  }
};

const normalizeLocale = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'it' || normalized.startsWith('it-')) return 'it';
  return 'en';
};

const lookup = (obj, key) =>
  String(key)
    .split('.')
    .reduce((acc, piece) => (acc && Object.prototype.hasOwnProperty.call(acc, piece) ? acc[piece] : undefined), obj);

const interpolate = (template, vars = {}) =>
  String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (_m, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : `{${name}}`
  );

const tr = (key, vars = {}) => {
  const value = lookup(I18N[currentLocale], key);
  if (typeof value === 'string') return interpolate(value, vars);
  const fallback = lookup(I18N.en, key);
  if (typeof fallback === 'string') return interpolate(fallback, vars);
  return key;
};

const seededChips = () => I18N[currentLocale]?.chips || I18N.en.chips;

const normalizePlayableUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();

  const isSpotifyHost = host === 'open.spotify.com' || host.endsWith('.spotify.com');
  const isSpotifyPath =
    pathname.includes('/track/') || pathname.includes('/album/') || pathname.includes('/playlist/');
  if (isSpotifyHost && isSpotifyPath) return parsed.toString();

  const isYoutubeHost = host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com';
  const isYoutubePath =
    pathname === '/watch' || pathname === '/playlist' || pathname.startsWith('/shorts/');
  if (isYoutubeHost && isYoutubePath) return parsed.toString();

  const isYoutuBe = host === 'youtu.be' && pathname.length > 1;
  if (isYoutuBe) return parsed.toString();

  return null;
};

const api = async (url, options = {}) => {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || tr('errors.api'));
  return data;
};

const readCookie = (name) => {
  const key = `${name}=`;
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(key)) return decodeURIComponent(trimmed.slice(key.length));
  }
  return null;
};

const writeCookie = (name, value, days = 365) => {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
};

const setText = (selector, text) => {
  const el = document.querySelector(selector);
  if (el) el.textContent = text;
};

const getSpotifyQueueAllLabel = () => {
  const isLiked = spotifySelectedPlaylist?.id === 'liked';
  return isLiked ? tr('ui.spotifyLikedQueueAll') : tr('ui.spotifyPlaylistQueueAll');
};

const setBootLoadingVisible = (visible) => {
  if (!bootSplash) return;
  bootSplash.classList.toggle('hidden', !visible);
};

const applyLocale = (locale) => {
  currentLocale = normalizeLocale(locale);
  document.documentElement.lang = currentLocale;

  setText('.version-badge', tr('ui.versionBadge'));
  setText('#versionPopupTitle', tr('ui.versionTitle'));
  setText('.version-popup-text', tr('ui.versionUpdates'));
  setText('#versionPopupCloseBtn', tr('ui.versionClose'));

  const versionListEl = document.querySelector('.version-list');
  if (versionListEl) {
    versionListEl.innerHTML = '';
    for (const item of I18N[currentLocale].versionList) {
      const li = document.createElement('li');
      li.textContent = item;
      versionListEl.appendChild(li);
    }
  }

  setText('.join-popup-title', tr('ui.joinPopupTitle'));
  setText('.join-popup-text', tr('ui.joinPopupText'));

  setText('#lyricsPanel .lyrics-title', tr('ui.lyricsLive'));
  setText('#lyricsCloseBtn', tr('ui.close'));
  setText('#effectsPanel .lyrics-title', tr('ui.effectsTitle'));
  setText('#effectsPanel .lyrics-track-label', tr('ui.effectsSub'));
  setText('#effectsCloseBtn', tr('ui.close'));
  setText('#trackInfoPanel .lyrics-title', tr('ui.trackDetails'));
  setText('#trackInfoCloseBtn', tr('ui.close'));

  const infoRows = document.querySelectorAll('#trackInfoPanel .track-info-row span');
  const labels = [
    tr('ui.trackTitle'),
    tr('ui.trackArtist'),
    tr('ui.trackDuration'),
    tr('ui.trackSource'),
    tr('ui.trackStatus'),
    tr('ui.trackQueuePos'),
    tr('ui.trackLink')
  ];
  infoRows.forEach((row, idx) => {
    if (labels[idx]) row.textContent = labels[idx];
  });

  if (logoutBtn) logoutBtn.textContent = tr('ui.logout');
  if (searchInput) searchInput.placeholder = tr('ui.searchPlaceholder');
  if (searchBtn) searchBtn.textContent = tr('ui.search');
  if (playBtn) playBtn.textContent = tr('ui.playQuery');
  if (clearQueueBtn) clearQueueBtn.textContent = tr('ui.queueClear');
  document.querySelectorAll('.effect-label').forEach((label) => {
    const valueEl = label.querySelector('b');
    if (!valueEl) return;
    const value = valueEl.textContent;
    label.textContent = `${tr('ui.effectLabel')} `;
    const bold = document.createElement('b');
    bold.textContent = value;
    label.appendChild(bold);
  });
  if (statusTextEl) statusTextEl.textContent = tr('connection.ready');
  if (statusTitleEl) statusTitleEl.textContent = tr('ui.statusCardReadyTitle');

  setText('.left-col .section-title', tr('ui.sessionTitle'));
  const sessionRows = document.querySelectorAll('.session-row span');
  if (sessionRows[0]) sessionRows[0].textContent = tr('ui.sessionServer');
  if (sessionRows[1]) sessionRows[1].textContent = tr('ui.sessionVoice');
  if (sessionRows[2]) sessionRows[2].textContent = tr('ui.sessionText');
  setText('.discover-chips .section-title', tr('ui.discover'));
  setText('#discoverSection .section-head h2', tr('ui.discoverSuggested'));
  setText('#resultsSection .section-head h2', tr('ui.resultsTitle'));
  setText('.right-col .queue-head h3', tr('ui.queueTitle'));
  setText('#playlistLoadTitle', tr('ui.playlistLoadingTitle'));
  setText('#playlistLoadCancelBtn', tr('ui.cancel'));
  setText('#spotifyPanelTitle', tr('ui.spotifyPanelTitle'));
  setText('#spotifyLikedTitle', tr('ui.spotifyLikedTitle'));
  if (spotifyConnectBtn) spotifyConnectBtn.textContent = tr('ui.spotifyConnect');
  if (spotifyDisconnectBtn) {
    spotifyDisconnectBtn.setAttribute('aria-label', tr('ui.spotifyDisconnectAria'));
    spotifyDisconnectBtn.title = tr('ui.spotifyDisconnect');
  }
  if (spotifyRefreshBtn) {
    spotifyRefreshBtn.setAttribute('aria-label', tr('ui.spotifyRefreshAria'));
    spotifyRefreshBtn.title = tr('ui.spotifyRefresh');
  }
  if (spotifyPlaylistLoadMoreBtn) spotifyPlaylistLoadMoreBtn.textContent = tr('ui.spotifyPlaylistLoadMore');
  if (spotifyPlaylistCloseBtn) spotifyPlaylistCloseBtn.textContent = tr('ui.close');
  if (spotifyPlaylistQueueAllBtn) spotifyPlaylistQueueAllBtn.textContent = getSpotifyQueueAllLabel();
  if (spotifyPlaylistTitle && !spotifySelectedPlaylist) spotifyPlaylistTitle.textContent = tr('ui.spotifyPlaylistTitle');

  for (const btn of sourceOptionButtons) {
    const key = btn.dataset.sourceOption === 'youtube' ? 'sources.youtube' : 'sources.spotify';
    const label = btn.querySelector('span');
    if (label) label.textContent = tr(key);
  }

  if (spotifyLibrary) renderSpotifyLibrary(spotifyLibrary);
};

const spawnVersionConfetti = () => {
  if (!versionConfetti) return;
  versionConfetti.innerHTML = '';
  const colors = ['#27d3ff', '#6d5cff', '#7ce7ff', '#ff6b7a', '#4bc2ff', '#ffc14d'];

  for (let i = 0; i < 34; i += 1) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = `${Math.random() * 420}ms`;
    piece.style.transform = `rotate(${Math.floor(Math.random() * 360)}deg)`;
    versionConfetti.appendChild(piece);
  }
};

const showVersionPopupIfNeeded = () => {
  if (!versionPopup) return;
  const dismissedVersion = readCookie(ANNOUNCEMENT_COOKIE);
  if (dismissedVersion === ANNOUNCEMENT_VERSION) return;
  versionPopup.classList.remove('hidden');
  spawnVersionConfetti();
};

const dismissVersionPopup = () => {
  if (!versionPopup) return;
  writeCookie(ANNOUNCEMENT_COOKIE, ANNOUNCEMENT_VERSION, 365);
  versionPopup.classList.add('hidden');
};

const setConnectionStatus = (text, isError = false) => {
  if (!statusPill) return;
  const message = String(text || tr('connection.ready'));

  if (statusTextEl) statusTextEl.textContent = message;
  else statusPill.textContent = message;

  statusPill.classList.remove('status-ok', 'status-error', 'status-info');
  if (isError) {
    if (statusTitleEl) statusTitleEl.textContent = tr('ui.statusCardErrorTitle');
    statusPill.classList.add('status-error');
    return;
  }

  const normalized = message.toLowerCase();
  if (
    normalized.includes(tr('connection.ready').toLowerCase()) ||
    normalized === tr('ui.statusReady').toLowerCase()
  ) {
    if (statusTitleEl) statusTitleEl.textContent = tr('ui.statusCardReadyTitle');
    statusPill.classList.add('status-ok');
  } else {
    if (statusTitleEl) statusTitleEl.textContent = tr('ui.statusCardInfoTitle');
    statusPill.classList.add('status-info');
  }
};

const showToast = (text, type = 'info') => {
  if (!toastViewport) return;
  const message = String(text || '').trim();
  if (!message) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-mark" aria-hidden="true"></div>
    <div class="toast-message"></div>
    <button class="toast-close" type="button" aria-label="${tr('buttons.toastClose')}">x</button>
  `;

  toast.querySelector('.toast-message').textContent = message;
  toastViewport.appendChild(toast);

  const close = () => {
    toast.classList.add('closing');
    setTimeout(() => toast.remove(), 180);
  };

  toast.querySelector('.toast-close')?.addEventListener('click', close);
  setTimeout(close, type === 'error' ? 5200 : 3400);
};

const setStatus = (text, isError = false) => {
  showToast(text, isError ? 'error' : 'info');
};

const setPlayPauseVisual = (button, paused = true) => {
  if (!button) return;
  button.classList.toggle('is-paused', paused);
  button.classList.toggle('is-playing', !paused);
  button.setAttribute('aria-label', paused ? tr('buttons.ariaResume') : tr('buttons.ariaPause'));
};

const updateSourceBadge = () => {
  if (!searchSourceSelect) return;
  const source = searchSourceSelect.value === 'youtube' ? 'youtube' : 'spotify';

  for (const button of sourceOptionButtons) {
    const active = button.dataset.sourceOption === source;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  }
};

const setSearchSource = (source, options = {}) => {
  if (!searchSourceSelect) return;
  searchSourceSelect.value = source === 'youtube' ? 'youtube' : 'spotify';
  updateSourceBadge();

  const q = searchInput.value.trim();
  if (options.rerunSearch && q && !normalizePlayableUrl(q)) {
    search(q);
  }
};

const updateEffectSelection = (filter = 'clear') => {
  for (const button of effectButtons) {
    const active = button.dataset.effect === filter;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  }
};

const formatDuration = (ms) => {
  const sec = Math.max(0, Math.floor((ms || 0) / 1000));
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
};

const inferTrackSource = (url) => {
  if (!url) return '-';
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('spotify')) return tr('sources.spotify');
    if (host.includes('youtube') || host.includes('youtu.be')) return tr('sources.youtube');
  } catch {}
  return tr('sources.external');
};

const shorten = (text, max = 68) => {
  const value = String(text || '');
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}...`;
};

const setTrackInfoOpen = (open) => {
  if (!trackInfoPanel) return;
  if (open) trackInfoPanel.classList.remove('hidden');
  else trackInfoPanel.classList.add('hidden');
};

const showTrackInfo = (track, options = {}) => {
  if (
    !track ||
    !trackInfoPanel ||
    !trackInfoTitle ||
    !trackInfoArtist ||
    !trackInfoDuration ||
    !trackInfoSource ||
    !trackInfoStatus ||
    !trackInfoQueuePos ||
    !trackInfoContext ||
    !trackInfoUrl ||
    !trackInfoThumb
  ) {
    return;
  }

  const url = String(track.url || '').trim();
  const title = track.title || '-';
  const artist = track.author || '-';
  const durationText = track.durationText || formatDuration(track.duration || 0);
  const source = inferTrackSource(url);

  trackInfoTitle.textContent = title;
  trackInfoArtist.textContent = artist;
  trackInfoDuration.textContent = durationText;
  trackInfoSource.textContent = source;
  trackInfoStatus.textContent = options.status || '-';
  trackInfoQueuePos.textContent = options.queuePosition ? `#${options.queuePosition}` : '-';
  trackInfoContext.textContent = options.context || tr('ui.trackDetails');

  trackInfoThumb.src = track.thumbnail || '';
  trackInfoThumb.alt = title !== '-' ? `cover ${title}` : 'cover';

  if (url) {
    trackInfoUrl.textContent = shorten(url);
    trackInfoUrl.href = url;
    trackInfoUrl.classList.remove('disabled');
    trackInfoUrl.tabIndex = 0;
  } else {
    trackInfoUrl.textContent = tr('errors.unavailable');
    trackInfoUrl.removeAttribute('href');
    trackInfoUrl.classList.add('disabled');
    trackInfoUrl.tabIndex = -1;
  }

  setTrackInfoOpen(true);
};

const ensureCanControl = () => {
  if (!sessionInfo) {
    throw new Error(tr('errors.noSession'));
  }
  if (!state?.connected) {
    throw new Error(tr('errors.botNotInVoice'));
  }
  if (!canControl) {
    throw new Error(tr('errors.sameVoiceRequired'));
  }
};

const getTrackKey = (s) => {
  if (!s?.current) return null;
  return `${s.current.sessionId || 0}|${s.current.title}|${s.current.author}|${s.current.duration}|${s.current.url || ''}`;
};

const syncProgressAnchorFromServer = (s) => {
  const now = Date.now();
  const trackKey = getTrackKey(s);

  if (!trackKey || !s.current) {
    progressTrackKey = null;
    progressAnchorMs = 0;
    progressAnchorTs = now;
    pendingHardBackwardSync = null;
    return;
  }

  const duration = s.current.duration || 0;
  const serverMsRaw = Math.max(0, Number(s.progressMs || 0));
  const serverMs = duration > 0 ? Math.min(serverMsRaw, duration) : serverMsRaw;

  if (progressTrackKey !== trackKey) {
    progressTrackKey = trackKey;
    progressAnchorMs = serverMs;
    progressAnchorTs = now;
    pendingHardBackwardSync = null;
    markLyricsBackwardSyncWindow(2600);
    return;
  }

  if (s.paused) {
    const previousMs = progressAnchorMs;
    const allowBackwardWhilePaused = now <= lyricsBackwardSyncUntilTs;
    progressAnchorMs = allowBackwardWhilePaused ? serverMs : Math.max(previousMs, serverMs);
    progressAnchorTs = now;
    if (serverMs + 250 < previousMs) markLyricsBackwardSyncWindow(1800);
    return;
  }

  // Keep progress monotonic to avoid lyrics jumping backwards due jittery server samples.
  const elapsed = Math.max(0, now - progressAnchorTs);
  const liveBeforeSync = (duration > 0 ? Math.min(progressAnchorMs + elapsed, duration) : progressAnchorMs + elapsed);
  const backwardDelta = liveBeforeSync - serverMs;
  const likelyTrackRestart = duration > 0 && serverMs <= 1500 && liveBeforeSync >= Math.max(2000, duration - 2500);

  if (backwardDelta > SERVER_PROGRESS_HARD_RESET_BACKWARD_MS && likelyTrackRestart) {
    // Real backward seek/restart: trust server hard reset.
    progressAnchorMs = serverMs;
    progressAnchorTs = now;
    pendingHardBackwardSync = null;
    markLyricsBackwardSyncWindow(2800);
    return;
  }

  if (backwardDelta > SERVER_PROGRESS_HARD_RESET_BACKWARD_MS && now <= lyricsBackwardSyncUntilTs) {
    // User/manual seek window: allow a hard backward correction.
    progressAnchorMs = serverMs;
    progressAnchorTs = now;
    pendingHardBackwardSync = null;
    markLyricsBackwardSyncWindow(2200);
    return;
  }

  if (backwardDelta > SERVER_PROGRESS_HARD_RESET_BACKWARD_MS) {
    // For remote seeks/controls, require the backward jump to repeat before accepting.
    const canConfirmFromPrevious =
      pendingHardBackwardSync
      && now - pendingHardBackwardSync.at <= 6000
      && serverMs >= pendingHardBackwardSync.serverMs
      && serverMs - pendingHardBackwardSync.serverMs <= 6000;

    if (canConfirmFromPrevious) {
      progressAnchorMs = serverMs;
      progressAnchorTs = now;
      pendingHardBackwardSync = null;
      markLyricsBackwardSyncWindow(2400);
      return;
    }

    pendingHardBackwardSync = { at: now, serverMs };
    return;
  }

  // Soft-sync server/client position to keep dashboard timer aligned with real playback
  // without visible jumps when Lavalink samples jitter.
  const driftMs = serverMs - liveBeforeSync;
  if (Math.abs(driftMs) <= SERVER_PROGRESS_SOFT_SYNC_DEADZONE_MS) {
    progressAnchorMs = liveBeforeSync;
    progressAnchorTs = now;
    pendingHardBackwardSync = null;
    return;
  }

  if (driftMs > 0) {
    const step = Math.min(driftMs, SERVER_PROGRESS_SOFT_SYNC_FORWARD_STEP_MS);
    progressAnchorMs = liveBeforeSync + step;
    progressAnchorTs = now;
    pendingHardBackwardSync = null;
    return;
  }

  // drift < 0 (local timer ahead): allow controlled backward corrections.
  // This keeps seconds and lyrics synced while avoiding hard visual snaps.
  const backwardDrift = Math.abs(driftMs);
  if (backwardDrift > SERVER_PROGRESS_BACKWARD_TOLERANCE_MS) {
    const step = Math.min(backwardDrift, SERVER_PROGRESS_SOFT_SYNC_BACKWARD_STEP_MS);
    progressAnchorMs = Math.max(0, liveBeforeSync - step);
    progressAnchorTs = now;
    pendingHardBackwardSync = null;
    markLyricsBackwardSyncWindow(900);
    return;
  }

  // Tiny backward jitter: keep previous anchor for visual stability.
  progressAnchorMs = liveBeforeSync;
  progressAnchorTs = now;
  pendingHardBackwardSync = null;
};

const getLiveProgressMs = () => {
  if (!state?.current) return 0;

  const duration = state.current.duration || 0;
  if (state.paused) return duration > 0 ? Math.min(progressAnchorMs, duration) : progressAnchorMs;

  const elapsed = Math.max(0, Date.now() - progressAnchorTs);
  const live = progressAnchorMs + elapsed;
  return duration > 0 ? Math.min(live, duration) : live;
};

const parseSyncedLyrics = (raw) => {
  if (!raw) return [];
  const lines = raw.split(/\r?\n/);
  const parsed = [];
  let globalOffsetMs = 0;

  for (const line of lines) {
    const offsetMatch = line.match(/^\[offset:([+-]?\d+)]$/i);
    if (offsetMatch) {
      globalOffsetMs = Number(offsetMatch[1] || 0);
      break;
    }
  }

  for (const line of lines) {
    const matches = [...line.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?]/g)];
    if (!matches.length) continue;
    const text = line.replace(/\[[^\]]+]/g, '').trim();
    if (!text) continue;

    for (const m of matches) {
      const min = Number(m[1] || 0);
      const sec = Number(m[2] || 0);
      const fracRaw = m[3] || '0';
      const frac = Number(fracRaw.padEnd(3, '0').slice(0, 3));
      parsed.push({
        timeMs: Math.max(0, min * 60 * 1000 + sec * 1000 + frac + globalOffsetMs),
        text
      });
    }
  }

  return parsed.sort((a, b) => a.timeMs - b.timeMs);
};

const cacheLyricsLines = (trackKey, lines) => {
  if (!trackKey) return;
  const cachedLines = Array.isArray(lines) ? lines : [];
  if (lyricsCache.has(trackKey)) lyricsCache.delete(trackKey);
  lyricsCache.set(trackKey, cachedLines);

  while (lyricsCache.size > LYRICS_CACHE_MAX_ENTRIES) {
    const oldest = lyricsCache.keys().next().value;
    if (!oldest) break;
    lyricsCache.delete(oldest);
  }
};

const fetchLyricsForTrackKey = async (trackKey) => {
  if (!trackKey) return [];
  if (lyricsCache.has(trackKey)) return lyricsCache.get(trackKey);
  if (lyricsInflight.has(trackKey)) return lyricsInflight.get(trackKey);

  const request = (async () => {
    const payload = await api('/api/lyrics');
    // Endpoint is tied to currently playing track; protect from stale responses.
    if (getTrackKey(state) !== trackKey) return null;
    const parsed = parseSyncedLyrics(payload.syncedLyrics || '');
    cacheLyricsLines(trackKey, parsed);
    return parsed;
  })()
    .finally(() => {
      lyricsInflight.delete(trackKey);
    });

  lyricsInflight.set(trackKey, request);
  return request;
};

const prefetchLyricsForCurrentTrack = () => {
  const trackKey = getTrackKey(state);
  if (!trackKey || lyricsCache.has(trackKey) || lyricsInflight.has(trackKey)) return;
  fetchLyricsForTrackKey(trackKey).catch(() => {});
};

const renderLyricsLines = () => {
  lyricsLinesWrap.innerHTML = '';

  if (!lyricsLines.length) {
    lyricsLinesWrap.innerHTML = `<div class=\"lyric-line\">${tr('errors.syncedLyricsUnavailable')}</div>`;
    return;
  }

  lyricsLines.forEach((line, idx) => {
    const el = document.createElement('div');
    el.className = 'lyric-line';
    el.dataset.index = String(idx);
    el.textContent = line.text;
    lyricsLinesWrap.appendChild(el);
  });
};

const setLyricsOpen = (open) => {
  lyricsOpen = open;
  if (lyricsOpen) lyricsPanel.classList.remove('hidden');
  else lyricsPanel.classList.add('hidden');
};

const setEffectsOpen = (open) => {
  if (open) effectsPanel.classList.remove('hidden');
  else effectsPanel.classList.add('hidden');
};

const updateLyricsProgress = () => {
  if (!lyricsOpen || !lyricsLines.length || !state?.current) return;

  const currentMs = Math.max(0, getLiveProgressMs() - LYRICS_SYNC_DELAY_MS);
  let idx = -1;
  for (let i = 0; i < lyricsLines.length; i += 1) {
    if (lyricsLines[i].timeMs <= currentMs) idx = i;
    else break;
  }

  const backwardBlocked = idx < activeLyricIndex && Date.now() > lyricsBackwardSyncUntilTs;
  if (backwardBlocked) idx = activeLyricIndex;

  const indexChanged = idx !== activeLyricIndex;
  if (indexChanged) {
    activeLyricIndex = idx;

    const lineEls = lyricsLinesWrap.querySelectorAll('.lyric-line');
    lineEls.forEach((el, i) => {
      el.classList.remove('active', 'dimmed');
      if (idx >= 0 && i < idx) el.classList.add('dimmed');
      if (i === idx) el.classList.add('active');
    });

    if (idx >= 0) {
      const activeEl = lyricsLinesWrap.querySelector(`.lyric-line[data-index=\"${idx}\"]`);
      if (activeEl) {
        const bodyRect = lyricsBody.getBoundingClientRect();
        const lineRect = activeEl.getBoundingClientRect();
        const topSafe = bodyRect.top + bodyRect.height * 0.3;
        const bottomSafe = bodyRect.top + bodyRect.height * 0.7;
        const outOfSafeZone = lineRect.top < topSafe || lineRect.bottom > bottomSafe;
        if (outOfSafeZone) activeEl.scrollIntoView({ behavior: 'auto', block: 'center' });
      }
    }
  }

};

const updateLoopButtonLabels = () => {
  const mode = state?.loop || 'off';
  const visualMap = { off: 'OFF', song: 'ONE', queue: 'ALL' };
  const loopLabel = visualMap[mode] || 'OFF';

  const applyLoopVisual = (button) => {
    if (!button) return;
    button.title = tr('status.loopSet', { mode });
    button.dataset.mode = mode;
    const stateLabel = button.querySelector('.loop-state');
    if (stateLabel) stateLabel.textContent = loopLabel;
  };

  applyLoopVisual(loopBtn);
  applyLoopVisual(lyricsLoopBtn);
};

const loadLyricsForCurrentTrack = async () => {
  if (!state?.current) {
    lyricsLines = [];
    activeLyricIndex = -1;
    lyricsTrackKey = null;
    renderLyricsLines();
    return;
  }

  const requestTrackKey = getTrackKey(state);
  if (lyricsTrackKey === requestTrackKey && lyricsLines.length) return;

  const requestSeq = ++lyricsRequestSeq;
  activeLyricIndex = -1;
  lyricsTrackLabel.textContent = `${state.current.title} • ${state.current.author}`;

  if (lyricsCache.has(requestTrackKey)) {
    lyricsLines = lyricsCache.get(requestTrackKey) || [];
    lyricsTrackKey = requestTrackKey;
    renderLyricsLines();
    updateLyricsProgress();
    return;
  }

  lyricsLines = [];
  lyricsLinesWrap.innerHTML = `<div class=\"lyric-line\">${tr('status.loadingLyrics')}</div>`;

  const parsed = await fetchLyricsForTrackKey(requestTrackKey);
  if (requestSeq !== lyricsRequestSeq) return;
  if (!state?.current || getTrackKey(state) !== requestTrackKey) return;
  if (!Array.isArray(parsed)) return;

  lyricsLines = parsed;
  lyricsTrackKey = requestTrackKey;
  renderLyricsLines();
  updateLyricsProgress();
};

const showJoinPopup = () => {
  joinPopup.classList.remove('hidden');
};

const hideJoinPopup = () => {
  joinPopup.classList.add('hidden');
};

const setViewMode = (mode) => {
  if (mode === 'results') {
    discoverSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');
    return;
  }

  resultsSection.classList.add('hidden');
  discoverSection.classList.remove('hidden');
};

const renderSessionInfo = (session) => {
  sessionInfo = session;
  sessionGuild.textContent = session?.guildName || '-';
  sessionVoice.textContent = session?.voiceChannelName || '-';
  sessionText.textContent = session?.textChannelName ? `#${session.textChannelName}` : '-';
};

const renderQueue = (queue) => {
  queueList.innerHTML = '';
  if (!queue.length) {
    queueList.innerHTML = `<div class=\"queue-author\">${tr('ui.queueEmpty')}</div>`;
    return;
  }

  for (const [idx, track] of queue.slice(0, 30).entries()) {
    const item = document.createElement('div');
    item.className = 'queue-item';
    item.dataset.queueIndex = String(idx + 1);
    item.innerHTML = `
      <img src="${track.thumbnail || ''}" alt="cover" />
      <div>
        <div class="queue-title">${idx + 1}. ${track.title}</div>
        <div class="queue-author">${track.author} • ${track.durationText}</div>
        <div class="queue-actions">
          <button class="queue-action-btn" data-queue-action="play_index" data-index="${idx + 1}">${tr('ui.playNow')}</button>
          <button class="queue-action-btn danger" data-queue-action="remove" data-index="${idx + 1}">${tr('ui.remove')}</button>
        </div>
      </div>
    `;
    queueList.appendChild(item);
  }
};

const renderPlaylistLoad = (playlistLoad) => {
  const snapshot = playlistLoad || null;
  const isActive = Boolean(snapshot?.active);

  if (!playlistLoadCard || !playlistLoadTitle || !playlistLoadPercent || !playlistLoadFill || !playlistLoadMeta || !playlistLoadCancelBtn) {
    return;
  }

  if (!snapshot) {
    playlistLoadCard.classList.add('hidden');
    playlistLoadCancelBtn.disabled = false;
    return;
  }

  const total = Math.max(0, Number(snapshot.total || 0));
  const processed = Math.max(0, Number(snapshot.processed || 0));
  const added = Math.max(0, Number(snapshot.added || 0));
  const skipped = Math.max(0, Number(snapshot.skipped || 0));
  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;
  const playlistName = String(snapshot.playlistName || '').trim();

  const titleBase = tr('ui.playlistLoadingTitle');
  playlistLoadTitle.textContent = playlistName ? `${titleBase} ${playlistName}` : titleBase;
  playlistLoadPercent.textContent = `${percent}%`;
  playlistLoadFill.style.width = `${percent}%`;
  playlistLoadMeta.textContent = `${processed} / ${total} • +${added} • -${skipped}`;
  playlistLoadCancelBtn.disabled = snapshot.status === 'cancelling';

  const progressbar = playlistLoadCard.querySelector('.playlist-load-bar');
  if (progressbar) progressbar.setAttribute('aria-valuenow', String(percent));

  if (isActive) {
    playlistLoadCard.classList.remove('hidden');
  } else {
    playlistLoadCard.classList.add('hidden');
  }

  const toastKey = `${snapshot.id || 'job'}:${snapshot.status || 'running'}:${snapshot.finishedAt || 0}:${snapshot.error || ''}`;
  if (!isActive && lastPlaylistLoadToastKey !== toastKey) {
    if (snapshot.status === 'completed') {
      showToast(tr('status.playlistLoadingCompleted', { added }));
    } else if (snapshot.status === 'cancelled') {
      showToast(tr('status.playlistLoadingCancelled'));
    } else if (snapshot.status === 'failed') {
      showToast(snapshot.error || tr('status.playlistLoadingFailed'), 'error');
    }
    lastPlaylistLoadToastKey = toastKey;
  }

};

const renderSpotifyLibrary = (payload) => {
  spotifyLibrary = payload || null;
  if (!spotifyUserPanel) return;

  if (!spotifyAllowed) {
    spotifyUserPanel.classList.add('hidden');
    setSpotifyPlaylistOpen(false);
    spotifySelectedPlaylist = null;
    return;
  }

  spotifyUserPanel.classList.remove('hidden');

  if (payload && payload.enabled === false) {
    if (spotifyUserLabel) spotifyUserLabel.textContent = String(payload.message || tr('ui.spotifyConnectPrompt'));
    spotifyConnectBtn?.classList.add('hidden');
    spotifyDisconnectBtn?.classList.add('hidden');
    spotifyRefreshBtn?.classList.add('hidden');
    spotifyLikedBulk?.classList.add('hidden');
    if (spotifyLibraryList) spotifyLibraryList.innerHTML = '';
    setSpotifyPlaylistOpen(false);
    spotifySelectedPlaylist = null;
    return;
  }

  const linked = Boolean(payload?.linked);
  const profileName = payload?.profile?.displayName || payload?.profile?.spotifyUserId || 'Spotify';

  if (spotifyUserLabel) {
    spotifyUserLabel.textContent = linked ? tr('ui.spotifyLinkedAs', { name: profileName }) : tr('ui.spotifyConnectPrompt');
  }

  spotifyConnectBtn?.classList.toggle('hidden', linked);
  spotifyDisconnectBtn?.classList.toggle('hidden', !linked);
  spotifyRefreshBtn?.classList.toggle('hidden', !linked);
  spotifyLikedBulk?.classList.toggle('hidden', !linked);

  if (spotifyLikedCount) {
    spotifyLikedCount.textContent = tr('ui.spotifyTracksCount', { count: Number(payload?.likedCount || 0) });
  }

  if (!spotifyLibraryList) return;
  spotifyLibraryList.innerHTML = '';

  if (!linked) {
    setSpotifyPlaylistOpen(false);
    spotifySelectedPlaylist = null;
    return;
  }

  const playlists = Array.isArray(payload?.playlists) ? payload.playlists : [];
  if (!playlists.length) {
    spotifyLibraryList.innerHTML = `<div class="queue-author">${tr('ui.spotifyPlaylistsEmpty')}</div>`;
    return;
  }

  for (const playlist of playlists) {
    const item = document.createElement('article');
    item.className = 'spotify-lib-item';
    item.dataset.spotifyPlaylistId = String(playlist.id || '');
    item.dataset.spotifyPlaylistName = String(playlist.name || '');
    item.dataset.spotifyPlaylistOwner = String(playlist.owner || '-');
    item.dataset.spotifyPlaylistTotal = String(Number(playlist.tracksTotal || 0));
    item.dataset.spotifyPlaylistImage = String(playlist.image || '');
    item.innerHTML = `
      <img src="${playlist.image || ''}" alt="cover" />
      <div>
        <div class="spotify-lib-title">${playlist.name || '-'}</div>
        <div class="spotify-lib-sub">${playlist.owner || '-'} • ${tr('ui.spotifyTracksCount', { count: Number(playlist.tracksTotal || 0) })}</div>
      </div>
    `;
    spotifyLibraryList.appendChild(item);
  }
};

const setSpotifyPlaylistOpen = (open) => {
  if (!spotifyPlaylistPanel) return;
  if (open) spotifyPlaylistPanel.classList.remove('hidden');
  else spotifyPlaylistPanel.classList.add('hidden');
};

const renderSpotifyPlaylistTracks = (payload, { append = false } = {}) => {
  if (!spotifyPlaylistTracks || !spotifyPlaylistMeta || !spotifyPlaylistTitle || !spotifyPlaylistLoadMoreBtn) return;
  if (!append) spotifyPlaylistTracks.innerHTML = '';

  const playlist = payload?.playlist || {};
  const tracks = Array.isArray(payload?.tracks) ? payload.tracks : [];
  const total = Number(payload?.pagination?.total || playlist.total || 0);
  const owner = playlist.owner || '-';

  spotifyPlaylistTitle.textContent = playlist.name || tr('ui.spotifyPlaylistTitle');
  spotifyPlaylistMeta.textContent = `${owner} • ${tr('ui.spotifyTracksCount', { count: total })}`;

  if (!tracks.length && !append) {
    spotifyPlaylistTracks.innerHTML = `<div class="queue-author">${tr('ui.spotifyPlaylistTracksEmpty')}</div>`;
  } else {
    for (const track of tracks) {
      const row = document.createElement('article');
      row.className = 'spotify-playlist-track';
      row.innerHTML = `
        <img src="${track.thumbnail || playlist.image || ''}" alt="cover" />
        <div class="spotify-playlist-track-main">
          <div class="spotify-playlist-track-title">${track.title || '-'}</div>
          <div class="spotify-playlist-track-sub">${track.author || '-'} • ${track.durationText || formatDuration(track.duration || 0)}</div>
        </div>
        <button class="queue-action-btn" data-spotify-track-url="${track.url || ''}">${tr('ui.spotifyQueueTrack')}</button>
      `;
      spotifyPlaylistTracks.appendChild(row);
    }
  }

  spotifyPlaylistNextOffset = payload?.pagination?.hasMore ? Number(payload.pagination.nextOffset || 0) : null;
  spotifyPlaylistLoadMoreBtn.classList.toggle('hidden', !payload?.pagination?.hasMore);
  spotifyPlaylistLoadMoreBtn.disabled = false;
};

const loadSpotifyPlaylistTracks = async (playlistId, { offset = 0, append = false } = {}) => {
  if (!playlistId) return;
  if (!append) {
    const loadingLabel =
      playlistId === 'liked' ? tr('status.spotifyLoadingLikedTracks') : tr('status.spotifyLoadingPlaylistTracks');
    spotifyPlaylistTracks.innerHTML = `<div class="queue-author">${loadingLabel}</div>`;
  }

  try {
    const safeOffset = Math.max(0, Number(offset || 0));
    const requestUrl =
      playlistId === 'liked'
        ? `/api/spotify/liked/tracks?limit=50&offset=${safeOffset}`
        : `/api/spotify/playlist/${encodeURIComponent(playlistId)}/tracks?limit=50&offset=${safeOffset}`;
    const payload = await api(requestUrl);
    renderSpotifyPlaylistTracks(payload, { append });
  } catch (error) {
    if (!append) {
      spotifyPlaylistTracks.innerHTML = `<div class="queue-author">${error.message}</div>`;
    }
    setStatus(error.message, true);
  }
};

const openSpotifyPlaylist = async (playlist) => {
  const playlistId = String(playlist?.id || '').trim();
  if (!playlistId) return;

  spotifySelectedPlaylist = {
    id: playlistId,
    name: String(playlist?.name || ''),
    owner: String(playlist?.owner || '-'),
    total: Number(playlist?.tracksTotal || 0),
    image: String(playlist?.image || ''),
    kind: 'playlist'
  };

  setSpotifyPlaylistOpen(true);
  spotifyPlaylistTitle.textContent = spotifySelectedPlaylist.name || tr('ui.spotifyPlaylistTitle');
  spotifyPlaylistMeta.textContent = `${spotifySelectedPlaylist.owner} • ${tr('ui.spotifyTracksCount', { count: spotifySelectedPlaylist.total })}`;
  if (spotifyPlaylistQueueAllBtn) spotifyPlaylistQueueAllBtn.textContent = getSpotifyQueueAllLabel();
  await loadSpotifyPlaylistTracks(playlistId, { offset: 0, append: false });
};

const openSpotifyLikedSongs = async () => {
  const likedCount = Number(spotifyLibrary?.likedCount || 0);
  spotifySelectedPlaylist = {
    id: 'liked',
    name: tr('ui.spotifyLikedTitle'),
    owner: 'Spotify',
    total: likedCount,
    image: '',
    kind: 'liked'
  };

  setSpotifyPlaylistOpen(true);
  spotifyPlaylistTitle.textContent = spotifySelectedPlaylist.name;
  spotifyPlaylistMeta.textContent = `Spotify • ${tr('ui.spotifyTracksCount', { count: likedCount })}`;
  if (spotifyPlaylistQueueAllBtn) spotifyPlaylistQueueAllBtn.textContent = getSpotifyQueueAllLabel();
  await loadSpotifyPlaylistTracks('liked', { offset: 0, append: false });
};

const loadSpotifyLibrary = async ({ notify = false } = {}) => {
  if (!spotifyAllowed || !spotifyUserPanel) return;

  try {
    if (notify) setStatus(tr('status.spotifyLoadingLibrary'));
    const payload = await api('/api/spotify/library');
    renderSpotifyLibrary(payload);
    if (notify && payload?.linked) setStatus(tr('status.spotifyLibraryReady'));
  } catch (error) {
    setStatus(error.message, true);
  }
};

const queueSpotifyPlaylist = async (playlistId) => {
  if (!playlistId) return;

  try {
    ensureCanControl();
    const payload = await api('/api/spotify/queue/playlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlistId })
    });

    await refreshSession();
    if (payload?.result?.loading) {
      setStatus(tr('status.spotifyQueuePlaylistStarted'));
    } else {
      setStatus(tr('status.queueAddedOne'));
    }
  } catch (error) {
    setStatus(error.message, true);
  }
};

const queueSpotifyLikedSongs = async () => {
  try {
    ensureCanControl();
    const payload = await api('/api/spotify/queue/liked', {
      method: 'POST'
    });

    await refreshSession();
    if (payload?.result?.loading) {
      setStatus(tr('status.spotifyQueueLikedStarted'));
    } else {
      setStatus(tr('status.queueAddedOne'));
    }
  } catch (error) {
    setStatus(error.message, true);
  }
};

const buildCard = (track) => {
  const card = document.createElement('article');
  card.className = 'song-card';
  card.innerHTML = `
    <img src="${track.thumbnail || ''}" alt="cover" />
    <div class="song-title">${track.title}</div>
    <div class="song-artist">${track.author}</div>
    <div class="song-meta">${track.durationText || formatDuration(track.duration)}</div>
    <button>${tr('ui.playQuery')}</button>
  `;

  card.querySelector('button').addEventListener('click', (event) => {
    event.stopPropagation();
    enqueue(track.url || `${track.title} ${track.author}`);
  });

  card.addEventListener('click', () => {
    showTrackInfo(track, {
      context: tr('ui.detailsResultContext'),
      status: tr('ui.detailsResultStatus')
    });
  });

  return card;
};

const renderResults = (tracks) => {
  results.innerHTML = '';
  resultsCount.textContent = String(tracks.length);
  for (const track of tracks) results.appendChild(buildCard(track));
};

const renderDiscover = (sections) => {
  discoverWrap.innerHTML = '';
  for (const section of sections) {
    const block = document.createElement('div');
    block.className = 'discover-row';
    const grid = document.createElement('div');
    grid.className = 'discover-grid';

    for (const track of section.tracks) {
      grid.appendChild(buildCard(track));
    }

    block.innerHTML = `<h4>${section.title}</h4>`;
    block.appendChild(grid);
    discoverWrap.appendChild(block);
  }
};

const renderNowPlaying = (s) => {
  const oldTrackKey = getTrackKey(state);
  state = s;
  syncProgressAnchorFromServer(s);
  const newTrackKey = getTrackKey(s);

  if (!s.current) {
    npThumb.src = '';
    npTitle.textContent = tr('ui.noTrack');
    npArtist.textContent = '-';
    lyricsNpThumb.src = '';
    lyricsNpTitle.textContent = tr('ui.noTrack');
    lyricsNpArtist.textContent = '-';
    progressText.textContent = '0:00 / 0:00';
    lyricsProgressText.textContent = '0:00 / 0:00';
    seekRange.max = '100';
    seekRange.value = '0';
    lyricsSeekRange.max = '100';
    lyricsSeekRange.value = '0';
    setPlayPauseVisual(playPauseBtn, true);
    setPlayPauseVisual(lyricsPlayPauseBtn, true);
  } else {
    npThumb.src = s.current.thumbnail || '';
    npTitle.textContent = s.current.title;
    npArtist.textContent = s.current.author;
    lyricsNpThumb.src = s.current.thumbnail || '';
    lyricsNpTitle.textContent = s.current.title;
    lyricsNpArtist.textContent = s.current.author;
    setPlayPauseVisual(playPauseBtn, Boolean(s.paused));
    setPlayPauseVisual(lyricsPlayPauseBtn, Boolean(s.paused));
    renderProgressOnly();
  }

  volumeRange.value = String(s.volume || 80);
  volumeText.textContent = `${s.volume || 80}%`;
  updateLoopButtonLabels();
  currentEffect.textContent = s.filter || 'clear';
  lyricsCurrentEffect.textContent = s.filter || 'clear';
  updateEffectSelection(s.filter || 'clear');

  renderQueue(s.queue || []);
  renderPlaylistLoad(s.playlistLoad || null);

  if (newTrackKey !== oldTrackKey) {
    lyricsTrackKey = null;
    activeLyricIndex = -1;
    lyricsRequestSeq += 1;
    markLyricsBackwardSyncWindow(3000);
    prefetchLyricsForCurrentTrack();
    if (lyricsOpen) {
      loadLyricsForCurrentTrack().catch(() => {
        lyricsLines = [];
        renderLyricsLines();
      });
    }
  }

  if (lyricsOpen) updateLyricsProgress();
};

const renderProgressOnly = () => {
  if (!state?.current) return;
  const duration = state.current.duration || 0;
  const progress = Math.max(0, Math.min(getLiveProgressMs(), duration || Number.MAX_SAFE_INTEGER));
  progressText.textContent = `${formatDuration(progress)} / ${state.current.durationText}`;
  lyricsProgressText.textContent = `${formatDuration(progress)} / ${state.current.durationText}`;
  seekRange.max = String(duration || 1);
  seekRange.value = String(progress);
  lyricsSeekRange.max = String(duration || 1);
  lyricsSeekRange.value = String(progress);
};

const loadMe = async () => {
  const me = await api('/api/me');
  if (!me.authenticated) {
    spotifyAllowed = false;
    spotifyLibrary = null;
    authGate.classList.remove('hidden');
    appRoot.classList.add('hidden');
    hideJoinPopup();
    setBootLoadingVisible(false);
    return null;
  }

  applyLocale(me.locale || me.user?.locale || 'en');
  authGate.classList.add('hidden');
  appRoot.classList.add('hidden');

  userAvatar.src = me.user.avatarUrl || '';
  userName.textContent = me.user.globalName || me.user.username;
  spotifyAllowed = Boolean(me.spotifyAllowed);
  if (!spotifyAllowed) {
    spotifyLibrary = null;
    spotifyUserPanel?.classList.add('hidden');
  } else {
    renderSpotifyLibrary({
      linked: false,
      playlists: [],
      likedCount: 0,
      profile: null
    });
  }

  return me.user;
};

const refreshSession = async () => {
  const payload = await api('/api/session');
  if (payload?.locale) applyLocale(payload.locale);
  canControl = payload.canControl;
  renderSessionInfo(payload.session);
  renderNowPlaying(payload.state);

  if (!payload.session) {
    showJoinPopup();
    setConnectionStatus(tr('connection.sessionMissing'), true);
  } else {
    hideJoinPopup();
    if (!payload.canControl) setConnectionStatus(tr('connection.sameVoice'), true);
    else setConnectionStatus(tr('connection.ready'));
  }
};

const search = async (query) => {
  const q = query || searchInput.value.trim();
  if (!q) {
    renderResults([]);
    setViewMode('discover');
    return;
  }

  const directUrl = normalizePlayableUrl(q);
  if (directUrl) {
    await enqueue(directUrl);
    return;
  }

  try {
    setStatus(tr('status.searching'));
    const source = searchSourceSelect.value || 'spotify';
    const { tracks } = await api(`/api/search?q=${encodeURIComponent(q)}&source=${encodeURIComponent(source)}`);
    renderResults(tracks);
    setViewMode('results');
    const sourceLabel = source === 'spotify' ? tr('sources.spotify') : tr('sources.youtube');
    setStatus(tr('status.foundTracks', { count: tracks.length, source: sourceLabel }));
  } catch (error) {
    setStatus(error.message, true);
  }
};

const loadDiscover = async () => {
  const { sections } = await api('/api/discover');
  renderDiscover(sections);
};

const enqueue = async (query) => {
  try {
    ensureCanControl();
    setStatus(tr('status.queueAdding'));
    const payload = await api('/api/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    await refreshSession();
    if (payload?.result?.loading) {
      setStatus(tr('status.playlistLoadingStarted'));
      return;
    }
    const added = Number(payload?.result?.addedCount || 0);
    const skipped = Number(payload?.result?.skippedCount || 0);
    if (skipped > 0) {
      setStatus(tr('status.queueAddedAndSkipped', { added, skipped }));
    } else if (added > 1) {
      setStatus(tr('status.queueAddedMany', { added }));
    } else {
      setStatus(tr('status.queueAddedOne'));
    }
  } catch (error) {
    setStatus(error.message, true);
  }
};

const control = async (action, value) => {
  try {
    ensureCanControl();
    await api('/api/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, value })
    });
    await refreshSession();
    return true;
  } catch (error) {
    setStatus(error.message, true);
    return false;
  }
};

const stopPollingLoop = () => {
  pollingActive = false;
  pollInFlight = false;
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
};

const getPollIntervalMs = () => {
  if (state?.playlistLoad?.active) return 350;
  if (state?.current && !state?.paused) return 1200;
  if (state?.current && state?.paused) return 1600;
  return 2500;
};

const schedulePoll = (delayMs) => {
  if (!pollingActive) return;
  const safeDelay = Math.max(150, Number(delayMs || 0));
  pollTimer = setTimeout(async () => {
    if (!pollingActive) return;
    if (pollInFlight) {
      schedulePoll(250);
      return;
    }

    pollInFlight = true;
    try {
      await refreshSession();
    } catch {
      // silent poll error
    } finally {
      pollInFlight = false;
      schedulePoll(getPollIntervalMs());
    }
  }, safeDelay);
};

const startPollingLoop = () => {
  stopPollingLoop();
  pollingActive = true;
  schedulePoll(getPollIntervalMs());
};

const bootstrap = async () => {
  setBootLoadingVisible(true);
  const user = await loadMe();
  if (!user) return;

  chips.innerHTML = '';
  for (const label of seededChips()) {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.textContent = label;
    btn.addEventListener('click', () => {
      searchInput.value = label;
      search(label);
    });
    chips.appendChild(btn);
  }

  try {
    await refreshSession();
  } catch (error) {
    setStatus(error.message, true);
  }

  try {
    await loadDiscover();
  } catch (error) {
    setStatus(error.message, true);
  }

  if (spotifyAllowed) {
    try {
      await loadSpotifyLibrary({ notify: false });
    } catch (error) {
      setStatus(error.message, true);
    }
  }
  setViewMode('discover');
  updateSourceBadge();
  showVersionPopupIfNeeded();
  appRoot.classList.remove('hidden');
  setBootLoadingVisible(false);

  startPollingLoop();

  if (localProgressTimer) clearInterval(localProgressTimer);
  localProgressTimer = setInterval(() => {
    if (!state?.current || state.paused) return;
    renderProgressOnly();
    updateLyricsProgress();
  }, 250);
};

searchBtn.addEventListener('click', () => search());
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') search();
});
searchSourceSelect?.addEventListener('change', () => {
  setSearchSource(searchSourceSelect.value, { rerunSearch: true });
});
for (const button of sourceOptionButtons) {
  button.addEventListener('click', () => {
    setSearchSource(button.dataset.sourceOption, { rerunSearch: true });
  });
}
searchInput.addEventListener('input', () => {
  if (!searchInput.value.trim()) {
    renderResults([]);
    setViewMode('discover');
  }
});
playBtn.addEventListener('click', () => {
  const q = searchInput.value.trim();
  if (q) enqueue(q);
});

refreshBtn.addEventListener('click', () => refreshSession());

lyricsBtn.addEventListener('click', async () => {
  try {
    ensureCanControl();
    setLyricsOpen(true);
    await loadLyricsForCurrentTrack();
  } catch (error) {
    setStatus(error.message, true);
  }
});

lyricsCloseBtn.addEventListener('click', () => setLyricsOpen(false));
lyricsPanel.addEventListener('click', (e) => {
  if (e.target === lyricsPanel) setLyricsOpen(false);
});

effectsBtn.addEventListener('click', () => {
  try {
    ensureCanControl();
    updateEffectSelection(state?.filter || 'clear');
    setEffectsOpen(true);
  } catch (error) {
    setStatus(error.message, true);
  }
});

effectsCloseBtn.addEventListener('click', () => setEffectsOpen(false));
effectsPanel.addEventListener('click', (e) => {
  if (e.target === effectsPanel) setEffectsOpen(false);
});

effectButtons.forEach((btn) => {
  btn.addEventListener('click', async () => {
    const effect = btn.dataset.effect;
    try {
      ensureCanControl();
      updateEffectSelection(effect);
      await control('filter', effect);
      currentEffect.textContent = effect;
      lyricsCurrentEffect.textContent = effect;
      setStatus(tr('status.effectApplied', { effect }));
    } catch (error) {
      updateEffectSelection(state?.filter || 'clear');
      setStatus(error.message, true);
    }
  });
});

playPauseBtn.addEventListener('click', () => {
  if (!state?.current) return;
  control(state.paused ? 'resume' : 'pause');
});

lyricsPlayPauseBtn.addEventListener('click', () => {
  if (!state?.current) return;
  control(state.paused ? 'resume' : 'pause');
});

lyricsSkipBtn.addEventListener('click', async () => {
  const ok = await control('skip');
  if (ok) setStatus(tr('status.nextTrack'));
});
lyricsStopBtn.addEventListener('click', async () => {
  const ok = await control('stop');
  if (ok) setStatus(tr('status.stopped'));
});
lyricsShuffleBtn.addEventListener('click', async () => {
  const ok = await control('shuffle');
  if (ok) setStatus(tr('status.shuffled'));
});

loopBtn.addEventListener('click', () => {
  const current = state?.loop || 'off';
  const next = loopModes[(loopModes.indexOf(current) + 1) % loopModes.length];
  control('loop', next).then((ok) => {
    if (ok) setStatus(tr('status.loopSet', { mode: next }));
  });
});

lyricsLoopBtn.addEventListener('click', () => {
  const current = state?.loop || 'off';
  const next = loopModes[(loopModes.indexOf(current) + 1) % loopModes.length];
  control('loop', next).then((ok) => {
    if (ok) setStatus(tr('status.loopSet', { mode: next }));
  });
});

document.querySelectorAll('[data-action]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const action = btn.dataset.action;
    const ok = await control(action);
    if (!ok) return;
    if (action === 'shuffle') setStatus(tr('status.shuffled'));
    if (action === 'skip') setStatus(tr('status.nextTrack'));
    if (action === 'stop') setStatus(tr('status.stopped'));
  });
});

queueList.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const actionBtn = target.closest('[data-queue-action]');
  if (actionBtn instanceof HTMLElement) {
    const action = actionBtn.dataset.queueAction;
    const index = Number(actionBtn.dataset.index || 0);
    if (!action || !index) return;

    const ok = await control(action, index);
    if (!ok) return;

    if (action === 'remove') setStatus(tr('status.removedAt', { index }));
    if (action === 'play_index') setStatus(tr('status.jumpingTo', { index }));
    return;
  }

  const queueItem = target.closest('.queue-item');
  if (!(queueItem instanceof HTMLElement)) return;

  const queueIndex = Number(queueItem.dataset.queueIndex || 0);
  if (!queueIndex || !state?.queue?.[queueIndex - 1]) return;

  showTrackInfo(state.queue[queueIndex - 1], {
    context: tr('ui.detailsQueueContext'),
    status: tr('ui.detailsQueueStatus'),
    queuePosition: queueIndex
  });
});

clearQueueBtn?.addEventListener('click', async () => {
  const ok = await control('clear');
  if (ok) setStatus(tr('status.queueCleared'));
});

playlistLoadCancelBtn?.addEventListener('click', async () => {
  await control('cancel_playlist_load');
});

spotifyRefreshBtn?.addEventListener('click', () => {
  loadSpotifyLibrary({ notify: true });
});

spotifyDisconnectBtn?.addEventListener('click', async () => {
  try {
    await api('/auth/spotify/logout', { method: 'POST' });
    renderSpotifyLibrary({
      linked: false,
      playlists: [],
      likedCount: 0,
      profile: null
    });
    setStatus(tr('status.spotifyDisconnected'));
  } catch (error) {
    setStatus(error.message, true);
  }
});

spotifyLikedBulk?.addEventListener('click', () => {
  openSpotifyLikedSongs();
});

spotifyLibraryList?.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const item = target.closest('.spotify-lib-item');
  if (!(item instanceof HTMLElement)) return;
  const playlist = {
    id: String(item.dataset.spotifyPlaylistId || '').trim(),
    name: item.dataset.spotifyPlaylistName || '',
    owner: item.dataset.spotifyPlaylistOwner || '-',
    tracksTotal: Number(item.dataset.spotifyPlaylistTotal || 0),
    image: item.dataset.spotifyPlaylistImage || ''
  };
  if (playlist.id) openSpotifyPlaylist(playlist);
});

spotifyPlaylistQueueAllBtn?.addEventListener('click', async () => {
  const selectedId = String(spotifySelectedPlaylist?.id || '').trim();
  if (!selectedId) return;
  if (selectedId === 'liked') {
    await queueSpotifyLikedSongs();
    return;
  }
  await queueSpotifyPlaylist(selectedId);
});

spotifyPlaylistTracks?.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const trackBtn = target.closest('[data-spotify-track-url]');
  if (!(trackBtn instanceof HTMLElement)) return;

  const trackUrl = String(trackBtn.dataset.spotifyTrackUrl || '').trim();
  if (!trackUrl) return;
  enqueue(trackUrl);
});

spotifyPlaylistLoadMoreBtn?.addEventListener('click', async () => {
  if (!spotifySelectedPlaylist?.id || !Number.isFinite(spotifyPlaylistNextOffset)) return;
  spotifyPlaylistLoadMoreBtn.disabled = true;
  await loadSpotifyPlaylistTracks(spotifySelectedPlaylist.id, { offset: spotifyPlaylistNextOffset, append: true });
});

spotifyPlaylistCloseBtn?.addEventListener('click', () => {
  setSpotifyPlaylistOpen(false);
});

spotifyPlaylistPanel?.addEventListener('click', (event) => {
  if (event.target === spotifyPlaylistPanel) setSpotifyPlaylistOpen(false);
});

versionPopupCloseBtn?.addEventListener('click', dismissVersionPopup);
versionPopup?.addEventListener('click', (event) => {
  if (event.target === versionPopup) dismissVersionPopup();
});

trackInfoCloseBtn?.addEventListener('click', () => setTrackInfoOpen(false));
trackInfoPanel?.addEventListener('click', (event) => {
  if (event.target === trackInfoPanel) setTrackInfoOpen(false);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    setTrackInfoOpen(false);
    setSpotifyPlaylistOpen(false);
  }
});

nowPlayingInfoTrigger?.addEventListener('click', () => {
  if (!state?.current) return;
  showTrackInfo(state.current, {
    context: tr('ui.detailsNowContext'),
    status: state.paused ? tr('ui.detailsPaused') : tr('ui.detailsPlaying')
  });
});

seekRange.addEventListener('change', () => {
  if (!state?.current) return;
  progressAnchorMs = Number(seekRange.value);
  progressAnchorTs = Date.now();
  markLyricsBackwardSyncWindow(3000);
  renderProgressOnly();
  control('seek', Number(seekRange.value));
});

lyricsSeekRange.addEventListener('change', () => {
  if (!state?.current) return;
  progressAnchorMs = Number(lyricsSeekRange.value);
  progressAnchorTs = Date.now();
  markLyricsBackwardSyncWindow(3000);
  renderProgressOnly();
  control('seek', Number(lyricsSeekRange.value));
});

volumeRange.addEventListener('change', () => {
  control('volume', Number(volumeRange.value));
});

logoutBtn.addEventListener('click', async () => {
  await api('/auth/logout', { method: 'POST' });
  location.reload();
});

bootstrap().catch((error) => {
  setBootLoadingVisible(false);
  if (!userName?.textContent) authGate.classList.remove('hidden');
  else appRoot.classList.remove('hidden');
  setStatus(error.message, true);
});
