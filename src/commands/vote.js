const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { baseEmbed } = require('../utils/embeds');
const { getInteractionLocale, t } = require('../utils/i18n');

const VOTE_URL = 'https://top.gg/bot/1498240978627203173';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vote')
    .setNameLocalizations({ it: 'vota' })
    .setDescription('Support TunixBot by voting on Top.gg.')
    .setDescriptionLocalizations({ it: t('it', 'commands.voteDescription') }),
  async execute(interaction) {
    const locale = getInteractionLocale(interaction);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel(t(locale, 'embeds.voteButton'))
        .setStyle(ButtonStyle.Link)
        .setURL(VOTE_URL)
    );

    await interaction.reply({
      embeds: [
        baseEmbed(t(locale, 'embeds.voteTitle')).setDescription(
          t(locale, 'embeds.voteMessage', { url: VOTE_URL })
        )
      ],
      components: [row],
      ephemeral: true
    });
  }
};
