const FILTER_PRESETS = {
  clear: {},
  bassboost: {
    equalizer: [
      { band: 0, gain: 0.3 },
      { band: 1, gain: 0.25 },
      { band: 2, gain: 0.2 },
      { band: 3, gain: 0.15 },
      { band: 4, gain: 0.1 }
    ]
  },
  nightcore: {
    timescale: {
      speed: 1.12,
      pitch: 1.15,
      rate: 1.0
    }
  },
  vaporwave: {
    timescale: {
      speed: 0.85,
      pitch: 0.8,
      rate: 1.0
    }
  },
  '8d': {
    rotation: {
      rotationHz: 0.2
    }
  }
};

module.exports = {
  FILTER_PRESETS
};
