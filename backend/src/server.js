import app from './app.js';
import env from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';

let server;

async function start() {
  try {
    await connectDatabase();
    console.log(`[DB] Database connected (${env.databaseUrl})`);

    server = app.listen(env.port, '127.0.0.1', () => {
      console.log(`[API] Server running at http://127.0.0.1:${env.port}`);
    });
  } catch (error) {
    console.error('[API] Failed to start:', error.message);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`[API] ${signal} received — shutting down...`);
  if (server) {
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  } else {
    await disconnectDatabase();
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('[API] Unhandled promise rejection:', reason?.message || reason);
});
process.on('uncaughtException', (error) => {
  console.error('[API] Uncaught exception:', error?.message || error);
});

start();