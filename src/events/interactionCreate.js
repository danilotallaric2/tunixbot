const { errorEmbed } = require('../utils/embeds');
const { safeReply } = require('../utils/reply');
const logger = require('../utils/logger');
const { inspect } = require('util');
const { getInteractionLocale, t } = require('../utils/i18n');

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
      const context = {
        command: interaction.commandName,
        userId: interaction.user?.id,
        guildId: interaction.guildId,
        channelId: interaction.channelId
      };

      logger.error(
        `Command failed: ${context.command} (user=${context.userId} guild=${context.guildId} channel=${context.channelId})`,
        error
      );
      logger.error('Command error details', inspect(error, { depth: 6, colors: false }));

      const locale = getInteractionLocale(interaction);
      await safeReply(interaction, {
        embeds: [
          errorEmbed(
            t(locale, 'errors.commandTitle'),
            error.message || t(locale, 'errors.commandExecution'),
            locale
          )
        ],
        ephemeral: true
      });
    }
  }
};
