const { SlashCommandBuilder } = require('discord.js');
const { requireActiveQueueAndVoice } = require('../utils/commandChecks');
const { baseEmbed, errorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Rimuove un brano dalla coda per indice.')
    .addIntegerOption((option) => option.setName('numero').setDescription('Numero in coda').setRequired(true).setMinValue(1)),
  async execute(interaction) {
    const queue = await requireActiveQueueAndVoice(interaction);
    if (!queue) return;

    const index = interaction.options.getInteger('numero', true);

    try {
      const removed = await interaction.client.musicManager.removeAt(interaction.guildId, index);
      await interaction.reply({
        embeds: [baseEmbed('Brano Rimosso', 0xffc14d).setDescription(`Rimosso: **${removed.title}**`)]
      });
    } catch (error) {
      await interaction.reply({ embeds: [errorEmbed('Errore Remove', error.message)], ephemeral: true });
    }
  }
};
