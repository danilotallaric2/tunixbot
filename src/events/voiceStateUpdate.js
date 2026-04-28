module.exports = {
  name: 'voiceStateUpdate',
  once: false,
  async execute(oldState, newState) {
    try {
      await oldState.client.musicManager.handleVoiceStateUpdate(oldState, newState);
    } catch {
      // noop
    }
  }
};
