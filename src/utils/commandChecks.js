const { ensureUserInVoice, ensureBotVoicePermissions, ensureSameVoiceChannel } = require('./permissions');
const { errorEmbed } = require('./embeds');

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
    await interaction.reply({
      embeds: [errorEmbed('Nessuna Sessione', 'Non c e una sessione musicale attiva in questo server.')],
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
