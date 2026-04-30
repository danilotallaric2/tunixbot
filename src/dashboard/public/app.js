const authGate = document.getElementById('authGate');
const appRoot = document.getElementById('appRoot');
const joinPopup = document.getElementById('joinPopup');
const toastViewport = document.getElementById('toastViewport');
const versionPopup = document.getElementById('versionPopup');
const versionPopupCloseBtn = document.getElementById('versionPopupCloseBtn');
const versionConfetti = document.getElementById('versionConfetti');

const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const logoutBtn = document.getElementById('logoutBtn');

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
const statusPill = document.getElementById('statusPill');

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
const SERVER_PROGRESS_MAX_SOFT_BACKSTEP_MS = 120;
let sessionInfo = null;
let state = null;
let canControl = false;
let pollTimer = null;
let localProgressTimer = null;
let progressAnchorMs = 0;
let progressAnchorTs = 0;
let progressTrackKey = null;
let lyricsOpen = false;
let lyricsLines = [];
let lyricsTrackKey = null;
let activeLyricIndex = -1;
let lyricsRequestSeq = 0;
let currentLocale = 'en';
const lyricsCache = new Map();
const lyricsInflight = new Map();
const LYRICS_CACHE_MAX_ENTRIES = 80;

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
      remove: 'Remove'
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
      loadingLyrics: 'Loading lyrics...'
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
      remove: 'Rimuovi'
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
      loadingLyrics: 'Caricamento lyrics...'
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
  if (statusPill?.querySelector('.status-text')) statusPill.querySelector('.status-text').textContent = tr('ui.statusReady');

  setText('.left-col .section-title', tr('ui.sessionTitle'));
  const sessionRows = document.querySelectorAll('.session-row span');
  if (sessionRows[0]) sessionRows[0].textContent = tr('ui.sessionServer');
  if (sessionRows[1]) sessionRows[1].textContent = tr('ui.sessionVoice');
  if (sessionRows[2]) sessionRows[2].textContent = tr('ui.sessionText');
  setText('.discover-chips .section-title', tr('ui.discover'));
  setText('#discoverSection .section-head h2', tr('ui.discoverSuggested'));
  setText('#resultsSection .section-head h2', tr('ui.resultsTitle'));
  setText('.right-col .queue-head h3', tr('ui.queueTitle'));

  for (const btn of sourceOptionButtons) {
    const key = btn.dataset.sourceOption === 'youtube' ? 'sources.youtube' : 'sources.spotify';
    const label = btn.querySelector('span');
    if (label) label.textContent = tr(key);
  }
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
  const message = String(text || '');

  const statusTextEl = statusPill.querySelector('.status-text');
  if (statusTextEl) statusTextEl.textContent = message;
  else statusPill.textContent = message;

  statusPill.classList.remove('status-ok', 'status-error', 'status-info');
  if (isError) {
    statusPill.classList.add('status-error');
    return;
  }

  const normalized = message.toLowerCase();
  if (
    normalized.includes(tr('connection.ready').toLowerCase()) ||
    normalized === tr('ui.statusReady').toLowerCase()
  ) {
    statusPill.classList.add('status-ok');
  } else {
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
    return;
  }

  const duration = s.current.duration || 0;
  const serverMsRaw = Math.max(0, Number(s.progressMs || 0));
  const serverMs = duration > 0 ? Math.min(serverMsRaw, duration) : serverMsRaw;

  if (progressTrackKey !== trackKey) {
    progressTrackKey = trackKey;
    progressAnchorMs = serverMs;
    progressAnchorTs = now;
    return;
  }

  if (s.paused) {
    progressAnchorMs = serverMs;
    progressAnchorTs = now;
    return;
  }

  // Keep progress monotonic to avoid lyrics jumping backwards due jittery server samples.
  const elapsed = Math.max(0, now - progressAnchorTs);
  const liveBeforeSync = (duration > 0 ? Math.min(progressAnchorMs + elapsed, duration) : progressAnchorMs + elapsed);
  const backwardDelta = liveBeforeSync - serverMs;

  if (backwardDelta > SERVER_PROGRESS_HARD_RESET_BACKWARD_MS) {
    // Real backward seek/restart: trust server hard reset.
    progressAnchorMs = serverMs;
    progressAnchorTs = now;
    return;
  }

  if (backwardDelta > SERVER_PROGRESS_BACKWARD_TOLERANCE_MS) {
    // Small backward jitter: ignore to keep lyrics smooth and monotonic.
    return;
  }

  // Tiny backward adjustments are clamped to avoid visible line "bounce".
  progressAnchorMs = Math.max(serverMs, liveBeforeSync - SERVER_PROGRESS_MAX_SOFT_BACKSTEP_MS);
  progressAnchorTs = now;
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
    el.style.setProperty('--fill', '0%');
    lyricsLinesWrap.appendChild(el);
  });
};

const getLyricLineWindow = (idx) => {
  if (idx < 0 || idx >= lyricsLines.length) return null;
  const start = lyricsLines[idx]?.timeMs ?? 0;
  const nextStart = lyricsLines[idx + 1]?.timeMs;

  if (Number.isFinite(nextStart) && nextStart > start) {
    return { start, end: nextStart };
  }

  const trackDuration = Number(state?.current?.duration || 0);
  if (trackDuration > start + 150) {
    return { start, end: trackDuration };
  }

  return { start, end: start + 2200 };
};

const setLyricFillProgress = (idx, currentMs) => {
  const lineEls = lyricsLinesWrap.querySelectorAll('.lyric-line');
  if (!lineEls.length) return;

  const window = getLyricLineWindow(idx);
  let activeProgress = 0;
  if (window) {
    const span = Math.max(300, window.end - window.start);
    activeProgress = Math.max(0, Math.min(1, (currentMs - window.start) / span));
  }

  lineEls.forEach((el, i) => {
    let widthPercent = 0;
    if (idx >= 0 && i < idx) widthPercent = 100;
    else if (i === idx) widthPercent = activeProgress * 100;

    el.style.setProperty('--fill', `${Math.max(0, Math.min(100, widthPercent)).toFixed(2)}%`);
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
      if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  setLyricFillProgress(idx, currentMs);
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

  if (newTrackKey !== oldTrackKey) {
    lyricsTrackKey = null;
    activeLyricIndex = -1;
    lyricsRequestSeq += 1;
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
    authGate.classList.remove('hidden');
    appRoot.classList.add('hidden');
    hideJoinPopup();
    return null;
  }

  applyLocale(me.locale || me.user?.locale || 'en');
  authGate.classList.add('hidden');
  appRoot.classList.remove('hidden');

  userAvatar.src = me.user.avatarUrl || '';
  userName.textContent = me.user.globalName || me.user.username;

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

const bootstrap = async () => {
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

  await refreshSession();
  await loadDiscover();
  setViewMode('discover');
  updateSourceBadge();
  showVersionPopupIfNeeded();

  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => refreshSession().catch(() => {}), 2500);

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
  renderProgressOnly();
  control('seek', Number(seekRange.value));
});

lyricsSeekRange.addEventListener('change', () => {
  if (!state?.current) return;
  progressAnchorMs = Number(lyricsSeekRange.value);
  progressAnchorTs = Date.now();
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
  setStatus(error.message, true);
});
