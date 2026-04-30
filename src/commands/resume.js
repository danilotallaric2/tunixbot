const { SlashCommandBuilder } = require('discord.js');
const { requireActiveQueueAndVoice } = require('../utils/commandChecks');
const { baseEmbed, errorEmbed } = require('../utils/embeds');
const { getInteractionLocale, t } = require('../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume playback.')
    .setDescriptionLocalizations({ it: t('it', 'commands.resumeDescription') }),
  async execute(interaction) {
    const queue = await requireActiveQueueAndVoice(interaction);
    if (!queue) return;

    const locale = getInteractionLocale(interaction);

    try {
      await interaction.client.musicManager.resume(interaction.guildId);
      await interaction.reply({
        embeds: [baseEmbed(t(locale, 'embeds.resumeTitle'), 0x4afc8a).setDescription(t(locale, 'embeds.resumeMessage'))]
      });
    } catch (error) {
      await interaction.reply({
        embeds: [errorEmbed(t(locale, 'errors.commandTitle'), error.message, locale)],
        ephemeral: true
      });
    }
  }
};
