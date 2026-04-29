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
const spotifyConnectBtn = document.getElementById('spotifyConnectBtn');
const spotifyDisconnectBtn = document.getElementById('spotifyDisconnectBtn');
const spotifyUserLabel = document.getElementById('spotifyUserLabel');
const spotifyLibraryList = document.getElementById('spotifyLibraryList');
const spotifyTabPlaylists = document.getElementById('spotifyTabPlaylists');
const spotifyTabLiked = document.getElementById('spotifyTabLiked');

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
let spotifyConnected = false;
let spotifyLibraryType = 'playlists';

const seededChips = ['italian rap', 'trap italia', 'pop hits', 'chill vibes', 'night drive', 'deep house', 'anime opening'];

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
  if (!res.ok) throw new Error(data.error || 'Errore API');
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
  if (normalized.includes('connesso e pronto') || normalized === 'pronto') {
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
    <button class="toast-close" type="button" aria-label="Chiudi notifica">x</button>
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
  button.setAttribute('aria-label', paused ? 'Riprendi riproduzione' : 'Metti in pausa');
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

const setSpotifyTab = (type) => {
  spotifyLibraryType = type;
  spotifyTabPlaylists?.classList.toggle('main', type === 'playlists');
  spotifyTabLiked?.classList.toggle('main', type === 'liked');
};

const renderSpotifyLikedBulkView = () => {
  spotifyLibraryList.innerHTML = `
    <div class="spotify-liked-bulk">
      <div class="spotify-lib-title">Brani preferiti Spotify</div>
      <div class="spotify-lib-sub">Metto direttamente tutti i preferiti in coda (senza lista).</div>
      <button id="spotifyEnqueueLikedBtn" class="ctl main">Aggiungi tutti in coda</button>
    </div>
  `;

  const btn = document.getElementById('spotifyEnqueueLikedBtn');
  btn?.addEventListener('click', async () => {
    try {
      ensureCanControl();
      setStatus('Carico preferiti Spotify in coda...');
      const payload = await api('/api/spotify/liked/enqueue', { method: 'POST' });
      await refreshSession();
      const added = Number(payload?.addedCount || 0);
      const skipped = Number(payload?.skippedCount || 0);
      setStatus(`Preferiti aggiunti: ${added}${skipped > 0 ? `, saltati: ${skipped}` : ''}`);
    } catch (error) {
      setStatus(error.message, true);
    }
  });
};

const formatDuration = (ms) => {
  const sec = Math.max(0, Math.floor((ms || 0) / 1000));
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
};

const ensureCanControl = () => {
  if (!sessionInfo) {
    throw new Error('Nessuna sessione attiva. Usa /join su Discord nel canale vocale.');
  }
  if (!state?.connected) {
    throw new Error('Il bot non e in vocale. Rifai /join su Discord.');
  }
  if (!canControl) {
    throw new Error('Devi essere nello stesso canale vocale del bot per usare la dashboard.');
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

const renderLyricsLines = () => {
  lyricsLinesWrap.innerHTML = '';

  if (!lyricsLines.length) {
    lyricsLinesWrap.innerHTML = '<div class=\"lyric-line\">Lyrics sincronizzate non disponibili per questo brano.</div>';
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

  if (idx === activeLyricIndex) return;
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
};

const updateLoopButtonLabels = () => {
  const mode = state?.loop || 'off';
  const visualMap = { off: 'OFF', song: 'ONE', queue: 'ALL' };
  const loopLabel = visualMap[mode] || 'OFF';

  const applyLoopVisual = (button) => {
    if (!button) return;
    button.title = `Loop: ${mode}`;
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
  lyricsLines = [];
  lyricsLinesWrap.innerHTML = '<div class=\"lyric-line\">Caricamento lyrics...</div>';
  lyricsTrackLabel.textContent = `${state.current.title} • ${state.current.author}`;

  const payload = await api('/api/lyrics');
  if (requestSeq !== lyricsRequestSeq) return;
  if (!state?.current || getTrackKey(state) !== requestTrackKey) return;

  lyricsLines = parseSyncedLyrics(payload.syncedLyrics || '');
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

const renderSpotifyLibrary = (items, type) => {
  spotifyLibraryList.innerHTML = '';
  if (!spotifyConnected) {
    spotifyLibraryList.innerHTML = '<div class="queue-author">Collega Spotify per vedere la tua libreria.</div>';
    return;
  }

  if (!items.length) {
    spotifyLibraryList.innerHTML = `<div class="queue-author">Nessun elemento in ${type === 'liked' ? 'brani preferiti' : 'playlist'}.</div>`;
    return;
  }

  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'spotify-lib-item';
    card.innerHTML = `
      <img src="${item.image || ''}" alt="cover" />
      <div>
        <div class="spotify-lib-title">${item.name}</div>
        <div class="spotify-lib-sub">${type === 'liked' ? `${item.artists || '-'}${item.album ? ` • ${item.album}` : ''}` : `${item.owner || '-'} • ${item.tracksCount || 0} brani`}</div>
        <div class="spotify-lib-actions">
          <button class="queue-action-btn" data-spotify-play="${item.url || ''}">Play</button>
        </div>
      </div>
    `;
    spotifyLibraryList.appendChild(card);
  }
};

const loadSpotifyStatus = async () => {
  try {
    const data = await api('/api/spotify/status');
    spotifyConnected = Boolean(data.connected);
    if (!spotifyConnected) {
      spotifyUserLabel.textContent = 'Non collegato';
      spotifyConnectBtn?.classList.remove('hidden');
      spotifyDisconnectBtn?.classList.add('hidden');
      renderSpotifyLibrary([], spotifyLibraryType);
      return;
    }

    spotifyConnectBtn?.classList.add('hidden');
    spotifyDisconnectBtn?.classList.remove('hidden');
    const profileName = data.profile?.displayName || data.profile?.spotifyUserId || 'Utente Spotify';
    spotifyUserLabel.textContent = `Connesso: ${profileName}`;
    await loadSpotifyLibrary(spotifyLibraryType);
  } catch (error) {
    spotifyConnected = false;
    spotifyUserLabel.textContent = 'Errore collegamento Spotify';
    spotifyConnectBtn?.classList.remove('hidden');
    spotifyDisconnectBtn?.classList.add('hidden');
    renderSpotifyLibrary([], spotifyLibraryType);
  }
};

const loadSpotifyLibrary = async (type = spotifyLibraryType) => {
  setSpotifyTab(type);
  if (!spotifyConnected) {
    renderSpotifyLibrary([], type);
    return;
  }

  if (type === 'liked') {
    renderSpotifyLikedBulkView();
    return;
  }

  try {
    spotifyLibraryList.innerHTML = '<div class="queue-author">Caricamento libreria Spotify...</div>';
    const payload = await api(`/api/spotify/library?type=${encodeURIComponent(type)}&limit=20&offset=0`);
    renderSpotifyLibrary(payload.items || [], type);
  } catch (error) {
    spotifyLibraryList.innerHTML = `<div class="queue-author">${error.message}</div>`;
  }
};

const renderQueue = (queue) => {
  queueList.innerHTML = '';
  if (!queue.length) {
    queueList.innerHTML = '<div class="queue-author">Coda vuota.</div>';
    return;
  }

  for (const [idx, track] of queue.slice(0, 18).entries()) {
    const item = document.createElement('div');
    item.className = 'queue-item';
    item.innerHTML = `
      <img src="${track.thumbnail || ''}" alt="cover" />
      <div>
        <div class="queue-title">${idx + 1}. ${track.title}</div>
        <div class="queue-author">${track.author} • ${track.durationText}</div>
        <div class="queue-actions">
          <button class="queue-action-btn" data-queue-action="play_index" data-index="${idx + 1}">Riproduci Ora</button>
          <button class="queue-action-btn danger" data-queue-action="remove" data-index="${idx + 1}">Rimuovi</button>
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
    <button>Play</button>
  `;

  card.querySelector('button').addEventListener('click', () => {
    enqueue(track.url || `${track.title} ${track.author}`);
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
    npTitle.textContent = 'Nessun brano';
    npArtist.textContent = '-';
    lyricsNpThumb.src = '';
    lyricsNpTitle.textContent = 'Nessun brano';
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

  authGate.classList.add('hidden');
  appRoot.classList.remove('hidden');

  userAvatar.src = me.user.avatarUrl || '';
  userName.textContent = me.user.globalName || me.user.username;

  return me.user;
};

const refreshSession = async () => {
  const payload = await api('/api/session');
  canControl = payload.canControl;
  renderSessionInfo(payload.session);
  renderNowPlaying(payload.state);

  if (!payload.session) {
    showJoinPopup();
    setConnectionStatus('Sessione non trovata', true);
  } else {
    hideJoinPopup();
    if (!payload.canControl) setConnectionStatus('Entra nella stessa vocale', true);
    else setConnectionStatus('Connesso e pronto');
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
    setStatus('Ricerca in corso...');
    const source = searchSourceSelect.value || 'spotify';
    const { tracks } = await api(`/api/search?q=${encodeURIComponent(q)}&source=${encodeURIComponent(source)}`);
    renderResults(tracks);
    setViewMode('results');
    setStatus(`Trovate ${tracks.length} tracce su ${source === 'spotify' ? 'Spotify' : 'YouTube'}`);
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
    setStatus('Aggiunta in coda...');
    const payload = await api('/api/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    await refreshSession();
    const added = Number(payload?.result?.addedCount || 0);
    const skipped = Number(payload?.result?.skippedCount || 0);
    if (skipped > 0) {
      setStatus(`Aggiunti ${added} brani, saltati ${skipped} (non trovati in sorgente audio)`);
    } else if (added > 1) {
      setStatus(`Aggiunti ${added} brani in coda`);
    } else {
      setStatus('Brano aggiunto');
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
  for (const label of seededChips) {
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
  await loadSpotifyStatus();
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
      setStatus(`Effetto applicato: ${effect}`);
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
  if (ok) setStatus('Brano successivo');
});
lyricsStopBtn.addEventListener('click', async () => {
  const ok = await control('stop');
  if (ok) setStatus('Riproduzione fermata');
});
lyricsShuffleBtn.addEventListener('click', async () => {
  const ok = await control('shuffle');
  if (ok) setStatus('Coda mischiata');
});

loopBtn.addEventListener('click', () => {
  const current = state?.loop || 'off';
  const next = loopModes[(loopModes.indexOf(current) + 1) % loopModes.length];
  control('loop', next).then((ok) => {
    if (ok) setStatus(`Loop impostato: ${next}`);
  });
});

lyricsLoopBtn.addEventListener('click', () => {
  const current = state?.loop || 'off';
  const next = loopModes[(loopModes.indexOf(current) + 1) % loopModes.length];
  control('loop', next).then((ok) => {
    if (ok) setStatus(`Loop impostato: ${next}`);
  });
});

document.querySelectorAll('[data-action]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const action = btn.dataset.action;
    const ok = await control(action);
    if (!ok) return;
    if (action === 'shuffle') setStatus('Coda mischiata');
    if (action === 'skip') setStatus('Brano successivo');
    if (action === 'stop') setStatus('Riproduzione fermata');
  });
});

queueList.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const action = target.dataset.queueAction;
  const index = Number(target.dataset.index || 0);
  if (!action || !index) return;

  const ok = await control(action, index);
  if (!ok) return;

  if (action === 'remove') setStatus(`Brano #${index} rimosso dalla coda`);
  if (action === 'play_index') setStatus(`Passo al brano #${index}...`);
});

clearQueueBtn?.addEventListener('click', async () => {
  const ok = await control('clear');
  if (ok) setStatus('Coda svuotata');
});

versionPopupCloseBtn?.addEventListener('click', dismissVersionPopup);
versionPopup?.addEventListener('click', (event) => {
  if (event.target === versionPopup) dismissVersionPopup();
});

spotifyConnectBtn?.addEventListener('click', () => {
  window.location.href = '/auth/spotify/login';
});

spotifyDisconnectBtn?.addEventListener('click', async () => {
  try {
    await api('/auth/spotify/logout', { method: 'POST' });
    spotifyConnected = false;
    setStatus('Spotify disconnesso');
    await loadSpotifyStatus();
  } catch (error) {
    setStatus(error.message, true);
  }
});

spotifyTabPlaylists?.addEventListener('click', () => {
  loadSpotifyLibrary('playlists');
});

spotifyTabLiked?.addEventListener('click', () => {
  loadSpotifyLibrary('liked');
});

spotifyLibraryList?.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const link = target.dataset.spotifyPlay;
  if (!link) return;
  await enqueue(link);
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
