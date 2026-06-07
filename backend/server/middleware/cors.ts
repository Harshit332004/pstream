export default defineEventHandler(event => {
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-API-Key, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
  });

  if (event.method === 'OPTIONS') {
    event.node.res.statusCode = 204;
    return null;
  }
});
