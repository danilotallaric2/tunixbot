const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');
const { requireVoiceForPlay } = require('../utils/commandChecks');
const { baseEmbed, errorEmbed } = require('../utils/embeds');
const logger = require('../utils/logger');
const { inspect } = require('util');
const { getInteractionLocale, t, localizeErrorMessage } = require('../utils/i18n');

const isValidHttpUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const getReadableErrorMessage = (error, locale) => {
  if (Array.isArray(error?.errors) && error.errors.length > 0) {
    const pieces = error.errors.map((e) => localizeErrorMessage(locale, e, 'errors.genericOperation'));
    return pieces.join(' | ');
  }

  return localizeErrorMessage(locale, error, 'errors.genericOperation') || t(locale, 'errors.genericOperation');
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('Make TunixBot join your voice channel.')
    .setDescriptionLocalizations({ it: t('it', 'commands.joinDescription') }),
  async execute(interaction) {
    const voiceChannel = await requireVoiceForPlay(interaction);
    if (!voiceChannel) return;

    const locale = getInteractionLocale(interaction);

    try {
      const result = await interaction.client.musicManager.join(interaction, voiceChannel);
      const components = [];
      if (isValidHttpUrl(config.dashboard.publicUrl)) {
        components.push(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel(t(locale, 'embeds.dashboardButton')).setStyle(ButtonStyle.Link).setURL(config.dashboard.publicUrl)
          )
        );
      }

      await interaction.reply({
        embeds: [
          baseEmbed(t(locale, 'embeds.joinedTitle'), 0x27d3ff).setDescription(
            result.created
              ? t(locale, 'embeds.joinedCreatedMessage', { channel: voiceChannel.name })
              : t(locale, 'embeds.joinedExistingMessage', { channel: voiceChannel.name })
          )
        ],
        components
      });
    } catch (error) {
      const message = getReadableErrorMessage(error, locale);
      logger.error(
        `Join command failed (user=${interaction.user?.id} guild=${interaction.guildId} channel=${interaction.channelId})`,
        error
      );
      logger.error('Join command error details', inspect(error, { depth: 6, colors: false }));
      await interaction.reply({
        embeds: [errorEmbed(t(locale, 'embeds.joinFailedTitle'), message, locale)],
        ephemeral: true
      });
    }
  }
};
