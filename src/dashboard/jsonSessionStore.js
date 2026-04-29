const fs = require('fs');
const path = require('path');
const session = require('express-session');

class JsonSessionStore extends session.Store {
  constructor(filePath, options = {}) {
    super();
    this.filePath = filePath;
    this.ttlMs = options.ttlMs || 1000 * 60 * 60 * 24 * 30;
    this.writeChain = Promise.resolve();
    this.ensureFile();
  }

  ensureFile() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify({ sessions: {} }, null, 2), 'utf8');
    }
  }

  readData() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return { sessions: {} };
      if (!parsed.sessions || typeof parsed.sessions !== 'object') parsed.sessions = {};
      return parsed;
    } catch {
      return { sessions: {} };
    }
  }

  getExpiry(sessionData) {
    const expires = sessionData?.cookie?.expires;
    const parsedExpires = expires ? new Date(expires).getTime() : 0;
    if (Number.isFinite(parsedExpires) && parsedExpires > 0) return parsedExpires;
    return Date.now() + this.ttlMs;
  }

  pruneExpired(data) {
    const now = Date.now();
    let changed = false;

    for (const [sid, entry] of Object.entries(data.sessions)) {
      if (!entry || Number(entry.expiresAt || 0) <= now) {
        delete data.sessions[sid];
        changed = true;
      }
    }

    return changed;
  }

  async writeData(data) {
    const payload = JSON.stringify(data, null, 2);
    this.writeChain = this.writeChain.then(async () => {
      const tmp = `${this.filePath}.tmp`;
      await fs.promises.writeFile(tmp, payload, 'utf8');
      await fs.promises.rename(tmp, this.filePath);
    });
    return this.writeChain;
  }

  get(sid, callback) {
    try {
      const data = this.readData();
      const changed = this.pruneExpired(data);
      const entry = data.sessions[String(sid)];

      if (changed) this.writeData(data).catch(() => {});
      callback(null, entry?.data || null);
    } catch (error) {
      callback(error);
    }
  }

  set(sid, sessionData, callback = () => {}) {
    const key = String(sid);
    const data = this.readData();
    this.pruneExpired(data);
    data.sessions[key] = {
      expiresAt: this.getExpiry(sessionData),
      data: sessionData
    };

    this.writeData(data).then(() => callback(null)).catch(callback);
  }

  touch(sid, sessionData, callback = () => {}) {
    const key = String(sid);
    const data = this.readData();
    const entry = data.sessions[key];

    if (entry) {
      const nextExpiresAt = this.getExpiry(sessionData);
      if (nextExpiresAt <= Number(entry.expiresAt || 0) + 60_000) {
        callback(null);
        return;
      }

      entry.expiresAt = nextExpiresAt;
      entry.data.cookie = sessionData.cookie;
      this.writeData(data).then(() => callback(null)).catch(callback);
      return;
    }

    callback(null);
  }

  destroy(sid, callback = () => {}) {
    const data = this.readData();
    delete data.sessions[String(sid)];
    this.writeData(data).then(() => callback(null)).catch(callback);
  }
}

module.exports = JsonSessionStore;
