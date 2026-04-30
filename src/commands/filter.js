const { SlashCommandBuilder } = require('discord.js');
const { requireActiveQueueAndVoice } = require('../utils/commandChecks');
const { errorEmbed } = require('../utils/embeds');
const { getInteractionLocale, t } = require('../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('filter')
    .setDescription('Apply an audio filter.')
    .setDescriptionLocalizations({ it: t('it', 'commands.filterDescription') })
    .addStringOption((option) =>
      option
        .setName('nome')
        .setDescription('Filter')
        .setDescriptionLocalizations({ it: t('it', 'commands.optionFilter') })
        .setRequired(true)
        .addChoices(
          { name: 'bassboost', value: 'bassboost' },
          { name: 'nightcore', value: 'nightcore' },
          { name: 'vaporwave', value: 'vaporwave' },
          { name: '8d', value: '8d' },
          { name: 'clear', value: 'clear' }
        )
    ),
  async execute(interaction) {
    const queue = await requireActiveQueueAndVoice(interaction);
    if (!queue) return;

    const locale = getInteractionLocale(interaction);
    const name = interaction.options.getString('nome', true);

    try {
      await interaction.client.musicManager.applyFilter(interaction.guildId, name);
      await interaction.reply({ embeds: [interaction.client.musicManager.buildFilterEmbed(name, locale)] });
    } catch (error) {
      await interaction.reply({
        embeds: [errorEmbed(t(locale, 'embeds.filterErrorTitle'), error.message, locale)],
        ephemeral: true
      });
    }
  }
};
