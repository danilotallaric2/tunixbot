const { ensureUserInVoice, ensureBotVoicePermissions, ensureSameVoiceChannel } = require('./permissions');
const { errorEmbed } = require('./embeds');
const { getInteractionLocale, t } = require('./i18n');

const requireVoiceForPlay = async (interaction) => {
  const voiceChannel = await ensureUserInVoice(interaction);
  if (!voiceChannel) return null;

  const allowed = await ensureBotVoicePermissions(interaction, voiceChannel);
  if (!allowed) return null;

  return voiceChannel;
};

const requireActiveQueueAndVoice = async (interaction) => {
  const queue = interaction.client.musicManager.getQueue(interaction.guildId);

  if (!queue) {
    const locale = getInteractionLocale(interaction);
    await interaction.reply({
      embeds: [errorEmbed(t(locale, 'errors.sessionTitle'), t(locale, 'errors.sessionMissing'), locale)],
      ephemeral: true
    });
    return null;
  }

  const same = await ensureSameVoiceChannel(interaction, queue);
  if (!same) return null;

  return queue;
};

module.exports = {
  requireVoiceForPlay,
  requireActiveQueueAndVoice
};
