const fs = require('fs');
const path = require('path');

class SpotifyUserStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.writeChain = Promise.resolve();
    this.ensureFile();
  }

  ensureFile() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify({ users: {} }, null, 2), 'utf8');
    }
  }

  readData() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return { users: {} };
      if (!parsed.users || typeof parsed.users !== 'object') parsed.users = {};
      return parsed;
    } catch {
      return { users: {} };
    }
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

  get(discordUserId) {
    const data = this.readData();
    return data.users[String(discordUserId)] || null;
  }

  async set(discordUserId, value) {
    const data = this.readData();
    data.users[String(discordUserId)] = value;
    await this.writeData(data);
  }

  async delete(discordUserId) {
    const data = this.readData();
    delete data.users[String(discordUserId)];
    await this.writeData(data);
  }
}

module.exports = SpotifyUserStore;
