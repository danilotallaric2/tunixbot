const { SlashCommandBuilder } = require('discord.js');
const { requireActiveQueueAndVoice } = require('../utils/commandChecks');
const { baseEmbed, errorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('resume').setDescription('Riprende il brano in pausa.'),
  async execute(interaction) {
    const queue = await requireActiveQueueAndVoice(interaction);
    if (!queue) return;

    try {
      await interaction.client.musicManager.resume(interaction.guildId);
      await interaction.reply({
        embeds: [baseEmbed('Resume', 0x4afc8a).setDescription('Riproduzione ripresa.')]
      });
    } catch (error) {
      await interaction.reply({ embeds: [errorEmbed('Errore', error.message)], ephemeral: true });
    }
  }
};
