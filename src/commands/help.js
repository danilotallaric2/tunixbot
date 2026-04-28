const { SlashCommandBuilder } = require('discord.js');
const { helpEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('help').setDescription('Mostra guida completa dei comandi TunixBot.'),
  async execute(interaction) {
    await interaction.reply({ embeds: [helpEmbed()], ephemeral: true });
  }
};
