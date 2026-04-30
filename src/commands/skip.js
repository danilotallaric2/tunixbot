const { SlashCommandBuilder } = require('discord.js');
const { requireActiveQueueAndVoice } = require('../utils/commandChecks');
const { baseEmbed, errorEmbed } = require('../utils/embeds');
const { getInteractionLocale, t } = require('../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip current track.')
    .setDescriptionLocalizations({ it: t('it', 'commands.skipDescription') }),
  async execute(interaction) {
    const queue = await requireActiveQueueAndVoice(interaction);
    if (!queue) return;

    const locale = getInteractionLocale(interaction);

    try {
      await interaction.client.musicManager.skip(interaction.guildId);
      await interaction.reply({
        embeds: [baseEmbed(t(locale, 'embeds.skipButton'), 0xffc14d).setDescription(t(locale, 'embeds.skipMessage'))]
      });
    } catch (error) {
      await interaction.reply({
        embeds: [errorEmbed(t(locale, 'errors.commandTitle'), error.message, locale)],
        ephemeral: true
      });
    }
  }
};
