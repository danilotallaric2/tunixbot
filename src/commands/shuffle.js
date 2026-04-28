const { SlashCommandBuilder } = require('discord.js');
const { requireActiveQueueAndVoice } = require('../utils/commandChecks');
const { baseEmbed, errorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('shuffle').setDescription('Mischia la coda.'),
  async execute(interaction) {
    const queue = await requireActiveQueueAndVoice(interaction);
    if (!queue) return;

    try {
      await interaction.client.musicManager.shuffle(interaction.guildId);
      await interaction.reply({ embeds: [baseEmbed('Shuffle', 0x27d3ff).setDescription('Coda mischiata con successo.')] });
    } catch (error) {
      await interaction.reply({ embeds: [errorEmbed('Errore Shuffle', error.message)], ephemeral: true });
    }
  }
};
