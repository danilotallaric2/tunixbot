const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed } = require('../utils/embeds');
const { safeReply } = require('../utils/reply');

module.exports = {
  data: new SlashCommandBuilder().setName('lyrics').setDescription('Mostra il testo del brano attuale.'),
  async execute(interaction) {
    try {
      await interaction.deferReply();
      const embed = await interaction.client.musicManager.getLyrics(interaction.guildId);
      await safeReply(interaction, { embeds: [embed] });
    } catch (error) {
      await safeReply(interaction, { embeds: [errorEmbed('Lyrics Non Disponibili', error.message)], ephemeral: true });
    }
  }
};
