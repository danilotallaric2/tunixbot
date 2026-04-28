const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');
const { requireVoiceForPlay } = require('../utils/commandChecks');
const { baseEmbed, errorEmbed } = require('../utils/embeds');
const logger = require('../utils/logger');
const { inspect } = require('util');

const isValidHttpUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const getReadableErrorMessage = (error) => {
  if (typeof error?.message === 'string' && error.message.trim()) return error.message.trim();
  if (Array.isArray(error?.errors) && error.errors.length > 0) {
    return error.errors
      .map((e) => {
        if (typeof e?.message === 'string' && e.message.trim()) return e.message.trim();
        return String(e);
      })
      .join(' | ');
  }
  return 'Join fallito.';
};

module.exports = {
  data: new SlashCommandBuilder().setName('join').setDescription('Fa entrare TunixBot nel tuo canale vocale.'),
  async execute(interaction) {
    const voiceChannel = await requireVoiceForPlay(interaction);
    if (!voiceChannel) return;

    try {
      const result = await interaction.client.musicManager.join(interaction, voiceChannel);
      const components = [];
      if (isValidHttpUrl(config.dashboard.publicUrl)) {
        components.push(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Apri Dashboard').setStyle(ButtonStyle.Link).setURL(config.dashboard.publicUrl)
          )
        );
      }

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
      const message = getReadableErrorMessage(error);
      logger.error(
        `Join command failed (user=${interaction.user?.id} guild=${interaction.guildId} channel=${interaction.channelId})`,
        error
      );
      logger.error('Join command error details', inspect(error, { depth: 6, colors: false }));
      await interaction.reply({ embeds: [errorEmbed('Join Fallito', message)], ephemeral: true });
    }
  }
};
