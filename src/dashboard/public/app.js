const authGate = document.getElementById('authGate');
const appRoot = document.getElementById('appRoot');
const joinPopup = document.getElementById('joinPopup');

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
const discoverSection = document.getElementById('discoverSection');
const resultsSection = document.getElementById('resultsSection');

const chips = document.getElementById('chips');
const discoverWrap = document.getElementById('discoverWrap');
const results = document.getElementById('results');
const resultsCount = document.getElementById('resultsCount');
const queueList = document.getElementById('queueList');
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

const loopModes = ['off', 'song', 'queue'];
const LYRICS_SYNC_DELAY_MS = 0;
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

const setStatus = (text, isError = false) => {
  statusPill.textContent = text;
  statusPill.style.background = isError
    ? 'linear-gradient(120deg,#ffd2d7,#ff6b7a)'
    : 'linear-gradient(120deg,#a8efff,#27d3ff)';
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
  const serverMs = Math.max(0, Number(s.progressMs || 0));

  if (progressTrackKey !== trackKey) {
    progressTrackKey = trackKey;
    progressAnchorMs = serverMs;
    progressAnchorTs = now;
    return;
  }

  // Always resync to server sample to avoid long-term drift between tracks.
  progressAnchorMs = duration > 0 ? Math.min(serverMs, duration) : serverMs;
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
  loopBtn.textContent = 'Loop';
  loopBtn.title = `Loop: ${mode}`;
  lyricsLoopBtn.textContent = 'Loop';
  lyricsLoopBtn.title = `Loop: ${mode}`;
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
    playPauseBtn.textContent = '▶';
    lyricsPlayPauseBtn.textContent = '▶';
  } else {
    npThumb.src = s.current.thumbnail || '';
    npTitle.textContent = s.current.title;
    npArtist.textContent = s.current.author;
    lyricsNpThumb.src = s.current.thumbnail || '';
    lyricsNpTitle.textContent = s.current.title;
    lyricsNpArtist.textContent = s.current.author;
    playPauseBtn.textContent = s.paused ? '▶' : '⏸';
    lyricsPlayPauseBtn.textContent = s.paused ? '▶' : '⏸';
    renderProgressOnly();
  }

  volumeRange.value = String(s.volume || 80);
  volumeText.textContent = `${s.volume || 80}%`;
  updateLoopButtonLabels();
  currentEffect.textContent = s.filter || 'clear';
  lyricsCurrentEffect.textContent = s.filter || 'clear';

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
    setStatus(payload.message || 'Usa /join su Discord per iniziare.', true);
  } else {
    hideJoinPopup();
    if (!payload.canControl) setStatus(payload.message || 'Entra nella stessa vocale del bot.', true);
    else setStatus('Connesso e pronto');
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
  await loadDiscover();
  setViewMode('discover');

  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => refreshSession().catch(() => {}), 2500);

  if (localProgressTimer) clearInterval(localProgressTimer);
  localProgressTimer = setInterval(() => {
    if (!state?.current || state.paused) return;
    renderProgressOnly();
    updateLyricsProgress();
  }, 1000);
};

searchBtn.addEventListener('click', () => search());
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') search();
});
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
    setEffectsOpen(true);
  } catch (error) {
    setStatus(error.message, true);
  }
});

effectsCloseBtn.addEventListener('click', () => setEffectsOpen(false));
effectsPanel.addEventListener('click', (e) => {
  if (e.target === effectsPanel) setEffectsOpen(false);
});

effectsPanel.querySelectorAll('[data-effect]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const effect = btn.dataset.effect;
    try {
      ensureCanControl();
      await control('filter', effect);
      currentEffect.textContent = effect;
      lyricsCurrentEffect.textContent = effect;
      setStatus(`Effetto applicato: ${effect}`);
      setEffectsOpen(false);
    } catch (error) {
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
