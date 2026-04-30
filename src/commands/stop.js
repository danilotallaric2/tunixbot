const { SlashCommandBuilder } = require('discord.js');
const { requireActiveQueueAndVoice } = require('../utils/commandChecks');
const { baseEmbed, errorEmbed } = require('../utils/embeds');
const { getInteractionLocale, t } = require('../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop playback and clear queue (stay in voice channel).')
    .setDescriptionLocalizations({ it: t('it', 'commands.stopDescription') }),
  async execute(interaction) {
    const queue = await requireActiveQueueAndVoice(interaction);
    if (!queue) return;

    const locale = getInteractionLocale(interaction);

    try {
      await interaction.client.musicManager.stop(interaction.guildId);
      await interaction.reply({
        embeds: [baseEmbed(t(locale, 'embeds.stopButton'), 0xff4d6d).setDescription(t(locale, 'embeds.stopMessage'))]
      });
    } catch (error) {
      await interaction.reply({
        embeds: [errorEmbed(t(locale, 'errors.commandTitle'), error.message, locale)],
        ephemeral: true
      });
    }
  }
};
