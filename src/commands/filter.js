const { SlashCommandBuilder } = require('discord.js');
const { requireActiveQueueAndVoice } = require('../utils/commandChecks');
const { errorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('filter')
    .setDescription('Applica un filtro audio.')
    .addStringOption((option) =>
      option
        .setName('nome')
        .setDescription('Filtro')
        .setRequired(true)
        .addChoices(
          { name: 'bassboost', value: 'bassboost' },
          { name: 'nightcore', value: 'nightcore' },
          { name: 'vaporwave', value: 'vaporwave' },
          { name: '8d', value: '8d' },
          { name: 'clear', value: 'clear' }
        )
    ),
  async execute(interaction) {
    const queue = await requireActiveQueueAndVoice(interaction);
    if (!queue) return;

    const name = interaction.options.getString('nome', true);

    try {
      await interaction.client.musicManager.applyFilter(interaction.guildId, name);
      await interaction.reply({ embeds: [interaction.client.musicManager.buildFilterEmbed(name)] });
    } catch (error) {
      await interaction.reply({ embeds: [errorEmbed('Errore Filtro', error.message)], ephemeral: true });
    }
  }
};
