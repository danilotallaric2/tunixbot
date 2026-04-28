const { errorEmbed } = require('../utils/embeds');
const { safeReply } = require('../utils/reply');

module.exports = {
  name: 'interactionCreate',
  once: false,
  async execute(interaction) {
    if (interaction.isButton()) {
      await interaction.client.musicManager.handleButton(interaction);
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      await safeReply(interaction, {
        embeds: [errorEmbed('Errore Comando', error.message || 'Si e verificato un errore durante il comando.')],
        ephemeral: true
      });
    }
  }
};
