const { SlashCommandBuilder } = require('discord.js');
const { requireActiveQueueAndVoice } = require('../utils/commandChecks');
const { errorEmbed, baseEmbed } = require('../utils/embeds');
const { parseTimeToMs, formatDuration } = require('../utils/time');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('seek')
    .setDescription('Sposta il punto di riproduzione (es. 90 o 1:30).')
    .addStringOption((option) => option.setName('tempo').setDescription('Secondi o formato mm:ss / hh:mm:ss').setRequired(true)),
  async execute(interaction) {
    const queue = await requireActiveQueueAndVoice(interaction);
    if (!queue) return;

    const timeInput = interaction.options.getString('tempo', true);
    const ms = parseTimeToMs(timeInput);

    if (ms === null) {
      await interaction.reply({ embeds: [errorEmbed('Formato Non Valido', 'Usa secondi o formato `mm:ss` / `hh:mm:ss`.')], ephemeral: true });
      return;
    }

    try {
      await interaction.client.musicManager.seek(interaction.guildId, ms);
      await interaction.reply({ embeds: [baseEmbed('Seek', 0x27d3ff).setDescription(`Posizione impostata a **${formatDuration(ms)}**.`)] });
    } catch (error) {
      await interaction.reply({ embeds: [errorEmbed('Errore Seek', error.message)], ephemeral: true });
    }
  }
};
