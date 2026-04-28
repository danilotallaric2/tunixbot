const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const config = require('../config');
const { formatDuration, buildProgressBar } = require('./time');

const baseEmbed = (title, color = config.theme.primary) =>
  new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setFooter({ text: config.theme.footer })
    .setTimestamp();

const normalizeErrorDescription = (description) => {
  if (typeof description === 'string' && description.trim()) return description.trim();
  if (description instanceof Error && typeof description.message === 'string' && description.message.trim()) {
    return description.message.trim();
  }
  return 'Si e verificato un errore durante l operazione.';
};

const errorEmbed = (title, description) =>
  baseEmbed(title, config.theme.error).setDescription(normalizeErrorDescription(description));

const missingPermsEmbed = (missing) =>
  baseEmbed('Permessi Mancanti', config.theme.warning).setDescription(
    `Mi servono questi permessi nel canale vocale:\n${missing.map((p) => `- ${p}`).join('\n')}`
  );

const nowPlayingEmbed = (track, state) => {
  const embed = baseEmbed('In Riproduzione', config.theme.secondary)
    .setDescription(`**${track.title}**\n${track.author}`)
    .addFields(
      {
        name: 'Durata',
        value: formatDuration(track.duration),
        inline: true
      },
      {
        name: 'Richiesto da',
        value: `<@${track.requestedBy}>`,
        inline: true
      },
      {
        name: 'Volume',
        value: `${state.volume}%`,
        inline: true
      },
      {
        name: 'Progresso',
        value: `${buildProgressBar(state.position, track.duration)}\n${formatDuration(state.position)} / ${formatDuration(track.duration)}`
      }
    );

  if (track.thumbnail) embed.setThumbnail(track.thumbnail);
  if (track.url) embed.setURL(track.url);

  return embed;
};

const queueEmbed = (tracks, page, pageSize, currentTrack) => {
  const start = page * pageSize;
  const sliced = tracks.slice(start, start + pageSize);

  const description = sliced.length
    ? sliced
        .map((t, idx) => {
          const n = start + idx + 1;
          return `**${n}.** ${t.title} - ${t.author} \`(${formatDuration(t.duration)})\``;
        })
        .join('\n')
    : 'La coda e vuota.';

  const embed = baseEmbed('Coda Musicale', config.theme.primary)
    .setDescription(description)
    .addFields({
      name: 'Ora in Riproduzione',
      value: currentTrack ? `**${currentTrack.title}** - ${currentTrack.author}` : 'Nessun brano'
    });

  return embed;
};

const helpEmbed = () =>
  baseEmbed('TunixBot Help', config.theme.primary).setDescription(
    [
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
    ].join('\n')
  );

const volumeEmbed = (volume) =>
  baseEmbed('Volume Aggiornato', config.theme.secondary).setDescription(`Volume impostato a **${volume}%**`);

const filtersEmbed = (filterName) =>
  baseEmbed('Filtro Audio', config.theme.secondary).setDescription(`Filtro attivo: **${filterName}**`);

const playlistLoadedEmbed = (name, count) =>
  baseEmbed('Playlist Caricata', config.theme.success).setDescription(
    `Aggiunti **${count}** brani${name ? ` dalla playlist **${name}**` : ''}.`
  );

const nowPlayingControls = (queueState) => {
  const pauseLabel = queueState.paused ? 'Resume' : 'Pause';

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tunixbot:toggle_pause').setLabel(pauseLabel).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('tunixbot:skip').setLabel('Skip').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tunixbot:stop').setLabel('Stop').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('tunixbot:queue').setLabel('Queue').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tunixbot:loop').setLabel(`Loop: ${queueState.loop}`).setStyle(ButtonStyle.Primary)
  );
};

const volumeControls = () =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tunixbot:vol_down').setLabel('Volume -10').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tunixbot:vol_up').setLabel('Volume +10').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setLabel('Dashboard').setStyle(ButtonStyle.Link).setURL(config.dashboard.publicUrl)
  );

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
