const { PermissionsBitField } = require('discord.js');
const { missingPermsEmbed, errorEmbed } = require('./embeds');

const VOICE_PERMS = [
  { name: 'ViewChannel', flag: PermissionsBitField.Flags.ViewChannel },
  { name: 'Connect', flag: PermissionsBitField.Flags.Connect },
  { name: 'Speak', flag: PermissionsBitField.Flags.Speak }
];

const ensureUserInVoice = async (interaction) => {
  const voiceChannel = interaction.member.voice?.channel;

  if (!voiceChannel) {
    await interaction.reply({
      embeds: [errorEmbed('Canale Vocale Richiesto', 'Devi entrare in un canale vocale prima di usare i comandi musicali.')],
      ephemeral: true
    });
    return null;
  }

  return voiceChannel;
};

const ensureBotVoicePermissions = async (interaction, voiceChannel) => {
  const me = interaction.guild.members.me;
  const missing = VOICE_PERMS.filter((perm) => !voiceChannel.permissionsFor(me).has(perm.flag));

  if (missing.length > 0) {
    await interaction.reply({
      embeds: [missingPermsEmbed(missing.map((perm) => `\`${perm.name}\``))],
      ephemeral: true
    });
    return false;
  }

  return true;
};

const ensureSameVoiceChannel = async (interaction, queue) => {
  const userChannelId = interaction.member.voice?.channelId;

  if (!userChannelId || userChannelId !== queue.voiceChannelId) {
    await interaction.reply({
      embeds: [
        errorEmbed(
          'Canale Non Valido',
          'Per controllare la riproduzione devi essere nello stesso canale vocale del bot.'
        )
      ],
      ephemeral: true
    });
    return false;
  }

  return true;
};

module.exports = {
  ensureUserInVoice,
  ensureBotVoicePermissions,
  ensureSameVoiceChannel
};
