const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');
const { requireVoiceForPlay } = require('../utils/commandChecks');
const { baseEmbed, errorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('join').setDescription('Fa entrare TunixBot nel tuo canale vocale.'),
  async execute(interaction) {
    const voiceChannel = await requireVoiceForPlay(interaction);
    if (!voiceChannel) return;

    try {
      const result = await interaction.client.musicManager.join(interaction, voiceChannel);
      const components = [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setLabel('Apri Dashboard').setStyle(ButtonStyle.Link).setURL(config.dashboard.publicUrl)
        )
      ];

      await interaction.reply({
        embeds: [
          baseEmbed('Connesso', 0x27d3ff).setDescription(
            result.created
              ? `Entrato in **${voiceChannel.name}**. Vai nella dashboard con il bottone qui sotto.`
              : `Sono gia in **${voiceChannel.name}**. Puoi aprire la dashboard dal bottone qui sotto.`
          )
        ],
        components
      });
    } catch (error) {
      const message = typeof error?.message === 'string' && error.message.trim() ? error.message : 'Join fallito.';
      await interaction.reply({ embeds: [errorEmbed('Join Fallito', message)], ephemeral: true });
    }
  }
};
