const timestamp = () => new Date().toISOString();

const format = (level, message) => `[${timestamp()}] [${level}] ${message}`;

module.exports = {
  info: (message) => console.log(format('INFO', message)),
  warn: (message) => console.warn(format('WARN', message)),
  error: (message, err) => {
    console.error(format('ERROR', message));
    if (err) console.error(err);
  }
};
