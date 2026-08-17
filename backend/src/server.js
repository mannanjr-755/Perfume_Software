import app from './app.js';
import env from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import Product from './models/Product.js';
import Order from './models/Order.js';

let server;

async function start() {
  try {
    await connectDatabase();
    await Product.init();
    await Order.init();
    console.log(`[DB] MongoDB connected (${env.mongodbUri})`);

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

start();
