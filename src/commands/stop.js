const { SlashCommandBuilder } = require('discord.js');
const { requireActiveQueueAndVoice } = require('../utils/commandChecks');
const { baseEmbed, errorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('stop').setDescription('Ferma la riproduzione e svuota la coda (resta in vocale).'),
  async execute(interaction) {
    const queue = await requireActiveQueueAndVoice(interaction);
    if (!queue) return;

    try {
      await interaction.client.musicManager.stop(interaction.guildId);
      await interaction.reply({
        embeds: [baseEmbed('Stop', 0xff4d6d).setDescription('Riproduzione fermata e coda rimossa. Rimango nel canale vocale.')]
      });
    } catch (error) {
      await interaction.reply({ embeds: [errorEmbed('Errore', error.message)], ephemeral: true });
    }
  }
};
