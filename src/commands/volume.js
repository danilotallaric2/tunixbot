const { SlashCommandBuilder } = require('discord.js');
const { requireActiveQueueAndVoice } = require('../utils/commandChecks');
const { errorEmbed } = require('../utils/embeds');
const { getInteractionLocale, t } = require('../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Set playback volume (0-200).')
    .setDescriptionLocalizations({ it: t('it', 'commands.volumeDescription') })
    .addIntegerOption((option) =>
      option
        .setName('value')
        .setDescription('Volume value')
        .setDescriptionLocalizations({ it: t('it', 'commands.optionVolume') })
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(200)
    ),
  async execute(interaction) {
    const queue = await requireActiveQueueAndVoice(interaction);
    if (!queue) return;

    const locale = getInteractionLocale(interaction);
    const value = interaction.options.getInteger('value', true);

    try {
      await interaction.client.musicManager.setVolume(interaction.guildId, value);
      await interaction.reply({ embeds: [interaction.client.musicManager.buildVolumeEmbed(value, locale)] });
    } catch (error) {
      await interaction.reply({
        embeds: [errorEmbed(t(locale, 'errors.commandTitle'), error.message, locale)],
        ephemeral: true
      });
    }
  }
};
