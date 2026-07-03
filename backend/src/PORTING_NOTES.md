# Porting Notes

## Vidlink
- **Crypto Parity**: The original `encrypt_token` used Python's `nacl.secret.SecretBox`. We ported this to TypeScript using `libsodium-wrappers`. The Python `BOX.encrypt` outputs `nonce + MAC + ciphertext`. However, `libsodium-wrappers` `crypto_secretbox_easy` outputs `MAC + ciphertext`. We manually concat the `nonce` first to exactly match the Python byte layout.
- **Timestamp Buffer**: Big-endian integer packing `struct.pack(">Q", timestamp)` was ported using Node's `Buffer.writeBigUInt64BE`.

## Moviebox
- **Token caching**: Replicated the `x-user` token header extraction and caching.
- **Domain Discovery**: Implemented as a cached function calling `media-player/get-domain`.

## Vidsrc
- **VRF Generator**: The AES-CBC encryption using a sha256 derived key from a static string was ported exactly using Node's `crypto` module. We had to implement a manual `pkcs7_pad` function since the python `cryptography` library pads automatically or using standard pads that we needed to match precisely.
- **Extractor**: A stub is present. Due to complex HTML parsing (like matching `window._xy_ws`), full scraper equivalence will require using Cheerio in subsequent PRs.

## Videasy
- **WASM Loading**: `module1.wasm` and `decrypt.js` were copied to `src/providers/videasy_wasm/`. Next steps include importing the js module to call the webassembly bindings within the Node context.
