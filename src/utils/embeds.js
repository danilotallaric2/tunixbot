const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const config = require('../config');
const { formatDuration, buildProgressBar } = require('./time');
const { t, normalizeLocale, localizeErrorMessage } = require('./i18n');

const baseEmbed = (title, color = config.theme.primary) =>
  new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setFooter({ text: config.theme.footer })
    .setTimestamp();

const normalizeErrorDescription = (description, locale = 'en') => {
  const localized = localizeErrorMessage(locale, description, 'errors.genericOperation');
  if (typeof localized === 'string' && localized.trim()) return localized.trim();
  return t(locale, 'errors.genericOperation');
};

const errorEmbed = (title, description, locale = 'en') => {
  const resolvedLocale = normalizeLocale(locale);
  const finalTitle = title || t(resolvedLocale, 'errors.commandTitle');
  return baseEmbed(finalTitle, config.theme.error).setDescription(normalizeErrorDescription(description, resolvedLocale));
};

const missingPermsEmbed = (missing, locale = 'en') => {
  const resolvedLocale = normalizeLocale(locale);
  const permsList = missing.map((p) => `- ${p}`).join('\n');

  return baseEmbed(t(resolvedLocale, 'permissions.missingPermsTitle'), config.theme.warning).setDescription(
    t(resolvedLocale, 'permissions.missingPermsMessage', { perms: permsList })
  );
};

const nowPlayingEmbed = (track, state, locale = 'en') => {
  const resolvedLocale = normalizeLocale(locale);
  const embed = baseEmbed(t(resolvedLocale, 'embeds.nowPlayingTitle'), config.theme.secondary)
    .setDescription(`**${track.title}**\n${track.author}`)
    .addFields(
      {
        name: t(resolvedLocale, 'embeds.durationField'),
        value: formatDuration(track.duration),
        inline: true
      },
      {
        name: t(resolvedLocale, 'embeds.requestedByField'),
        value: `<@${track.requestedBy}>`,
        inline: true
      },
      {
        name: t(resolvedLocale, 'embeds.volumeField'),
        value: `${state.volume}%`,
        inline: true
      },
      {
        name: t(resolvedLocale, 'embeds.progressField'),
        value: `${buildProgressBar(state.position, track.duration)}\n${formatDuration(state.position)} / ${formatDuration(track.duration)}`
      }
    );

  if (track.thumbnail) embed.setThumbnail(track.thumbnail);
  if (track.url) embed.setURL(track.url);

  return embed;
};

const queueEmbed = (tracks, page, pageSize, currentTrack, locale = 'en') => {
  const resolvedLocale = normalizeLocale(locale);
  const start = page * pageSize;
  const sliced = tracks.slice(start, start + pageSize);

  const description = sliced.length
    ? sliced
        .map((tItem, idx) => {
          const n = start + idx + 1;
          return `**${n}.** ${tItem.title} - ${tItem.author} \`(${formatDuration(tItem.duration)})\``;
        })
        .join('\n')
    : t(resolvedLocale, 'embeds.queueEmpty');

  const embed = baseEmbed(t(resolvedLocale, 'embeds.queueTitle'), config.theme.primary)
    .setDescription(description)
    .addFields({
      name: t(resolvedLocale, 'embeds.queueNowPlayingField'),
      value: currentTrack
        ? `**${currentTrack.title}** - ${currentTrack.author}`
        : t(resolvedLocale, 'embeds.noTrackInline')
    });

  return embed;
};

const helpEmbed = (locale = 'en') => {
  const resolvedLocale = normalizeLocale(locale);

  const lines =
    resolvedLocale === 'it'
      ? [
          '`/join` - Fai entrare TunixBot in vocale',
          '`/play <query/link>` - Riproduci da YouTube/Spotify',
          '`/pause` - Pausa',
          '`/resume` - Riprendi',
          '`/skip` - Salta',
          '`/stop` - Ferma e svuota coda',
          '`/queue` - Mostra coda',
          '`/nowplaying` - Mostra brano attuale',
          '`/volume <0-200>` - Regola volume',
          '`/loop off/song/queue` - Imposta loop',
          '`/shuffle` - Mischia coda',
          '`/remove <numero>` - Rimuovi dalla coda',
          '`/clearqueue` - Cancella coda',
          '`/seek <tempo>` - Vai a tempo (es. 1:30)',
          '`/lyrics` - Cerca testo del brano attuale',
          '`/filter bassboost/nightcore/vaporwave/8d/clear` - Filtri audio',
          '`/help` - Questo menu'
        ]
      : [
          '`/join` - Make TunixBot join your voice channel',
          '`/play <query/link>` - Play from YouTube/Spotify',
          '`/pause` - Pause playback',
          '`/resume` - Resume playback',
          '`/skip` - Skip track',
          '`/stop` - Stop and clear queue',
          '`/queue` - Show queue',
          '`/nowplaying` - Show current track',
          '`/volume <0-200>` - Set volume',
          '`/loop off/song/queue` - Set loop mode',
          '`/shuffle` - Shuffle queue',
          '`/remove <number>` - Remove from queue',
          '`/clearqueue` - Clear queue',
          '`/seek <time>` - Jump to time (e.g. 1:30)',
          '`/lyrics` - Get lyrics for current track',
          '`/filter bassboost/nightcore/vaporwave/8d/clear` - Audio filters',
          '`/help` - This menu'
        ];

  return baseEmbed(t(resolvedLocale, 'embeds.helpTitle'), config.theme.primary).setDescription(lines.join('\n'));
};

const volumeEmbed = (volume, locale = 'en') =>
  baseEmbed(t(locale, 'embeds.volumeUpdatedTitle'), config.theme.secondary).setDescription(
    t(locale, 'embeds.volumeUpdatedMessage', { volume })
  );

const filtersEmbed = (filterName, locale = 'en') =>
  baseEmbed(t(locale, 'embeds.filterTitle'), config.theme.secondary).setDescription(
    t(locale, 'embeds.filterMessage', { filter: filterName })
  );

const playlistLoadedEmbed = (name, count, locale = 'en') => {
  const suffix = name ? (normalizeLocale(locale) === 'it' ? ` dalla playlist **${name}**` : ` from playlist **${name}**`) : '';

  return baseEmbed(t(locale, 'embeds.playlistLoadedTitle'), config.theme.success).setDescription(
    t(locale, 'embeds.playlistLoadedMessage', {
      count,
      suffix
    })
  );
};

const nowPlayingControls = (queueState, locale = 'en') => {
  const resolvedLocale = normalizeLocale(locale);
  const pauseLabel = queueState.paused
    ? t(resolvedLocale, 'embeds.resumeButton')
    : t(resolvedLocale, 'embeds.pauseButton');

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tunixbot:toggle_pause').setLabel(pauseLabel).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('tunixbot:skip').setLabel(t(resolvedLocale, 'embeds.skipButton')).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tunixbot:stop').setLabel(t(resolvedLocale, 'embeds.stopButton')).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('tunixbot:queue').setLabel(t(resolvedLocale, 'embeds.queueButton')).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('tunixbot:loop')
      .setLabel(t(resolvedLocale, 'embeds.loopButton', { loop: queueState.loop }))
      .setStyle(ButtonStyle.Primary)
  );
};

const volumeControls = (locale = 'en') => {
  const resolvedLocale = normalizeLocale(locale);
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tunixbot:vol_down').setLabel(t(resolvedLocale, 'embeds.volumeDownButton')).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tunixbot:vol_up').setLabel(t(resolvedLocale, 'embeds.volumeUpButton')).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setLabel(t(resolvedLocale, 'embeds.dashboardButton')).setStyle(ButtonStyle.Link).setURL(config.dashboard.publicUrl)
  );
};

module.exports = {
  baseEmbed,
  errorEmbed,
  missingPermsEmbed,
  nowPlayingEmbed,
  queueEmbed,
  helpEmbed,
  volumeEmbed,
  filtersEmbed,
  playlistLoadedEmbed,
  nowPlayingControls,
  volumeControls
};
