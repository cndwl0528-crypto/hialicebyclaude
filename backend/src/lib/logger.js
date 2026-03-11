import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Structured logger for HiAlice backend.
 *
 * - Production: JSON output (machine-parseable, ready for log aggregators)
 * - Development: pretty-printed with timestamps for readability
 */
const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }),
});

export default logger;
