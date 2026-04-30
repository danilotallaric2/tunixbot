const { SlashCommandBuilder } = require('discord.js');
const { requireActiveQueueAndVoice } = require('../utils/commandChecks');
const { baseEmbed, errorEmbed } = require('../utils/embeds');
const { getInteractionLocale, t } = require('../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a track from queue by index.')
    .setDescriptionLocalizations({ it: t('it', 'commands.removeDescription') })
    .addIntegerOption((option) =>
      option
        .setName('numero')
        .setDescription('Queue position')
        .setDescriptionLocalizations({ it: t('it', 'commands.optionIndex') })
        .setRequired(true)
        .setMinValue(1)
    ),
  async execute(interaction) {
    const queue = await requireActiveQueueAndVoice(interaction);
    if (!queue) return;

    const locale = getInteractionLocale(interaction);
    const index = interaction.options.getInteger('numero', true);

    try {
      const removed = await interaction.client.musicManager.removeAt(interaction.guildId, index);
      await interaction.reply({
        embeds: [
          baseEmbed(t(locale, 'embeds.removeTitle'), 0xffc14d).setDescription(
            t(locale, 'embeds.removeMessage', { title: removed.title })
          )
        ]
      });
    } catch (error) {
      await interaction.reply({
        embeds: [errorEmbed(t(locale, 'embeds.removeErrorTitle'), error.message, locale)],
        ephemeral: true
      });
    }
  }
};
