const { SlashCommandBuilder } = require('discord.js');
const { requireActiveQueueAndVoice } = require('../utils/commandChecks');
const { baseEmbed, errorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('pause').setDescription('Mette in pausa il brano corrente.'),
  async execute(interaction) {
    const queue = await requireActiveQueueAndVoice(interaction);
    if (!queue) return;

    try {
      await interaction.client.musicManager.pause(interaction.guildId);
      await interaction.reply({
        embeds: [baseEmbed('Pausa', 0x27d3ff).setDescription('Riproduzione in pausa.')]
      });
    } catch (error) {
      await interaction.reply({ embeds: [errorEmbed('Errore', error.message)], ephemeral: true });
    }
  }
};
