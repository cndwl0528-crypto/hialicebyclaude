import app from './app.js';
import { config } from './lib/config.js';
import logger from './lib/logger.js';

const PORT = config.port;

app.listen(PORT, () => {
  logger.info(
    { port: PORT, env: config.nodeEnv },
    'HiAlice Backend Server v1.0 started'
  );
});
