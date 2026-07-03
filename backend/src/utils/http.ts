import { request, Agent, setGlobalDispatcher } from 'undici';
import { config } from '../config';

const agent = new Agent({
  connections: 100,
  pipelining: 10,
});
setGlobalDispatcher(agent);

export async function fetchWithRetry(
  url: string,
  options?: any,
  retries = 1
) {
  const reqOptions = {
    ...options,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
      ...(options?.headers || {}),
    },
  };

  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await request(url, reqOptions);
      if (response.statusCode >= 500) {
        throw new Error(`Upstream returned ${response.statusCode}`);
      }
      return response;
    } catch (error: any) {
      lastError = error;
      // Do not retry on 4xx errors
      if (error?.message?.includes('40')) {
        throw error;
      }
      if (attempt < retries) {
        // Wait before retrying (exponential backoff 300ms, 600ms...)
        await new Promise(resolve => setTimeout(resolve, 300 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

export async function fetchJsonWithRetry<T = any>(
  url: string,
  options?: any,
  retries = 1
): Promise<T> {
  const response = await fetchWithRetry(url, options, retries);
  return (await response.body.json()) as T;
}
