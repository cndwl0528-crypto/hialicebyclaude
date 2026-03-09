import app from './app.js';
import { config } from './lib/config.js';

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║   HiAlice Backend Server v1.0        ║
  ║   Running on port ${PORT}              ║
  ║   Environment: ${config.nodeEnv.padEnd(18)}║
  ╚═══════════════════════════════════════╝
  `);
});
