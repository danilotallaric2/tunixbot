const { SlashCommandBuilder } = require('discord.js');
const { requireActiveQueueAndVoice } = require('../utils/commandChecks');
const { baseEmbed, errorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Configura la modalita loop.')
    .addStringOption((option) =>
      option
        .setName('mode')
        .setDescription('Modalita loop')
        .setRequired(true)
        .addChoices(
          { name: 'off', value: 'off' },
          { name: 'song', value: 'song' },
          { name: 'queue', value: 'queue' }
        )
    ),
  async execute(interaction) {
    const queue = await requireActiveQueueAndVoice(interaction);
    if (!queue) return;

    const mode = interaction.options.getString('mode', true);

    try {
      await interaction.client.musicManager.setLoop(interaction.guildId, mode);
      await interaction.reply({
        embeds: [baseEmbed('Loop Aggiornato', 0x6d5cff).setDescription(`Modalita loop: **${mode}**`)]
      });
    } catch (error) {
      await interaction.reply({ embeds: [errorEmbed('Errore Loop', error.message)], ephemeral: true });
    }
  }
};
