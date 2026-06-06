Step 1: Clone P-Stream Backend
PowerShell

cd C:\Users\lavin\Downloads

# Clone P-Stream backend
git clone https://github.com/xp-technologies-dev/backend.git safestream-backend
cd safestream-backend

# Remove origin
git remote remove origin
git remote add origin https://github.com/YOUR-USERNAME/safestream-backend.git

# Install
npm install

Step 2: Set Up Environment Variables

Create .env file:
env

# Database (use Neon for free PostgreSQL)
DATABASE_URL=postgresql://user:password@ep-xxxxx.neon.tech/dbname

# TMDB API (free)
TMDB_API_KEY=797f74f09af514f1d6f9ecdbf70e8597

# Trakt API (free - optional, for trending)
TRAKT_CLIENT_ID=your_trakt_client_id
TRAKT_SECRET_ID=your_trakt_secret

# Encryption for user data
CRYPTO_SECRET=your-random-secret-key-minimum-32-chars

# Server
PORT=3000
NODE_ENV=production

Get Free API Keys:

    Neon PostgreSQL (free tier):
        Go to https://neon.tech
        Sign up, create project
        Copy connection string

    TMDB API (you already have this):
        TMDB_API_KEY=797f74f09af514f1d6f9ecdbf70e8597

    Trakt API (optional):
        Go to https://trakt.tv/oauth/applications
        Create application
        Copy Client ID and Secret

Step 3: Create P-Stream Provider Endpoint

P-Stream backend doesn't have a "get sources" endpoint by default. We need to add one:

Create file: server/routes/sources/[tmdbId].get.ts
TypeScript

/**
 * GET /api/sources/:tmdbId
 * Fetch video sources from P-Stream providers
 */

import { defineEventHandler, getRouterParam, getQuery } from 'h3';

export default defineEventHandler(async (event) => {
  const tmdbId = getRouterParam(event, 'tmdbId');
  const type = (getQuery(event).type as string) || 'movie';
  const season = getQuery(event).season;
  const episode = getQuery(event).episode;

  if (!tmdbId) {
    return {
      error: 'Missing tmdbId',
      sources: [],
      subtitles: []
    };
  }

  try {
    // Import P-Stream providers
    // Note: This assumes @p-stream/providers is installed
    // If not, we'll need to add it to package.json
    
    // For now, return empty sources
    // P-Stream providers run client-side in their frontend
    // We'll document the proper integration below
    
    return {
      responseId: 'backend-sources-v1',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      sources: [],
      subtitles: [],
      info: 'P-Stream providers run client-side. See documentation.'
    };
  } catch (error) {
    console.error('Error fetching sources:', error);
    return {
      error: 'Failed to fetch sources',
      sources: [],
      subtitles: []
    };
  }
});

Step 4: Update SafeStream Frontend
Option A: Use P-Stream's Frontend Architecture (Recommended)

Keep your HLS.js player but use P-Stream's provider system:

Update cinepro-api.js to use P-Stream providers instead:
JavaScript

/**
 * P-Stream Provider Client
 * Replaces CinePro, uses P-Stream's multi-provider system
 */

// This would require importing @p-stream/providers
// But since P-Stream runs providers client-side, we have two options:

// OPTION 1: Copy P-Stream's provider logic
// OPTION 2: Call P-Stream backend for metadata, use providers client-side

const PStream = {
  BASE_URL: '/api', // P-Stream backend
  BACKEND_URL: process.env.VITE_BACKEND_URL || 'https://your-pstream-backend.onrender.com',
  
  /**
   * Get trending/popular content for discovery
   */
  async getDiscovery() {
    try {
      const res = await fetch(`${this.BACKEND_URL}/discover`);
      if (!res.ok) return { popular: [], trending: [] };
      return await res.json();
    } catch (e) {
      console.error('Failed to fetch discovery:', e);
      return { popular: [], trending: [] };
    }
  },

  /**
   * Get watch history
   */
  async getWatchHistory(userId) {
    try {
      const res = await fetch(`${this.BACKEND_URL}/users/${userId}/watch-history`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.error('Failed to fetch history:', e);
      return [];
    }
  },

  /**
   * Save watch progress
   */
  async saveProgress(userId, media) {
    try {
      await fetch(`${this.BACKEND_URL}/users/${userId}/watch-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdbId: media.tmdbId,
          type: media.type,
          title: media.title,
          season: media.season,
          episode: media.episode,
          watched: media.timestamp,
          duration: media.duration,
          watchedAt: new Date().toISOString()
        })
      });
    } catch (e) {
      console.error('Failed to save progress:', e);
    }
  }
};

Option B: Full P-Stream Integration (Most Complete)

Actually use P-Stream's provider library in your frontend:
bash

npm install @p-stream/providers

Then in your player:
TypeScript

// In your script.js, replace HLSPlayerManager with P-Stream providers

import {
  makeProviders,
  makeStandardFetcher,
  targets,
} from "@p-stream/providers";

async function getSources(media) {
  const providers = makeProviders({
    fetcher: makeStandardFetcher(fetch),
    target: targets.BROWSER, // or targets.BROWSER_EXTENSION
  });

  const output = await providers.runAll({
    media: {
      tmdbId: media.tmdbId,
      type: media.type === 'tv' ? 'tv' : 'movie',
      season: media.season,
      episode: media.episode,
    },
  });

  // output.stream contains the best available stream
  return output.stream;
}

Step 5: Deploy P-Stream Backend to Render
PowerShell

# 1. Push to GitHub
git add .
git commit -m "feat: P-Stream backend for SafeStream"
git push origin main

# 2. Go to Render.com
# - Create New → Web Service
# - Connect GitHub repo
# - Build Command: npm run build
# - Start Command: node .nitro/index.mjs
# - Add environment variables from .env
# - Deploy!

# Or manually via Docker:
docker build -t safestream-backend .
docker run -p 3000:3000 --env-file .env safestream-backend

Step 6: Update SafeStream Frontend .env
env

# In your SafeStream frontend
VITE_BACKEND_URL=https://safestream-backend.onrender.com
VITE_TMDB_READ_API_KEY=797f74f09af514f1d6f9ecdbf70e8597

Step 7: Update Frontend to Call Backend

Modify your script.js to use P-Stream backend:
JavaScript

// Replace the old CinePro calls with P-Stream backend calls

const Backend = {
  BASE_URL: import.meta.env.VITE_BACKEND_URL || 'https://safestream-backend.onrender.com',
  
  async getDiscovery() {
    const res = await fetch(`${this.BASE_URL}/discover`);
    return res.json();
  },
  
  async getWatchHistory() {
    const res = await fetch(`${this.BASE_URL}/users/me/watch-history`);
    return res.json();
  },
  
  async saveProgress(media) {
    await fetch(`${this.BASE_URL}/users/me/watch-history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(media)
    });
  }
};

// When searching:
async function searchAndPlay(tmdbId, type) {
  // Get discovery/metadata
  const discovery = await Backend.getDiscovery();
  
  // Launch player with P-Stream providers
  HLSPlayerManager.launch({ tmdbId, type, title });
}

Complete Integration Flow
Code

1. User searches for movie
   ↓
2. Frontend calls Backend: GET /discover?search=Inception
   ↓
3. Backend queries TMDB API
   ↓
4. Returns metadata + TMDB ID
   ↓
5. User clicks play
   ↓
6. Frontend uses @p-stream/providers to scrape
   ↓
7. Gets 50+ sources from different providers
   ↓
8. HLS.js plays best source
   ↓
9. Every 5 seconds, save progress to Backend: POST /users/me/watch-history
   ↓
10. Watch history synced across all devices
