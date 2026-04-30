const { SlashCommandBuilder } = require('discord.js');
const { requireActiveQueueAndVoice } = require('../utils/commandChecks');
const { baseEmbed, errorEmbed } = require('../utils/embeds');
const { getInteractionLocale, t } = require('../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause current track.')
    .setDescriptionLocalizations({ it: t('it', 'commands.pauseDescription') }),
  async execute(interaction) {
    const queue = await requireActiveQueueAndVoice(interaction);
    if (!queue) return;

    const locale = getInteractionLocale(interaction);

    try {
      await interaction.client.musicManager.pause(interaction.guildId);
      await interaction.reply({
        embeds: [baseEmbed(t(locale, 'embeds.pauseTitle'), 0x27d3ff).setDescription(t(locale, 'embeds.pauseMessage'))]
      });
    } catch (error) {
      await interaction.reply({
        embeds: [errorEmbed(t(locale, 'errors.commandTitle'), error.message, locale)],
        ephemeral: true
      });
    }
  }
};
