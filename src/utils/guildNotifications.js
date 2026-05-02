const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const logger = require('./logger');

const formatGuildName = (guild) => guild?.name || 'Unknown Guild';
const formatMemberCount = (guild) => (Number.isInteger(guild?.memberCount) ? String(guild.memberCount) : 'N/D');

const buildEmbed = (guild, mode) => {
  const isJoin = mode === 'join';

  return new EmbedBuilder()
    .setColor(isJoin ? config.theme.success : config.theme.warning)
    .setTitle(isJoin ? 'TunixBot Aggiunto' : 'TunixBot Rimosso')
    .setDescription(
      isJoin
        ? `Sono stato aggiunto in **${formatGuildName(guild)}**`
        : `Sono stato rimosso da **${formatGuildName(guild)}**`
    )
    .addFields(
      { name: 'Server', value: formatGuildName(guild), inline: true },
      { name: 'Guild ID', value: guild?.id || 'N/D', inline: true },
      { name: 'Membri', value: formatMemberCount(guild), inline: true },
      { name: 'Proprietario', value: guild?.ownerId ? `<@${guild.ownerId}>` : 'N/D', inline: true }
    )
    .setFooter({ text: config.theme.footer })
    .setTimestamp();
};

const sendGuildNotification = async (client, guild, mode) => {
  const channelId =
    mode === 'join' ? config.notifications.guildJoinChannelId : config.notifications.guildLeaveChannelId;
  if (!channelId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    logger.warn(`Guild notification channel not found or not text-based: ${channelId}`);
    return;
  }

  await channel.send({ embeds: [buildEmbed(guild, mode)] }).catch((error) => {
    logger.warn(`Failed to send guild ${mode} notification`, error);
  });
};

module.exports = {
  sendGuildNotification
};
