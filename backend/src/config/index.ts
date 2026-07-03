import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  frontendOrigin: process.env.FRONTEND_ORIGIN || '*',
  vidlinkKeyHex: process.env.VIDLINK_KEY_HEX || '',
  movieboxApiBase: process.env.MOVIEBOX_API_BASE || 'https://h5-api.aoneroom.com/wefeed-h5api-bff',
  cacheTtlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '300', 10),
  httpTimeoutMs: parseInt(process.env.HTTP_TIMEOUT_MS || '8000', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
};
