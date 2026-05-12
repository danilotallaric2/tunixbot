const { SlashCommandBuilder } = require('discord.js');
const { requireVoiceForPlay } = require('../utils/commandChecks');
const { errorEmbed } = require('../utils/embeds');
const { safeReply } = require('../utils/reply');
const { getInteractionLocale, t } = require('../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play music from query or URL (YouTube/Spotify).')
    .setDescriptionLocalizations({ it: t('it', 'commands.playDescription') })
    .addStringOption((option) =>
      option
        .setName('query')
        .setDescription('Title, YouTube URL or Spotify URL')
        .setDescriptionLocalizations({ it: t('it', 'commands.optionQuery') })
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('source')
        .setDescription('Search source to use when query is not a link')
        .setDescriptionLocalizations({ it: t('it', 'commands.optionSource') })
        .setRequired(false)
        .addChoices(
          { name: 'Spotify', value: 'spotify' },
          { name: 'YouTube Music', value: 'youtube_music' },
          { name: 'YouTube', value: 'youtube' }
        )
    ),
  async execute(interaction) {
    const voiceChannel = await requireVoiceForPlay(interaction);
    if (!voiceChannel) return;

    const locale = getInteractionLocale(interaction);
    const query = interaction.options.getString('query', true);
    const source = interaction.options.getString('source') || 'spotify';

    try {
      await interaction.deferReply();
      await interaction.client.musicManager.play(interaction, query, voiceChannel, { source });
    } catch (error) {
      await safeReply(interaction, {
        embeds: [
          errorEmbed(
            t(locale, 'embeds.playFailedTitle'),
            error.message || t(locale, 'errors.genericOperation'),
            locale
          )
        ],
        ephemeral: true
      });
    }
  }
};
