const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('queue').setDescription('Mostra la coda musicale.'),
  async execute(interaction) {
    const queue = interaction.client.musicManager.getQueue(interaction.guildId);

    if (!queue) {
      await interaction.reply({
        embeds: [errorEmbed('Coda Vuota', 'Non ci sono brani in coda.')],
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      embeds: [interaction.client.musicManager.getQueueEmbed(interaction.guildId)]
    });
  }
};
