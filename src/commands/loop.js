const { SlashCommandBuilder } = require('discord.js');
const { requireActiveQueueAndVoice } = require('../utils/commandChecks');
const { baseEmbed, errorEmbed } = require('../utils/embeds');
const { getInteractionLocale, t } = require('../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Set loop mode.')
    .setDescriptionLocalizations({ it: t('it', 'commands.loopDescription') })
    .addStringOption((option) =>
      option
        .setName('mode')
        .setDescription('Loop mode')
        .setDescriptionLocalizations({ it: t('it', 'commands.optionLoopMode') })
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

    const locale = getInteractionLocale(interaction);
    const mode = interaction.options.getString('mode', true);

    try {
      await interaction.client.musicManager.setLoop(interaction.guildId, mode);
      await interaction.reply({
        embeds: [baseEmbed(t(locale, 'embeds.loopUpdatedTitle'), 0x6d5cff).setDescription(t(locale, 'embeds.loopUpdatedMessage', { mode }))]
      });
    } catch (error) {
      await interaction.reply({
        embeds: [errorEmbed(t(locale, 'embeds.loopErrorTitle'), error.message, locale)],
        ephemeral: true
      }); 
    }
  }
};

