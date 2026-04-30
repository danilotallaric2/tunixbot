const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed } = require('../utils/embeds');
const { getInteractionLocale, t } = require('../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show music queue.')
    .setDescriptionLocalizations({ it: t('it', 'commands.queueDescription') }),
  async execute(interaction) {
    const locale = getInteractionLocale(interaction);
    const queue = interaction.client.musicManager.getQueue(interaction.guildId);

    if (!queue) {
      await interaction.reply({
        embeds: [errorEmbed(t(locale, 'embeds.queueTitle'), t(locale, 'embeds.queueEmpty'), locale)],
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      embeds: [interaction.client.musicManager.getQueueEmbed(interaction.guildId, 0, locale)]
    });
  }
};
