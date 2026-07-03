import fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config';
import { apiRoutes } from './routes/api';

const server = fastify({
  logger: {
    level: config.logLevel,
  },
});

server.register(cors, {
  origin: config.frontendOrigin,
});

server.register(apiRoutes);

const start = async () => {
  try {
    await server.listen({ port: config.port, host: '0.0.0.0' });
    server.log.info(`Server listening on ${config.port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
