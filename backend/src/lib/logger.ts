import pino from 'pino';

/**
 * Structured logging with Pino
 * Design.md: Logging & Audit section
 */

const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  },
  pino.destination(1)
);

export default logger;
