const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { baseEmbed } = require('../utils/embeds');
const { getInteractionLocale, t } = require('../utils/i18n');

const SUPPORT_URL = 'https://discord.gg/WTpDF3Crsn';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('support')
    .setNameLocalizations({ it: 'supporto' })
    .setDescription('Get the official TunixBot support server.')
    .setDescriptionLocalizations({ it: t('it', 'commands.supportDescription') }),
  async execute(interaction) {
    const locale = getInteractionLocale(interaction);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel(t(locale, 'embeds.supportButton'))
        .setStyle(ButtonStyle.Link)
        .setURL(SUPPORT_URL)
    );

    await interaction.reply({
      embeds: [
        baseEmbed(t(locale, 'embeds.supportTitle')).setDescription(
          t(locale, 'embeds.supportMessage', { url: SUPPORT_URL })
        )
      ],
      components: [row],
      ephemeral: true
    });
  }
};
