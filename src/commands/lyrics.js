const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed } = require('../utils/embeds');
const { safeReply } = require('../utils/reply');
const { getInteractionLocale, t } = require('../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lyrics')
    .setDescription('Show lyrics of current track.')
    .setDescriptionLocalizations({ it: t('it', 'commands.lyricsDescription') }),
  async execute(interaction) {
    const locale = getInteractionLocale(interaction);

    try {
      await interaction.deferReply();
      const embed = await interaction.client.musicManager.getLyrics(interaction.guildId, locale);
      await safeReply(interaction, { embeds: [embed] });
    } catch (error) {
      await safeReply(interaction, {
        embeds: [errorEmbed(t(locale, 'embeds.lyricsUnavailableTitle'), error.message, locale)],
        ephemeral: true
      });
    }
  }
};
