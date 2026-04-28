const formatDuration = (ms) => {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return 'LIVE';
  if (ms < 0) return '0:00';
  if (ms === 0) return '0:00';

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const parseTimeToMs = (input) => {
  const cleaned = input.trim().toLowerCase();

  if (/^\d+$/.test(cleaned)) {
    return Number.parseInt(cleaned, 10) * 1000;
  }

  const parts = cleaned.split(':').map((p) => Number.parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return null;

  if (parts.length === 2) {
    const [m, s] = parts;
    return (m * 60 + s) * 1000;
  }

  if (parts.length === 3) {
    const [h, m, s] = parts;
    return (h * 3600 + m * 60 + s) * 1000;
  }

  return null;
};

const buildProgressBar = (position, duration, size = 18) => {
  if (!duration || duration <= 0) return '[LIVE STREAM]';

  const safePosition = Math.max(0, Math.min(position, duration));
  const progress = safePosition / duration;
  const cursor = Math.max(0, Math.min(size - 1, Math.round(progress * (size - 1))));

  const chars = Array.from({ length: size }, (_, i) => {
    if (i < cursor) return '=';
    if (i === cursor) return '>';
    return '-';
  });

  return `[${chars.join('')}]`;
};

module.exports = {
  formatDuration,
  parseTimeToMs,
  buildProgressBar
};
