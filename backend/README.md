# Unified Backend

A lightweight Node.js + TypeScript backend that exposes a unified REST API and automatically falls back between providers in priority order.

## Provider Fallback Behavior
1. Vidlink Pro (Highest Priority)
2. Moviebox
3. Vidsrc
4. Vidnest
5. Videasy

If a provider fails (timeout, non-200, missing stream), the orchestrator silently moves to the next provider until one succeeds or all fail.

## Setup & Run Locally
1. `npm install`
2. Create `.env` from `.env.example`
3. `npm run dev`

## Tests & Linting
- Run `npm test` for unit/integration tests
- Run `npm run lint` for ESLint checks

## Sample curl Examples
- Movie: `curl -sS 'http://localhost:3000/api/movie/533535'`
- TV: `curl -sS 'http://localhost:3000/api/tv/105248/1/1'`
- Health: `curl -sS 'http://localhost:3000/health'`

## Deploy to Render
1. Connect your GitHub repository to Render
2. Create a "Web Service"
3. Render will automatically detect the Dockerfile in the repository root (or backend folder). 
4. Configure environment variables in the Render dashboard matching `.env.example`. Do NOT commit `.env`.

### Troubleshooting
- **429/403 errors**: Ensure the request headers match browser headers. Check provider-specific tokens (like Moviebox `x-user` token).
- **Vidlink fallback key warning**: Rotate the `VIDLINK_KEY_HEX` in environment variables if you see this in logs.
