const { SlashCommandBuilder } = require('discord.js');
const { requireActiveQueueAndVoice } = require('../utils/commandChecks');
const { baseEmbed, errorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('clearqueue').setDescription('Svuota completamente la coda.'),
  async execute(interaction) {
    const queue = await requireActiveQueueAndVoice(interaction);
    if (!queue) return;

    try {
      await interaction.client.musicManager.clearQueue(interaction.guildId);
      await interaction.reply({ embeds: [baseEmbed('Coda Svuotata', 0xff4d6d).setDescription('La coda e stata cancellata.')] });
    } catch (error) {
      await interaction.reply({ embeds: [errorEmbed('Errore', error.message)], ephemeral: true });
    }
  }
};
