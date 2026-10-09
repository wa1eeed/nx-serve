import { config } from './config.js';
import { createRealtimeServer } from './server.js';

const { httpServer, close } = createRealtimeServer({
  redisUrl: config.redisUrl,
  jwtSecret: config.jwtAccessSecret,
});

httpServer.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`realtime listening on :${config.port}`);
});

const shutdown = async (signal: string): Promise<void> => {
  // eslint-disable-next-line no-console
  console.log(`realtime shutting down on ${signal}`);
  await close();
  httpServer.close(() => process.exit(0));
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
