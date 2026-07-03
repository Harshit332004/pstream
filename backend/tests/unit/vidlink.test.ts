import _sodium from 'libsodium-wrappers';
import { encryptToken } from '../../src/providers/vidlink';
import { config } from '../../src/config';

// Mock config for tests
jest.mock('../../src/config', () => ({
  config: {
    vidlinkKeyHex: 'c75136c5668bbfe65a7ecad431a745db68b5f381555b38d8f6c699449cf11fcd',
  },
}));

describe('Vidlink Provider', () => {
  beforeAll(async () => {
    await _sodium.ready;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should encrypt and decrypt token correctly (roundtrip)', async () => {
    const fixedTime = 1670000000;
    jest.spyOn(Date, 'now').mockImplementation(() => fixedTime * 1000);

    const mediaId = '533535';
    const tokenBase64Url = await encryptToken(mediaId);

    // Decode base64url
    let base64 = tokenBase64Url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    
    const fullPayload = Buffer.from(base64, 'base64');
    
    // Unpack NONCE and Ciphertext
    const nonce = fullPayload.subarray(0, 24);
    const ciphertext = fullPayload.subarray(24);
    
    const key = Buffer.from(config.vidlinkKeyHex, 'hex');

    // Decrypt
    const decryptedBytes = _sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
    const decryptedBuffer = Buffer.from(decryptedBytes);
    
    const decryptedMediaId = decryptedBuffer.subarray(0, decryptedBuffer.length - 8).toString('utf-8');
    const decryptedTimestamp = Number(decryptedBuffer.subarray(decryptedBuffer.length - 8).readBigUInt64BE());
    
    expect(decryptedMediaId).toBe(mediaId);
    expect(decryptedTimestamp).toBe(fixedTime + 480);
  });
});
