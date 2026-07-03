import { FastifyInstance } from 'fastify';
import { getProviderMovie, getProviderTv } from '../providers';

export async function apiRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (request, reply) => {
    return {
      status: 'ok',
      timestamp: Math.floor(Date.now() / 1000),
      upstream: {
        vidlink: 'unknown',
        moviebox: 'unknown',
        vidsrc: 'unknown',
        vidnest: 'unknown',
        videasy: 'unknown',
      },
    };
  });

  fastify.get('/api/movie/:tmdbId', async (request, reply) => {
    const { tmdbId } = request.params as { tmdbId: string };
    if (!tmdbId || typeof tmdbId !== 'string') {
      return reply.code(400).send({ error: 'Invalid tmdbId' });
    }

    const result = await getProviderMovie(tmdbId);
    if (!result) {
      return reply.code(404).send({ error: 'No source found' });
    }
    return result;
  });

  fastify.get('/api/tv/:tmdbId/:season/:episode', async (request, reply) => {
    const { tmdbId, season, episode } = request.params as {
      tmdbId: string;
      season: string;
      episode: string;
    };
    if (!tmdbId || typeof tmdbId !== 'string' || !season || !episode) {
      return reply.code(400).send({ error: 'Invalid parameters' });
    }

    const seasonNum = parseInt(season, 10);
    const episodeNum = parseInt(episode, 10);
    if (isNaN(seasonNum) || seasonNum < 1 || isNaN(episodeNum) || episodeNum < 1) {
      return reply.code(400).send({ error: 'Season and episode must be integers >= 1' });
    }

    const result = await getProviderTv(tmdbId, seasonNum, episodeNum);
    if (!result) {
      return reply.code(404).send({ error: 'No source found' });
    }
    return result;
  });
}
