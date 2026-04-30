const { SlashCommandBuilder } = require('discord.js');
const { requireActiveQueueAndVoice } = require('../utils/commandChecks');
const { baseEmbed, errorEmbed } = require('../utils/embeds');
const { getInteractionLocale, t } = require('../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Shuffle queue.')
    .setDescriptionLocalizations({ it: t('it', 'commands.shuffleDescription') }),
  async execute(interaction) {
    const queue = await requireActiveQueueAndVoice(interaction);
    if (!queue) return;

    const locale = getInteractionLocale(interaction);

    try {
      await interaction.client.musicManager.shuffle(interaction.guildId);
      await interaction.reply({
        embeds: [
          baseEmbed(t(locale, 'embeds.shuffleTitle'), 0x27d3ff).setDescription(t(locale, 'embeds.shuffleMessage'))
        ]
      });
    } catch (error) {
      await interaction.reply({
        embeds: [errorEmbed(t(locale, 'embeds.shuffleErrorTitle'), error.message, locale)],
        ephemeral: true
      });
    }
  }
};
