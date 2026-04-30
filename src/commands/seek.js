const { SlashCommandBuilder } = require('discord.js');
const { requireActiveQueueAndVoice } = require('../utils/commandChecks');
const { errorEmbed, baseEmbed } = require('../utils/embeds');
const { parseTimeToMs, formatDuration } = require('../utils/time');
const { getInteractionLocale, t } = require('../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('seek')
    .setDescription('Move playback position (e.g. 90 or 1:30).')
    .setDescriptionLocalizations({ it: t('it', 'commands.seekDescription') })
    .addStringOption((option) =>
      option
        .setName('tempo')
        .setDescription('Seconds or format mm:ss / hh:mm:ss')
        .setDescriptionLocalizations({ it: t('it', 'commands.optionTime') })
        .setRequired(true)
    ),
  async execute(interaction) {
    const queue = await requireActiveQueueAndVoice(interaction);
    if (!queue) return;

    const locale = getInteractionLocale(interaction);
    const timeInput = interaction.options.getString('tempo', true);
    const ms = parseTimeToMs(timeInput);

    if (ms === null) {
      await interaction.reply({
        embeds: [errorEmbed(t(locale, 'embeds.seekInvalidTitle'), t(locale, 'embeds.seekInvalidMessage'), locale)],
        ephemeral: true
      });
      return;
    }

    try {
      await interaction.client.musicManager.seek(interaction.guildId, ms);
      await interaction.reply({
        embeds: [
          baseEmbed(t(locale, 'embeds.seekTitle'), 0x27d3ff).setDescription(
            t(locale, 'embeds.seekMessage', { time: formatDuration(ms) })
          )
        ]
      });
    } catch (error) {
      await interaction.reply({
        embeds: [errorEmbed(t(locale, 'embeds.seekErrorTitle'), error.message, locale)],
        ephemeral: true
      });
    }
  }
};
