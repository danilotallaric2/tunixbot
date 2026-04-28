const { SlashCommandBuilder } = require('discord.js');
const { requireVoiceForPlay } = require('../utils/commandChecks');
const { errorEmbed } = require('../utils/embeds');
const { safeReply } = require('../utils/reply');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Riproduce musica da query o link (YouTube/Spotify).')
    .addStringOption((option) =>
      option.setName('query').setDescription('Titolo, URL YouTube o URL Spotify').setRequired(true)
    ),
  async execute(interaction) {
    const voiceChannel = await requireVoiceForPlay(interaction);
    if (!voiceChannel) return;

    const query = interaction.options.getString('query', true);

    try {
      await interaction.deferReply();
      await interaction.client.musicManager.play(interaction, query, voiceChannel);
    } catch (error) {
      await safeReply(interaction, {
        embeds: [errorEmbed('Play Fallito', error.message || 'Non sono riuscito a riprodurre la richiesta.')],
        ephemeral: true
      });
    }
  }
};
