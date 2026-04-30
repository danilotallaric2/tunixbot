const os = require('os');
const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const logger = require('../utils/logger');

const OWNER_ID = '918880214564630529';
const INFO_TRIGGER = ':info';

const stateLabel = (state) => {
  if (state === 0) return 'CONNECTING';
  if (state === 1) return 'CONNECTED';
  if (state === 2) return 'DISCONNECTING';
  if (state === 3) return 'DISCONNECTED';
  return `UNKNOWN(${state ?? '-'})`;
};

const formatBytes = (bytes) => {
  const size = Number(bytes || 0);
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exp = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / 1024 ** exp;
  return `${value.toFixed(value >= 100 || exp === 0 ? 0 : 2)} ${units[exp]}`;
};

const formatMs = (ms) => {
  const value = Math.max(0, Number(ms || 0));
  const totalSeconds = Math.floor(value / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
};

const trimField = (value, max = 1024) => {
  const text = String(value ?? '-');
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
};

const safeNum = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

const buildNodeFieldValue = (node, stats, info, statsSource, restStatsError, restInfoError) => {
  const lines = [];
  lines.push(`State: \`${stateLabel(node.state)}\``);
  lines.push(`Reconnects: \`${safeNum(node.reconnects, 0)}\``);
  lines.push(`Session ID: \`${node.sessionId ? 'yes' : 'no'}\``);
  lines.push(`WS: \`${node.ws ? 'open' : 'closed'}\``);
  lines.push(`Penalties: \`${safeNum(node.penalties, 0)}\``);
  lines.push(`Players(map): \`${safeNum(node.manager?.players?.size, 0)}\``);

  if (stats) {
    lines.push(`Stats Source: \`${statsSource}\``);
    lines.push(`Players: \`${safeNum(stats.players, 0)}\` (playing: \`${safeNum(stats.playingPlayers, 0)}\`)`);
    lines.push(`Node Uptime: \`${formatMs(safeNum(stats.uptime, 0))}\``);
    if (stats.memory) {
      lines.push(
        `Memory Used: \`${formatBytes(safeNum(stats.memory.used, 0))}\` / Allocated: \`${formatBytes(safeNum(stats.memory.allocated, 0))}\``
      );
    }
    if (stats.cpu) {
      const system = safeNum(stats.cpu.systemLoad, 0) * 100;
      const lavalink = safeNum(stats.cpu.lavalinkLoad, 0) * 100;
      lines.push(`CPU: system \`${system.toFixed(2)}%\` | lavalink \`${lavalink.toFixed(2)}%\` | cores \`${safeNum(stats.cpu.cores, 0)}\``);
    }
    if (stats.frameStats) {
      lines.push(
        `Frames: sent \`${safeNum(stats.frameStats.sent, 0)}\` | nulled \`${safeNum(stats.frameStats.nulled, 0)}\` | deficit \`${safeNum(stats.frameStats.deficit, 0)}\``
      );
    }
  } else {
    lines.push('Stats: `unavailable`');
  }

  if (info) {
    lines.push(`Lavalink: \`${info.version?.semver || '-'}\``);
    lines.push(`JVM: \`${info.jvm || '-'}\``);
    lines.push(`Lavaplayer: \`${info.lavaplayer || '-'}\``);
    lines.push(`Sources: \`${Array.isArray(info.sourceManagers) ? info.sourceManagers.length : 0}\``);
    lines.push(`Filters: \`${Array.isArray(info.filters) ? info.filters.length : 0}\``);
    lines.push(`Plugins: \`${Array.isArray(info.plugins) ? info.plugins.length : 0}\``);
    if (info.git?.branch || info.git?.commit) {
      lines.push(`Git: \`${info.git?.branch || '-'}\` @ \`${info.git?.commit || '-'}\``);
    }
  } else {
    lines.push('Node info: `unavailable`');
  }

  if (restStatsError) lines.push(`Stats error: \`${restStatsError}\``);
  if (restInfoError) lines.push(`Info error: \`${restInfoError}\``);

  return trimField(lines.join('\n'));
};

module.exports = {
  name: 'messageCreate',
  once: false,
  async execute(message) {
    if (!message?.inGuild?.()) return;
    if (message.author?.bot) return;

    const raw = String(message.content || '').trim();
    if (!/^:info(?:\s|$)/i.test(raw)) return;

    // Silent ignore for everyone except owner.
    if (message.author.id !== OWNER_ID) return;
    try {
      const client = message.client;
      const musicManager = client.musicManager;
      const shoukaku = musicManager?.shoukaku;
      const startMs = Date.now();

      const queues = [...(musicManager?.queues?.values?.() || [])];
      const activeQueues = queues.filter((q) => q.current).length;
      const pausedQueues = queues.filter((q) => q.paused).length;
      const loopingSong = queues.filter((q) => q.loopMode === 'song').length;
      const loopingQueue = queues.filter((q) => q.loopMode === 'queue').length;
      const totalWaitingTracks = queues.reduce((acc, q) => acc + (Array.isArray(q.tracks) ? q.tracks.length : 0), 0);
      const averageVolume = queues.length
        ? Math.round(queues.reduce((acc, q) => acc + safeNum(q.volume, config.music.defaultVolume), 0) / queues.length)
        : config.music.defaultVolume;

      const processUptimeMs = process.uptime() * 1000;
      const botUptimeMs = safeNum(client.uptime, processUptimeMs);
      const startedAtUnix = Math.floor((Date.now() - botUptimeMs) / 1000);
      const mem = process.memoryUsage();
      const load = os.loadavg();

      const nodes = shoukaku?.nodes instanceof Map ? [...shoukaku.nodes.values()] : [];
      const connectedNodes = nodes.filter((n) => n.state === 1).length;
      const idealNode = musicManager.getIdealNodeSafe?.() || null;

      const nodeDetails = await Promise.all(
        nodes.map(async (node) => {
          let stats = node.stats || null;
          let info = node.info || null;
          let statsSource = stats ? 'cached' : 'none';
          let restStatsError = null;
          let restInfoError = null;

          if (node.state === 1) {
            try {
              const freshStats = await node.rest.stats();
              if (freshStats) {
                stats = freshStats;
                statsSource = 'rest';
              }
            } catch (error) {
              restStatsError = error?.message || String(error);
            }

            if (!info) {
              try {
                const freshInfo = await node.rest.getLavalinkInfo();
                if (freshInfo) info = freshInfo;
              } catch (error) {
                restInfoError = error?.message || String(error);
              }
            }
          }

          return {
            node,
            stats,
            info,
            statsSource,
            restStatsError,
            restInfoError
          };
        })
      );

      const globalEmbed = new EmbedBuilder()
        .setColor(config.theme.secondary)
        .setTitle('TunixBot Internal Info')
        .setDescription(
          `Detailed diagnostics for <@${OWNER_ID}> only.\nRequested in <#${message.channelId}> • Generated <t:${Math.floor(
            Date.now() / 1000
          )}:R>`
        )
        .addFields(
          {
            name: 'Bot',
            value: trimField(
              [
                `Tag: \`${client.user?.tag || '-'}\``,
                `Bot ID: \`${client.user?.id || '-'}\``,
                `Created: <t:${Math.floor((client.user?.createdTimestamp || 0) / 1000)}:F>`,
                `Started: <t:${startedAtUnix}:F>`,
                `Uptime: \`${formatMs(botUptimeMs)}\``,
                `WebSocket Ping: \`${safeNum(client.ws?.ping, -1)} ms\``
              ].join('\n')
            ),
            inline: true
          },
          {
            name: 'Discord',
            value: trimField(
              [
                `Guilds: \`${safeNum(client.guilds?.cache?.size, 0)}\``,
                `Users (cache): \`${safeNum(client.users?.cache?.size, 0)}\``,
                `Channels (cache): \`${safeNum(client.channels?.cache?.size, 0)}\``,
                `Slash Commands: \`${safeNum(client.commands?.size, 0)}\``,
                `Dashboard: \`${config.dashboard.enabled ? 'enabled' : 'disabled'}\``,
                `Dashboard URL: \`${config.dashboard.publicUrl || '-'}\``
              ].join('\n')
            ),
            inline: true
          },
          {
            name: 'Music',
            value: trimField(
              [
                `Queue Sessions: \`${queues.length}\``,
                `Active Sessions: \`${activeQueues}\``,
                `Paused Sessions: \`${pausedQueues}\``,
                `Loop(song): \`${loopingSong}\``,
                `Loop(queue): \`${loopingQueue}\``,
                `Tracks Waiting: \`${totalWaitingTracks}\``,
                `Avg Volume: \`${averageVolume}%\``,
                `Spotify API: \`${musicManager?.spotify?.enabled ? 'enabled' : 'disabled'}\` (market: \`${config.spotify.market}\`)`
              ].join('\n')
            ),
            inline: true
          },
          {
            name: 'Runtime',
            value: trimField(
              [
                `Node.js: \`${process.version}\``,
                `Platform: \`${process.platform}\` (\`${process.arch}\`)`,
                `PID: \`${process.pid}\` | PPID: \`${process.ppid}\``,
                `Process Uptime: \`${formatMs(processUptimeMs)}\``,
                `Memory RSS: \`${formatBytes(mem.rss)}\``,
                `Heap Used: \`${formatBytes(mem.heapUsed)}\` / \`${formatBytes(mem.heapTotal)}\``,
                `External: \`${formatBytes(mem.external)}\``,
                `Host RAM Free: \`${formatBytes(os.freemem())}\` / \`${formatBytes(os.totalmem())}\``,
                `Host Uptime: \`${formatMs(os.uptime() * 1000)}\``,
                `Load Avg: \`${load.map((n) => n.toFixed(2)).join(' | ')}\``
              ].join('\n')
            )
          },
          {
            name: 'Lavalink Summary',
            value: trimField(
              [
                `Configured Nodes: \`${config.lavalink.nodes.length}\``,
                `Known Nodes: \`${nodes.length}\``,
                `Connected Nodes: \`${connectedNodes}\``,
                `Ideal Node: \`${idealNode?.name || 'none'}\``,
                `Shoukaku Players Map: \`${safeNum(shoukaku?.players?.size, 0)}\``,
                `Shoukaku Voice Connections: \`${safeNum(shoukaku?.connections?.size, 0)}\``,
                `Reconnect Tries: \`${config.lavalink.reconnectTries}\``,
                `Reconnect Interval: \`${config.lavalink.reconnectIntervalMs} ms\``,
                `Generated In: \`${Date.now() - startMs} ms\``
              ].join('\n')
            )
          }
        )
        .setFooter({ text: config.theme.footer })
        .setTimestamp();

      const nodeEmbeds = nodeDetails.map(({ node, stats, info, statsSource, restStatsError, restInfoError }) =>
        new EmbedBuilder()
          .setColor(node.state === 1 ? config.theme.success : config.theme.warning)
          .setTitle(`Lavalink Node • ${node.name}`)
          .addFields({
            name: 'Details',
            value: buildNodeFieldValue(node, stats, info, statsSource, restStatsError, restInfoError)
          })
          .setFooter({ text: config.theme.footer })
          .setTimestamp()
      );

      const messages = [globalEmbed, ...nodeEmbeds];
      // Discord allows max 10 embeds per message.
      const chunks = [];
      for (let i = 0; i < messages.length; i += 10) {
        chunks.push(messages.slice(i, i + 10));
      }

      for (const embeds of chunks) {
        await message.channel.send({ embeds });
      }
    } catch (error) {
      logger.error(`Failed to execute :info in guild ${message.guildId}`, error);
    }
  }
};
