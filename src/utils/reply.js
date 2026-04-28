const safeReply = async (interaction, payload) => {
  if (interaction.deferred) return interaction.editReply(payload);
  if (interaction.replied) return interaction.followUp(payload);
  return interaction.reply(payload);
};

module.exports = {
  safeReply
};
