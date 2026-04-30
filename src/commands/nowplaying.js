const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed, nowPlayingEmbed, nowPlayingControls, volumeControls } = require('../utils/embeds');
const { getInteractionLocale, t } = require('../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Show currently playing track.')
    .setDescriptionLocalizations({ it: t('it', 'commands.nowPlayingDescription') }),
  async execute(interaction) {
    const locale = getInteractionLocale(interaction);
    const now = interaction.client.musicManager.getNowPlayingData(interaction.guildId);

    if (!now) {
      await interaction.reply({
        embeds: [errorEmbed(t(locale, 'errors.noTrackTitle'), t(locale, 'errors.noTrackPlaying'), locale)],
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      embeds: [nowPlayingEmbed(now.track, now.state, locale)],
      components: [
        nowPlayingControls({ paused: now.state.paused, loop: now.state.loop }, locale),
        volumeControls(locale)
      ]
    });
  }
};
