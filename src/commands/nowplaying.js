const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed, nowPlayingEmbed, nowPlayingControls, volumeControls } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('nowplaying').setDescription('Mostra il brano attualmente in riproduzione.'),
  async execute(interaction) {
    const now = interaction.client.musicManager.getNowPlayingData(interaction.guildId);

    if (!now) {
      await interaction.reply({
        embeds: [errorEmbed('Nessun Brano', 'Non c e nulla in riproduzione al momento.')],
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      embeds: [nowPlayingEmbed(now.track, now.state)],
      components: [nowPlayingControls({ paused: now.state.paused, loop: now.state.loop }), volumeControls()]
    });
  }
};
