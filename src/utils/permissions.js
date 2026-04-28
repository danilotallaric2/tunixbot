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
  const me = interaction.guild.members.me || (await interaction.guild.members.fetchMe().catch(() => null));
  if (!me) {
    await interaction.reply({
      embeds: [errorEmbed('Permessi Non Verificabili', 'Non riesco a verificare i miei permessi in questo server.')],
      ephemeral: true
    });
    return false;
  }

  const channelPerms = voiceChannel.permissionsFor(me);
  const missing = VOICE_PERMS.filter((perm) => !channelPerms?.has(perm.flag));

  if (missing.length > 0) {
    await interaction.reply({
      embeds: [missingPermsEmbed(missing.map((perm) => `\`${perm.name}\``))],
      ephemeral: true
    });
    return false;
  }

  // If the channel has reached user limit and bot is not already inside,
  // joining will fail even with Connect permission.
  const isAlreadyInChannel = me.voice?.channelId === voiceChannel.id;
  const userLimitReached =
    Number.isInteger(voiceChannel.userLimit) &&
    voiceChannel.userLimit > 0 &&
    voiceChannel.members.size >= voiceChannel.userLimit;

  if (!isAlreadyInChannel && userLimitReached) {
    await interaction.reply({
      embeds: [
        errorEmbed(
          'Impossibile Entrare',
          'Il canale vocale e pieno. Libera uno slot oppure aumenta il limite utenti del canale.'
        )
      ],
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
