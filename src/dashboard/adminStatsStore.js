const fs = require('fs');
const path = require('path');

class AdminStatsStore {
  constructor(filePath, options = {}) {
    this.filePath = filePath;
    this.retentionMs = Math.max(60_000, Number(options.retentionMs || 1000 * 60 * 60 * 24 * 14));
    this.maxSamples = Math.max(100, Number(options.maxSamples || 25_000));
    this.writeDebounceMs = Math.max(50, Number(options.writeDebounceMs || 750));
    this.writeTimer = null;
    this.data = this.load();
  }

  load() {
    try {
      if (!fs.existsSync(this.filePath)) return { samples: [] };
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      return {
        samples: Array.isArray(parsed?.samples) ? parsed.samples : []
      };
    } catch {
      return { samples: [] };
    }
  }

  getSamples() {
    return Array.isArray(this.data.samples) ? this.data.samples : [];
  }

  pushSample(sample) {
    if (!sample || typeof sample !== 'object') return;
    const normalized = {
      ...sample,
      timestamp: Number(sample.timestamp || Date.now())
    };

    this.data.samples = [...this.getSamples(), normalized];
    this.prune(normalized.timestamp);
    this.scheduleWrite();
  }

  prune(now = Date.now()) {
    const cutoff = Number(now) - this.retentionMs;
    let samples = this.getSamples().filter((sample) => Number(sample?.timestamp || 0) >= cutoff);

    if (samples.length > this.maxSamples) {
      samples = samples.slice(samples.length - this.maxSamples);
    }

    this.data.samples = samples;
  }

  scheduleWrite() {
    if (this.writeTimer) clearTimeout(this.writeTimer);
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null;
      this.flush();
    }, this.writeDebounceMs);
    this.writeTimer.unref?.();
  }

  flush() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const tmpPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), 'utf8');
    fs.renameSync(tmpPath, this.filePath);
  }
}

module.exports = AdminStatsStore;
