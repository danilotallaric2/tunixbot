const { SlashCommandBuilder } = require('discord.js');
const { requireActiveQueueAndVoice } = require('../utils/commandChecks');
const { errorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Imposta il volume (0-200).')
    .addIntegerOption((option) =>
      option.setName('value').setDescription('Valore volume').setRequired(true).setMinValue(0).setMaxValue(200)
    ),
  async execute(interaction) {
    const queue = await requireActiveQueueAndVoice(interaction);
    if (!queue) return;

    const value = interaction.options.getInteger('value', true);

    try {
      await interaction.client.musicManager.setVolume(interaction.guildId, value);
      await interaction.reply({ embeds: [interaction.client.musicManager.buildVolumeEmbed(value)] });
    } catch (error) {
      await interaction.reply({ embeds: [errorEmbed('Errore Volume', error.message)], ephemeral: true });
    }
  }
};
