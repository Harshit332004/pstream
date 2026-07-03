import { getProviderMovie, getProviderTv, Provider, NormalizedResponse } from '../../src/providers';
import { vidlinkProvider } from '../../src/providers/vidlink';
import { movieboxProvider } from '../../src/providers/moviebox';

jest.mock('../../src/providers/vidlink');
jest.mock('../../src/providers/moviebox');

describe('Orchestrator Fallback Behavior', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return first provider if successful and set fallback=false', async () => {
    const mockResponse: NormalizedResponse = {
      provider: 'vidlink',
      fallback: false,
      quality: '1080p',
      stream: 'http://test.com/stream.mp4',
      subtitles: [],
    };

    (vidlinkProvider.fetchMovie as jest.Mock).mockResolvedValue(mockResponse);

    const result = await getProviderMovie('123');
    
    expect(result).toBeDefined();
    expect(result?.provider).toBe('vidlink');
    expect(result?.fallback).toBe(false);
    expect(movieboxProvider.fetchMovie).not.toHaveBeenCalled();
  });

  it('should fallback to second provider if first fails or returns null', async () => {
    const mockResponse2: NormalizedResponse = {
      provider: 'moviebox',
      fallback: false, // Orchestrator should overwrite to true
      quality: '720p',
      stream: 'http://test.com/stream2.m3u8',
      subtitles: [],
    };

    (vidlinkProvider.fetchMovie as jest.Mock).mockRejectedValue(new Error('500 Internal Server Error'));
    (movieboxProvider.fetchMovie as jest.Mock).mockResolvedValue(mockResponse2);

    const result = await getProviderMovie('456');

    expect(vidlinkProvider.fetchMovie).toHaveBeenCalledWith('456');
    expect(movieboxProvider.fetchMovie).toHaveBeenCalledWith('456');
    
    expect(result).toBeDefined();
    expect(result?.provider).toBe('moviebox');
    expect(result?.fallback).toBe(true);
  });
});
