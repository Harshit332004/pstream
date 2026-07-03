    Important folder to read: "scrapper clones" (contains five Python scrapers; inspect each).
        scrapper clones/Vidlink.pro-Decryptor/main.py (vidlink token/encryption + endpoints)
        scrapper clones/Moviebox-API/api.py (moviebox API + token acquisition + domain/discovery)
        scrapper clones/Vidsrc.cc-Decryptor/* (extractor.py, vrf_generator.py — custom VRF/token logic)
        scrapper clones/Vidnest-Decryptor/* (inspect for decryption/headers)
        scrapper clones/Videasy.net-Decryptor/* (inspect for decryption/headers)
    Goal: Port all five Python scrapers into a single lightweight Node.js + TypeScript backend that exposes a small, unified REST API and automatically falls back between providers in priority order. Keep it simple, reliable, and deployable (target platform: Render).

High-level functional requirements (captain summary)

    Implement endpoints:
        GET /api/movie/:tmdbId
        GET /api/tv/:tmdbId
        GET /api/tv/:tmdbId/:season/:episode
        GET /health
    Provider priority (must be enforced in code):
        Vidlink Pro
        Moviebox (Provider 2)
        Vidsrc (Provider 3)
        Vidnest (Provider 4)
        Videasy (Provider 5)
        Try providers in exact order. If a provider fails (timeout, non-200, parse error, missing stream, invalid JSON), silently move to the next provider until one succeeds or all fail.
    From the selected provider return a normalized JSON response (always same format).
    Choose the highest available video quality automatically (prioritize 2160p → 1440p → 1080p → 720p → 480p → 360p).
    Only return English-language subtitles; map common variants (English, English CC, English SDH, eng, ENG) to "English".
    Robustness: timeouts, retries, connection reuse, caching, and safe error handling so one provider's failure cannot crash the service.
    CORS: allow requests from the Vercel frontend origin. Use an env var FRONTEND_ORIGIN; default to "*" only for dev.
    USE ANY LEGAL OR ILLEGAL OR WORKAROUND ON ANY CLOUDFLARE ISSUES WE FACE

Critical implementation details (very precise)

    Language and tools:
        Node 20+, TypeScript, ES modules.
        Use Fastify for HTTP server (recommended for speed) or Express if agent prefers; Fastify is preferred.
        Use undici (or node-fetch) for HTTP requests using a single shared client to enable connection reuse and keepalive.
        Use libsodium-wrappers (or tweetnacl/libsodium) for NaCl SecretBox encryption/decryption needed by Vidlink.
        Use lru-cache (or simple Map+TTL) for in-memory caching of provider results and tokens.
        Use p-retry or implement small retry wrapper with exponential backoff (max 2 retries by default).
        ESLint + Prettier configured; Jest or Vitest for tests.
    Configuration via environment variables (.env):
        PORT (default 3000)
        FRONTEND_ORIGIN (Vercel frontend URL)
        VIDLINK_KEY_HEX (the Vidlink SecretBox key; do NOT commit secrets)
        MOVIEBOX_API_BASE (default: https://h5-api.aoneroom.com/wefeed-h5api-bff)
        CACHE_TTL_SECONDS (default 300)
        HTTP_TIMEOUT_MS (default 8000)
        LOG_LEVEL (info/debug)
    Always validate inputs (tmdbId non-empty string, season/episode integers >=1). Return 400 for invalid inputs.

Detailed porting instructions per provider (exact behavior to reproduce)

A) Vidlink Pro (highest priority) — port scrapper clones/Vidlink.pro-Decryptor/main.py

    Exact token generation algorithm MUST be reproduced:
        KEY_HEX = "c75136c5668bbfe65a7ecad431a745db68b5f381555b38d8f6c699449cf11fcd"
            Implementation MUST read KEY from VIDLINK_KEY_HEX env variable; if not present, the agent may fall back to the repository value but must print a warning in logs and recommend rotating the secret.
        KEY = bytes.fromhex(KEY_HEX) -> in TS: Buffer.from(KEY_HEX, "hex")
        NONCE is 24 zero bytes -> Buffer.alloc(24)
        encrypt_token(media_id: string):
            timestamp = int(time.time() + 480) // current Unix seconds + 480
            message = media_id encoded as UTF-8 + struct.pack(">Q", timestamp) // 8-byte big-endian unsigned integer
                Implementation detail: build a Buffer for media_id and append an 8-byte big-endian integer buffer (use Buffer.alloc(8); buffer.writeBigUInt64BE(BigInt(timestamp)) )
            Use SecretBox (XSalsa20-Poly1305) to encrypt message with KEY and NONCE
                Behavior from Python: BOX.encrypt(message, NONCE) returns ciphertext; they then use encrypted.ciphertext (no MAC/nonce prepended) and create full_payload = NONCE + encrypted.ciphertext
                For libsodium: use crypto_secretbox_xsalsa20poly1305: the API may expect message + 16-byte MAC; ensure output matches Python's secretbox, and replicate exactly the Python NaCl secretbox output. Use libsodium-wrappers' sodium.crypto_secretbox_easy(message, nonce, key) which returns ciphertext (MAC + ciphertext). But note Python's nacl.secret.SecretBox.encrypt returns nonce + ciphertext where ciphertext includes the MAC. The original Python code builds full_payload = NONCE + encrypted.ciphertext (their encrypted.ciphertext is MAC + ciphertext), so the final full payload layout = 24-byte nonce + 16-byte MAC + ciphertext.
                Reproduce that with libsodium-wrappers: crypto_secretbox_easy outputs (MAC + ciphertext) — so full_payload = NONCE + output.
            final token = base64.urlsafe_b64encode(full_payload).decode("utf-8").rstrip("=")
                Implement base64url encode and strip trailing "=" padding.
                Use Buffer.from(full_payload).toString("base64") then base64urlify (replace + with -, / with _, trim =) OR use a small helper.
        Use these token endpoints:
            Movie: GET https://vidlink.pro/api/b/movie/{token}?multiLang=1
            TV: GET https://vidlink.pro/api/b/tv/{token}/{season}/{episode}?multiLang=1
        Required headers for Vidlink upstream calls:
            User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36
            Origin: https://vidlink.pro
            Referer: https://vidlink.pro/
            Any other browser-like headers okay. Respect a single shared HTTP client and set timeout.
        Return expected data: Vidlink returns JSON payload; extract streams, hls, dash, captions if present. Normalize stream entries into the common response model.
        Unit test requirement: implement a roundtrip test that:
            Mocks Date.now() to a fixed epoch and verifies encrypt_token produces an output which when decrypted (crypto_secretbox_open_easy using the same KEY and NONCE) yields message = media_id + timestamp in big-endian. The test asserts the decrypted media_id equals input media_id and the unpacked timestamp equals expected.

B) Moviebox (Provider 2) — port scrapper clones/Moviebox-API/api.py

    Implement cached guest token extraction:
        GET {API_BASE}/home?host=moviebox.ph and read "x-user" header. If present, parse JSON and pick token = json.x-user.token.
        Fallback: parse set-cookie header for token=...
        Cache token in-memory and refresh it if the upstream responds with a new x-user header on subsequent requests.
        Use Authorization: Bearer <token> when token exists.
    Domain discovery:
        Call {API_BASE}/media-player/get-domain to get domain for player (fallback to "https://netfilm.world" when absent).
        Build Referer exactly like Python: f"{domain}/spa/videoPlayPage/movies/{detail_path}?id={subject_id}&type=/movie/detail&detailSe={se}&detailEp={ep}&lang=en"
    Use player play endpoint:
        GET {domain}/wefeed-h5api-bff/subject/play?subjectId={subject_id}&se={se}&ep={ep}&detailPath={detail_path}
        Use PLAYER_HEADERS (Accept-Language, sec-ch-ua, etc.) and set Referer accordingly.
    Streams and captions:
        Streams may be in data.streams (with fields like resolutions, url, format), data.hls, data.dash.
        For captions, follow the Python logic: pick stream id (streams[0] or dash[0]) then call {API_BASE}/subject/caption?format={format}&id={stream_id}&subjectId={subject_id}&detailPath={detail_path}. Filter returned captions for English only.
    Retry and timeout: 1 retry, 8s default timeout.
    Respect rate-limiting; do not brute-force.

C) Vidsrc / Vidnest / Videasy (Providers 3–5)

    Inspect scrapper clones/Vidsrc.cc-Decryptor/extractor.py and vrf_generator.py and port their logic EXACTLY.
        If vrf_generator.py contains bit-level/byte-order manipulations, port using Buffer in Node and ensure endianness matches (explicitly use read/writeBigUInt64BE/LE as the Python used struct.pack)
        If any Python-only crypto libs are used, prefer libsodium-wrappers in JS, or port pure-Python algorithms to TS. Only use WASM if absolutely necessary for cryptographic parity — prefer pure JS wrappers first.
    Preserve the same headers, cookies, and request flows the Python scrapers use.
    Implement decryption steps in TypeScript with identical byte concatenation and base64url handling.

Unified provider interface (code contract)

    Create a providers interface file (src/providers/index.ts or src/providers/provider.ts) that defines:
        type NormalizedResponse = { provider: string; fallback: boolean; // true when this provider is not the first in priority quality: string; // e.g. "1080p" stream: string; // direct MP4 or HLS manifest or DASH manifest URL (upstream) subtitles: Array<{ label: string; url: string }>; raw?: any; // optional: full upstream response for debugging }
        Each provider module must export:
            fetchMovie(tmdbId: string): Promise<NormalizedResponse | null>
            fetchTV(tmdbId: string, season: number, episode: number): Promise<NormalizedResponse | null>

Orchestrator logic (single core caller)

    Implement an orchestrator function used by the API route:
        For incoming request (movie/tv), iterate providers in configured priority order.
        For each provider call:
            call provider.fetchMovie / fetchTV
            wrap call in try/catch with overall timeout (HTTP_TIMEOUT_MS default) and retry (1 retry).
            If provider returns a valid NormalizedResponse with a non-empty stream, stop and return it.
            If provider throws or returns null/no-stream, log debug and continue to next provider.
        When returning a provider that is not "vidlink", set fallback: true. If vidlink succeeded, fallback: false.
        If none succeed, return 404 JSON { error: "No source found" }.

Quality selection (exact algorithm)

    From a provider's candidate list (all MP4/hls/dash representations), build a set of qualities (numerical) by parsing resolution labels:
        Accept both forms: "1080", "1080p", "resolutions" fields or resolution numbers embedded in strings.
        Map to prioritized labels:
            2160 → "2160p", 1440 → "1440p", 1080 → "1080p", 720 → "720p", 480 → "480p", 360 → "360p"
        Choose the highest quality available. If multiple streams at same quality:
            Prefer direct MP4 (format: MP4) over HLS (m3u8) if both exist and provider indicates similar reliability; otherwise prefer HLS.
        Return the chosen stream.url and quality label.

Subtitles (English-only filtering)

    For each provider, gather all subtitles/captions returned.
    Only keep subtitles whose language label or language code indicates English. Accept these tokens in label/code:
        exact matches (case-insensitive): "english", "english cc", "english sdh", "eng", "en", "ENG"
        regex patterns: /\beng(?:lish)?\b/i or /\benglish/i or /\beng(-|_)?(cc|sdh)?\b/i
    Normalize label to "English" in final response.

Request headers and cookies

    Use browser-like headers for all provider upstream calls (User-Agent, Accept-Language, Referer, Origin as needed).
    For provider-specific headers (moviebox), implement X-Client-Info and X-Request-Lang exactly as in Python.
    Preserve cookies set by upstream when needed (use shared client that handles cookies) or read tokens from headers as Python scrapers do.

Timeouts, retries, and caching

    Use a shared HTTP client with:
        default timeout: HTTP_TIMEOUT_MS (env default 8000)
        keep-alive enabled for connection reuse
    Retry logic:
        For transient fetch errors (ECONNRESET, ETIMEDOUT, 5xx for upstream), retry once after short backoff (~300ms).
        Don't retry on 4xx except 429 where you may respect Retry-After header once.
    Caching:
        In-memory cache with TTL (CACHE_TTL_SECONDS default 300) keyed by (provider, endpoint, tmdbId, season, episode).
        Cache both success and small failure markers (e.g., "no-stream" for short TTL like 30s) to avoid hammering upstream.
        Ensure cache size bounded (LRU).

API response format (exact examples)

    Success (primary provider vidlink): { "provider": "vidlink", "fallback": false, "quality": "1080p", "stream": "https://cdn.example/xxx.mp4", "subtitles": [ { "label": "English", "url": "https://cdn.example/subs.vtt" } ] }
    If vidlink fails and provider3 supplies: { "provider": "provider3", "fallback": true, "quality": "720p", "stream": "https://host/abc.m3u8", "subtitles": [] }
    When none succeed: HTTP 404 with JSON: { "error": "No source found" }

Health endpoint

    GET /health must return 200 swiftly with JSON: { "status": "ok", "timestamp": 1670000000, "upstream": { "vidlink": "unknown" | "ok" | "degraded", "moviebox": "unknown" | "ok" | "degraded", "vidsrc": "unknown" } }
    Keep it fast: do not block on live upstream checks by default. Optional: provide query param ?full=true to run quick connectivity checks with short timeouts.

Security and secrets

    Do NOT commit secrets (keys or tokens) to repo. Read sensitive values from env.
    If using the repo KEY_HEX as fallback, log a warning telling the user to set VIDLINK_KEY_HEX and rotate if necessary.
    Sanitize logs to not print token values. Log only provider names and status.

Testing and CI (must include)

    Unit tests:
        Vidlink token generator roundtrip: test that an encrypt_token then decrypt (with same key & nonce) yields original payload (media_id + timestamp). Use mocked Date/clock.
        Quality selection tests: pass a set of stream candidates and assert top-quality selection matches priority.
        Subtitle filter tests: check various subtitle labels and confirm only English is kept and normalized.
    Integration tests:
        Use nock or msw to mock upstream providers and test fallback behavior across providers. Create fixtures that mimic real upstream JSON for vidlink and moviebox.
        Test caching (repeat same request -> second request served from cache).
    Add GitHub Actions CI:
        On push/PR: run npm ci, build (tsc), lint, test.

Linting and formatting

    Add ESLint (with TypeScript support) and Prettier. Add pre-commit hook (husky) to run formatting and linting.

Dockerfile and deploy (Render)

    Use Render as recommended platform. Render details:
        Good for container web services, persistent processes, low cold starts (compared to serverless), easy GitHub auto-deploy, supports environment variables and secrets.
        For scraping backend that needs outbound requests and long-running processes, Render is a good balance.

    Provide Dockerfile (multi-stage) example; agent must add this Dockerfile to repo root:

        Required Dockerfile (agent should create exactly this or equivalent multi-stage): FROM node:20-alpine AS build WORKDIR /app COPY package.json package-lock.json* ./ RUN apk add --no-cache python3 make g++ # if libsodium needs building RUN npm ci COPY . . RUN npm run build

        FROM node:20-alpine AS run WORKDIR /app COPY --from=build /app/node_modules ./node_modules COPY --from=build /app/dist ./dist COPY package.json ./ ENV NODE_ENV=production EXPOSE 3000 CMD ["node", "dist/index.js"]

    .env.example (agent must add): PORT=3000 FRONTEND_ORIGIN=https://your-frontend.vercel.app VIDLINK_KEY_HEX=c75136c5668bbfe65a7ecad431a745db68b5f381555b38d8f6c699449cf11fcd MOVIEBOX_API_BASE=https://h5-api.aoneroom.com/wefeed-h5api-bff CACHE_TTL_SECONDS=300 HTTP_TIMEOUT_MS=8000 LOG_LEVEL=info

Deliverables (what the agent must create in the repo)

    Full TypeScript backend under backend/ or root src/ with:
        src/index.ts (server bootstrap)
        src/routes/api.ts (Fastify routes)
        src/providers/vidlink.ts (Vidlink implementation; must read VIDLINK_KEY_HEX from env)
        src/providers/moviebox.ts
        src/providers/vidsrc.ts
        src/providers/vidnest.ts
        src/providers/videasy.ts
        src/providers/index.ts (orchestrator that enforces priority and fallback)
        src/utils/http.ts (HTTP wrapper with timeout, retry, keep-alive)
        src/utils/cache.ts
        src/utils/quality.ts & src/utils/subs.ts
        src/config/index.ts (config reading from env)
    Tests:
        tests/unit/vidlink.test.ts (roundtrip test)
        tests/unit/quality.test.ts
        tests/integration/fallback.test.ts (mocks upstream)
    Config:
        package.json with scripts: build, start, dev, lint, test
        tsconfig.json, .eslintrc.js, .prettierrc
        Dockerfile (multi-stage)
        .env.example
    README.md — concise but precise instructions:
        How backend works
        Provider fallback behavior (explicit algorithm and priority)
        How to deploy to Render (step-by-step)
        How to add a new provider (template)
        How to run tests and lint locally
    CI:
        .github/workflows/ci.yml to run build, lint, tests.

Acceptance criteria (tests & behavior that must pass)

    Unit tests pass (vidlink crypto roundtrip + selection/subtitle filters).
    Integration fallback test: simulate vidlink returning 500 and provider2 returning valid stream; final API returns provider2 with fallback=true.
    Endpoints respond within timeouts (HTTP_TIMEOUT_MS) or return helpful 504/502 statuses.
    /health returns 200 quickly.
    ESLint and Prettier checks pass.
    Docker image builds successfully using the provided Dockerfile.
    No secret keys are written in code (only in env); if code contains fallback key from repo, it must be behind an explicit warning log and documented in README to rotate.

Extra engineering details & strict rules for the agent

    Do not over-engineer: keep modules small and readable. No heavy frameworks beyond Fastify/undici/libsodium.
    For porting Python struct.pack(">Q", timestamp) use Buffer writeBigUInt64BE in Node (verify BigInt usage).
    For base64url: replace "+" -> "-", "/" -> "_", and trim "=" padding.
    For SecretBox usage, confirm that the JS libsodium function yields identical bytes to Python PyNaCl. If using libsodium-wrappers, initialize sodium with await sodium.ready, then use sodium.crypto_secretbox_easy and sodium.crypto_secretbox_open_easy.
    All external requests must include explicit timeout and be cancellable (AbortController).
    Implement detailed logging (info/debug) with clear provider+tmdbId context, but avoid printing secrets.
    Provide developer notes file: src/PORTING_NOTES.md describing how each Python algorithm (especially bit-level/vrf) was ported, and where to check for parity with the original Python output.

Developer checklist for final commit (agent must ensure)

    All provider modules compile (tsc) and export required interface.
    Unit tests for crypto, quality selection, subtitle filtering implemented & passing.
    Integration tests for fallback behavior present & passing.
    README contains deploy steps for Render and sample curl examples for endpoints.
    .env.example included, no real secrets committed.
    Dockerfile builds an image that runs the server.
    CI workflow added and green on run.
    /health endpoint implemented and fast.

Sample curl examples to include in README (expected outputs)

    curl -sS 'http://localhost:3000/api/movie/533535' → returns normalized JSON response for a movie or 404 if no source.
    curl -sS 'http://localhost:3000/api/tv/105248/1/1' → returns normalized JSON response for a TV episode.
    curl -sS 'http://localhost:3000/health' → {"status":"ok","timestamp":...}

Priority of work for the agent (recommended order)

    Create project skeleton, configs, and basic Fastify server + /health
    Implement shared HTTP utils, caching, config
    Implement vidlink provider and its unit tests (highest priority)
    Implement orchestrator and central routes that call providers
    Implement moviebox provider and tests (token acquisition + domain discovery)
    Implement vidsrc/vidnest/videasy providers (port vrf/decryptors)
    Integration tests (fallback)
    Dockerfile, README, CI
    Run full test suite, fix lints & issues, finalize README and PORTING_NOTES.

If you get stuck on any crypto parity issue

    Stop and implement a roundtrip test (encrypt -> decrypt using same JS libs) and verify decrypted bytes are media_id + big-endian timestamp. Only continue when tests pass.
    If plain JS libsodium can't reproduce Python output, add a small compatibility test and document the mismatch in PORTING_NOTES and use WASM libsodium in the build to ensure parity.

Finish condition

    Agent must open a single PR with all files and pass CI where tests & linting pass. The PR description must include:
        How vidlink token was implemented and test results
        How moviebox token refresh works
        Where vrf/decryptors were ported and any notable differences
        How to deploy to Render (concrete steps)
        A short troubleshooting section (what to check if providers return 403/429)
