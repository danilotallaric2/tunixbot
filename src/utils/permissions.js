const { PermissionsBitField } = require('discord.js');
const { missingPermsEmbed, errorEmbed } = require('./embeds');
const { getInteractionLocale, t } = require('./i18n');

const VOICE_PERMS = [
  { name: 'ViewChannel', flag: PermissionsBitField.Flags.ViewChannel },
  { name: 'Connect', flag: PermissionsBitField.Flags.Connect },
  { name: 'Speak', flag: PermissionsBitField.Flags.Speak }
];

const ensureUserInVoice = async (interaction) => {
  const voiceChannel = interaction.member.voice?.channel;

  if (!voiceChannel) {
    const locale = getInteractionLocale(interaction);
    await interaction.reply({
      embeds: [errorEmbed(t(locale, 'permissions.voiceRequiredTitle'), t(locale, 'permissions.voiceRequiredMessage'), locale)],
      ephemeral: true
    });
    return null;
  }

  return voiceChannel;
};

const ensureBotVoicePermissions = async (interaction, voiceChannel) => {
  const locale = getInteractionLocale(interaction);
  const me = interaction.guild.members.me || (await interaction.guild.members.fetchMe().catch(() => null));
  if (!me) {
    await interaction.reply({
      embeds: [errorEmbed(t(locale, 'permissions.permsCheckFailedTitle'), t(locale, 'permissions.permsCheckFailedMessage'), locale)],
      ephemeral: true
    });
    return false;
  }

  const channelPerms = voiceChannel.permissionsFor(me);
  const missing = VOICE_PERMS.filter((perm) => !channelPerms?.has(perm.flag));

  if (missing.length > 0) {
    await interaction.reply({
      embeds: [missingPermsEmbed(missing.map((perm) => `\`${perm.name}\``), locale)],
      ephemeral: true
    });
    return false;
  }

  const isAlreadyInChannel = me.voice?.channelId === voiceChannel.id;
  const userLimitReached =
    Number.isInteger(voiceChannel.userLimit) &&
    voiceChannel.userLimit > 0 &&
    voiceChannel.members.size >= voiceChannel.userLimit;

  if (!isAlreadyInChannel && userLimitReached) {
    await interaction.reply({
      embeds: [errorEmbed(t(locale, 'permissions.channelFullTitle'), t(locale, 'permissions.channelFullMessage'), locale)],
      ephemeral: true
    });
    return false;
  }

  return true;
};

const ensureSameVoiceChannel = async (interaction, queue) => {
  const userChannelId = interaction.member.voice?.channelId;

  if (!userChannelId || userChannelId !== queue.voiceChannelId) {
    const locale = getInteractionLocale(interaction);
    await interaction.reply({
      embeds: [
        errorEmbed(
          t(locale, 'permissions.invalidControlChannelTitle'),
          t(locale, 'permissions.invalidControlChannelMessage'),
          locale
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
