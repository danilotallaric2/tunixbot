const $ = (selector) => document.querySelector(selector);

const els = {
  rangeSelect: $('#rangeSelect'),
  refreshBtn: $('#refreshBtn'),
  lastUpdate: $('#lastUpdate'),
  liveListeners: $('#liveListeners'),
  connectedListeners: $('#connectedListeners'),
  playingSessions: $('#playingSessions'),
  activeSessions: $('#activeSessions'),
  queuedTracks: $('#queuedTracks'),
  pausedSessions: $('#pausedSessions'),
  peakToday: $('#peakToday'),
  peakTodayTime: $('#peakTodayTime'),
  busiestHour: $('#busiestHour'),
  busiestHourValue: $('#busiestHourValue'),
  nodeStatus: $('#nodeStatus'),
  nodeDetails: $('#nodeDetails'),
  serverCount: $('#serverCount'),
  guildList: $('#guildList'),
  botGuilds: $('#botGuilds'),
  botUsers: $('#botUsers'),
  botUptime: $('#botUptime'),
  botMemory: $('#botMemory'),
  nodePlayers: $('#nodePlayers'),
  nodeLoad: $('#nodeLoad'),
  toast: $('#toast'),
  listenersChart: $('#listenersChart'),
  sessionsChart: $('#sessionsChart'),
  hourlyChart: $('#hourlyChart'),
  dailyChart: $('#dailyChart')
};

const numberFmt = new Intl.NumberFormat('it-IT');
const timeFmt = new Intl.DateTimeFormat('it-IT', {
  hour: '2-digit',
  minute: '2-digit'
});
const dateTimeFmt = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
});

let lastPayload = null;
let refreshTimer = null;

const setText = (el, value) => {
  if (el) el.textContent = value;
};

const fmtNumber = (value) => numberFmt.format(Number(value || 0));

const fmtTime = (timestamp) => {
  const value = Number(timestamp || 0);
  if (!value) return '-';
  return timeFmt.format(new Date(value));
};

const fmtDateTime = (timestamp) => {
  const value = Number(timestamp || 0);
  if (!value) return '-';
  return dateTimeFmt.format(new Date(value));
};

const fmtDuration = (ms) => {
  const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) return `${days}g ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const fmtBytes = (bytes) => {
  const value = Number(bytes || 0);
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(0)} MB`;
  return `${(value / 1024).toFixed(0)} KB`;
};

const showToast = (message) => {
  setText(els.toast, message);
  els.toast?.classList.remove('hidden');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast?.classList.add('hidden'), 4200);
};

const setupCanvas = (canvas) => {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  return {
    ctx,
    width: rect.width,
    height: rect.height
  };
};

const drawEmpty = (ctx, width, height, label = 'Nessun dato disponibile') => {
  ctx.fillStyle = 'rgba(155, 177, 209, 0.85)';
  ctx.font = '700 14px SpotifyMixUI, system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(label, width / 2, height / 2);
};

const drawGrid = (ctx, width, height, padding) => {
  ctx.strokeStyle = 'rgba(123, 179, 255, 0.12)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = padding + ((height - padding * 2) * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }
};

const drawRoundedRect = (ctx, x, y, width, height, radius) => {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
};

const drawLine = (ctx, points, getter, color, width, height, padding, maxValue, fill = false) => {
  if (!points.length) return;

  const xFor = (index) => {
    if (points.length === 1) return padding;
    return padding + ((width - padding * 2) * index) / (points.length - 1);
  };
  const yFor = (point) => {
    const value = Number(getter(point) || 0);
    return height - padding - (value / maxValue) * (height - padding * 2);
  };

  ctx.beginPath();
  points.forEach((point, index) => {
    const x = xFor(index);
    const y = yFor(point);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  if (fill) {
    const gradient = ctx.createLinearGradient(0, padding, 0, height - padding);
    gradient.addColorStop(0, 'rgba(39, 211, 255, 0.22)');
    gradient.addColorStop(1, 'rgba(39, 211, 255, 0.01)');
    ctx.lineTo(xFor(points.length - 1), height - padding);
    ctx.lineTo(xFor(0), height - padding);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    points.forEach((point, index) => {
      const x = xFor(index);
      const y = yFor(point);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
};

const drawLineChart = (canvas, points, series) => {
  const { ctx, width, height } = setupCanvas(canvas);
  const padding = 28;
  const values = points.flatMap((point) => series.map((item) => Number(item.get(point) || 0)));
  const maxValue = Math.max(1, ...values);

  drawGrid(ctx, width, height, padding);
  if (!points.length) {
    drawEmpty(ctx, width, height);
    return;
  }

  series.forEach((item, index) => {
    drawLine(ctx, points, item.get, item.color, width, height, padding, maxValue, index === 0);
  });

  ctx.fillStyle = 'rgba(155, 177, 209, 0.75)';
  ctx.font = '700 11px SpotifyMixUI, system-ui';
  ctx.textAlign = 'left';
  ctx.fillText(fmtNumber(maxValue), padding, padding - 8);
  ctx.textAlign = 'right';
  ctx.fillText(fmtDateTime(points[points.length - 1]?.timestamp), width - padding, height - 8);
};

const drawBarChart = (canvas, items, getValue, getLabel) => {
  const { ctx, width, height } = setupCanvas(canvas);
  const padding = 28;
  const maxValue = Math.max(1, ...items.map((item) => Number(getValue(item) || 0)));
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const gap = 5;
  const barWidth = Math.max(4, chartWidth / Math.max(items.length, 1) - gap);

  drawGrid(ctx, width, height, padding);
  if (!items.length) {
    drawEmpty(ctx, width, height);
    return;
  }

  items.forEach((item, index) => {
    const value = Number(getValue(item) || 0);
    const x = padding + index * (barWidth + gap);
    const barHeight = (value / maxValue) * chartHeight;
    const y = height - padding - barHeight;
    const gradient = ctx.createLinearGradient(0, y, 0, height - padding);
    gradient.addColorStop(0, 'rgba(39, 211, 255, 0.95)');
    gradient.addColorStop(1, 'rgba(75, 141, 255, 0.45)');
    ctx.fillStyle = gradient;
    drawRoundedRect(ctx, x, y, barWidth, Math.max(2, barHeight), 7);
    ctx.fill();

    if (items.length <= 14 || index % 3 === 0) {
      ctx.fillStyle = 'rgba(155, 177, 209, 0.8)';
      ctx.font = '700 10px SpotifyMixUI, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(getLabel(item), x + barWidth / 2, height - 8);
    }
  });
};

const renderGuilds = (guilds) => {
  const rows = Array.isArray(guilds) ? guilds : [];
  setText(els.serverCount, `${rows.length} server`);

  if (!rows.length) {
    els.guildList.innerHTML = '<div class="guild-row"><div class="cover-fallback">T</div><div><div class="guild-title">Nessuna sessione live</div><div class="guild-meta">Appena qualcuno ascolta musica comparira qui.</div></div></div>';
    return;
  }

  els.guildList.innerHTML = rows
    .map((guild) => {
      const current = guild.current || {};
      const cover = current.thumbnail
        ? `<img src="${escapeHtml(current.thumbnail)}" alt="cover" loading="lazy" />`
        : '<div class="cover-fallback">T</div>';
      return `
        <div class="guild-row">
          ${cover}
          <div>
            <div class="guild-title">${escapeHtml(guild.guildName || guild.guildId || 'Server')}</div>
            <div class="guild-meta">${escapeHtml(guild.voiceChannelName || 'Voice')} · ${fmtNumber(guild.listeners)} ascoltatori</div>
            <div class="track-title">${escapeHtml(current.title || 'Nessun brano in play')}</div>
            <div class="track-meta">${escapeHtml(current.author || '-')} · ${escapeHtml(current.positionText || '0:00')} / ${escapeHtml(current.durationText || '0:00')}</div>
            <div class="pill-row">
              <span class="mini-pill">${fmtNumber(guild.queueSize)} in coda</span>
              <span class="mini-pill">vol ${fmtNumber(guild.volume)}%</span>
              <span class="mini-pill">loop ${escapeHtml(guild.loop || 'off')}</span>
              <span class="mini-pill">${guild.paused ? 'pausa' : 'play'}</span>
            </div>
          </div>
        </div>
      `;
    })
    .join('');
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const renderPayload = (payload) => {
  lastPayload = payload;
  const now = payload.now || {};
  const summary = payload.summary || {};
  const bot = now.bot || {};
  const lavalink = now.lavalink || {};
  const cpuLoad = Number(lavalink.cpu?.lavalinkLoad || 0);

  setText(els.liveListeners, fmtNumber(now.listeners));
  setText(els.connectedListeners, `${fmtNumber(now.connectedListeners)} utenti in vocali attive`);
  setText(els.playingSessions, fmtNumber(now.playingSessions));
  setText(els.activeSessions, `${fmtNumber(now.activeSessions)} sessioni totali`);
  setText(els.queuedTracks, fmtNumber(now.queuedTracks));
  setText(els.pausedSessions, `${fmtNumber(now.pausedSessions)} sessioni in pausa`);
  setText(els.peakToday, fmtNumber(summary.peakToday?.listeners));
  setText(els.peakTodayTime, summary.peakToday?.timestamp ? `alle ${fmtTime(summary.peakToday.timestamp)}` : '-');
  setText(els.busiestHour, `${summary.busiestHour?.hour || '--'}:00`);
  setText(els.busiestHourValue, `${fmtNumber(summary.busiestHour?.listeners)} ascoltatori`);
  setText(els.nodeStatus, lavalink.connected ? 'Online' : 'Offline');
  setText(els.nodeDetails, lavalink.connected ? `${lavalink.name || 'MainNode'} · ${fmtDuration(lavalink.uptime)}` : 'Nessun nodo disponibile');
  setText(els.botGuilds, fmtNumber(bot.guilds));
  setText(els.botUsers, fmtNumber(bot.users));
  setText(els.botUptime, fmtDuration(bot.uptime));
  setText(els.botMemory, fmtBytes(bot.memoryRss));
  setText(els.nodePlayers, `${fmtNumber(lavalink.playingPlayers)} / ${fmtNumber(lavalink.players)}`);
  setText(els.nodeLoad, `${Math.round(cpuLoad * 100)}%`);
  setText(els.lastUpdate, `Aggiornato ${fmtDateTime(payload.generatedAt)} · refresh automatico ogni 15s`);

  renderGuilds(payload.topGuilds || now.guilds || []);

  drawLineChart(els.listenersChart, payload.timeline || [], [
    { get: (point) => point.listeners, color: '#27d3ff' },
    { get: (point) => point.connectedListeners, color: '#4b8dff' }
  ]);
  drawLineChart(els.sessionsChart, payload.timeline || [], [
    { get: (point) => point.playingSessions, color: '#27d3ff' },
    { get: (point) => point.activeSessions, color: '#4b8dff' }
  ]);
  drawBarChart(
    els.hourlyChart,
    payload.hourlyPeaks || [],
    (item) => item.listeners,
    (item) => item.hour
  );
  drawBarChart(
    els.dailyChart,
    payload.dailyPeaks || [],
    (item) => item.listeners,
    (item) => String(item.day || '').slice(5)
  );
};

const loadStats = async () => {
  try {
    const range = els.rangeSelect?.value || '24h';
    const response = await fetch(`/api/admin/stats?range=${encodeURIComponent(range)}`, {
      credentials: 'same-origin'
    });

    if (response.status === 401) {
      window.location.href = `/auth/discord/login?redirect=${encodeURIComponent('/admin')}`;
      return;
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Errore caricamento statistiche');

    renderPayload(payload);
  } catch (error) {
    showToast(error.message || 'Errore caricamento statistiche');
  }
};

els.refreshBtn?.addEventListener('click', loadStats);
els.rangeSelect?.addEventListener('change', loadStats);

window.addEventListener('resize', () => {
  if (!lastPayload) return;
  window.clearTimeout(window.__adminResizeTimer);
  window.__adminResizeTimer = window.setTimeout(() => renderPayload(lastPayload), 120);
});

loadStats();
refreshTimer = window.setInterval(loadStats, 15_000);
window.addEventListener('beforeunload', () => window.clearInterval(refreshTimer));
