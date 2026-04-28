const { SlashCommandBuilder } = require('discord.js');
const { requireActiveQueueAndVoice } = require('../utils/commandChecks');
const { baseEmbed, errorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('skip').setDescription('Salta il brano corrente.'),
  async execute(interaction) {
    const queue = await requireActiveQueueAndVoice(interaction);
    if (!queue) return;

    try {
      await interaction.client.musicManager.skip(interaction.guildId);
      await interaction.reply({
        embeds: [baseEmbed('Skip', 0xffc14d).setDescription('Brano saltato.')]
      });
    } catch (error) {
      await interaction.reply({ embeds: [errorEmbed('Errore', error.message)], ephemeral: true });
    }
  }
};
