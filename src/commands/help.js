const { SlashCommandBuilder } = require('discord.js');
const { helpEmbed } = require('../utils/embeds');
const { getInteractionLocale, t } = require('../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show TunixBot command guide.')
    .setDescriptionLocalizations({ it: t('it', 'commands.helpDescription') }),
  async execute(interaction) {
    const locale = getInteractionLocale(interaction);
    await interaction.reply({ embeds: [helpEmbed(locale)], ephemeral: true });
  }
};
