# 🎬 SafeStream V2 — Complete Project Overview & Architecture

SafeStream V2 is a lightweight, low-end optimized, self-hosted movie and TV show streaming application. It consists of a high-performance backend server built with **Nitro** (a server engine powered by UnJS) and a vanilla, modern **Vite/HTML5/JavaScript/CSS** frontend player client that features cross-device synchronization and automatic backup fallback.

---

## 🗺️ High-Level System Architecture

```mermaid
flowchart TD
    subgraph Frontend [Vite Client-Side User Interface]
        MainJS[main.js: UI Coordinator]
        PlayerJS[player.js: Custom HLS Player]
        SyncEngine[sync.js: Heartbeat & BroadcastChannel Sync]
        StorageJS[storage.js: Caching Wrapper]
        ProvidersJS[providers.js: Client Fetcher API]
    end

    subgraph Backend [Nitro Server Engine]
        API_Routes[Server Routes & Middlewares]
        PrismaProxy[prisma.ts: Prisma PostgreSQL Client]
        LocalJSON[Local JSON File DB Fallback: .data/db/*.json]
        ScrapingEngine[providers-lib: Scraping Package]
    end

    subgraph External_APIs [Third-Party APIs]
        TMDB[TheMovieDB API: Metadata & Search]
        Trakt[Trakt.tv API: Trending & Lists]
        VidLink[VidLink API & Scrapers]
        OtherScrapers[45+ Scraping Providers & 30+ Embeds]
    end

    %% Frontend interactions
    MainJS -->|Searches & Details| TMDB
    MainJS -->|Initiates Playback| PlayerJS
    PlayerJS -->|Requests Sources| ProvidersJS
    ProvidersJS -->|GET /sources/:tmdbId| API_Routes
    SyncEngine -->|PUT /watch-history| API_Routes
    SyncEngine -->|BroadcastChannel| OtherTabs[Other Browser Tabs]
    StorageJS <-->|Cache / Read| LocalStorage[(Browser LocalStorage)]

    %% Backend interactions
    API_Routes -->|Scrape Sources| ScrapingEngine
    API_Routes -->|Discover / Trending| TMDB
    API_Routes -->|Trending Lists| Trakt
    ScrapingEngine -->|Decrypt & Scrape| VidLink
    ScrapingEngine -->|Scrape streams/embeds| OtherScrapers
    PrismaProxy <-->|Query / Write| PostgreSQL[(PostgreSQL Database)]
    PrismaProxy -.->|Database Down Fallback| LocalJSON
    API_Routes -->|Read/Write Session/History| PrismaProxy
```

---

## 📂 Complete File Structure

Below is the directory tree of the workspace, detailing the exact role of every major directory and file.

```text
psytream/
├── project_overview.md          # This architectural overview document [NEW]
├── pstream steps.md             # Guide log detailing deployment and integration workflows
├── sfaestream.md                # Original implementation blueprints and styling structures
├── image.png                    # Interface capture / system asset
│
├── frontend/                    # Vite-based static client application
│   ├── .env                     # Production/local env variables (VITE_BACKEND_URL)
│   ├── .env.example             # Template for client environment settings
│   ├── index.html               # Main entry HTML file (loads HLS.js, styles, and scripts)
│   ├── package.json             # Frontend package configuration (Vite bundler setup)
│   ├── package-lock.json        # Locked frontend dependency versions
│   ├── vite.config.js           # Vite server and routing specifications
│   │
│   ├── scripts/                 # Core client JavaScript modules
│   │   ├── main.js              # Entry coordinator: UI event handlers, TV episode selectors
│   │   ├── player.js            # Video player: custom controls, custom subtitles parser, fallback systems
│   │   ├── providers.js         # API interface to retrieve sources and discovery items from backend
│   │   ├── storage.js           # LocalStorage client-side manager with TTL caching
│   │   ├── sync.js              # History sync heartbeat engine and BroadcastChannel tab manager
│   │   └── utils.js             # Basic utilities: debouncers, time-formatters, TMDB endpoints
│   │
│   └── styles/                  # Clean vanilla CSS design system
│       ├── globals.css          # Design variables, typography, reset rules, animations
│       ├── mobile.css           # Touch targeting and layouts for screens < 768px
│       └── player.css           # Player overlay styles, custom control bars, and settings panel
│
└── backend/                     # Standalone Nitro API backend server
    ├── Dockerfile               # Multi-stage Docker deployment setup
    ├── docker-compose.yml       # Docker container orchestration configurations
    ├── package.json             # Server metadata and package dependencies
    ├── package-lock.json        # Locked server dependency versions
    ├── nitro.config.ts          # Nitro pack settings, daily jobs configuration, and public keys
    ├── tsconfig.json            # TypeScript compile configurations
    ├── nixpacks.toml            # Nixpacks build specifications (for cloud deployment platforms)
    ├── railpack.json            # Railpack configurations (for Railway deployments)
    │
    ├── prisma/                  # Relational Database Mapping
    │   ├── schema.prisma        # Prisma database schema specifying tables and indexes
    │   └── migrations/          # SQLite/PostgreSQL schema migration history files
    │
    ├── providers-lib/           # Dynamic Video Scraper & Provider Sub-Workspace
    │   ├── package.json         # Scraper module settings
    │   ├── tsconfig.json        # Scraper compilation configuration
    │   ├── vite.config.ts       # Provider compilation and bundle rules
    │   └── src/                 # Scraper source files
    │       ├── index.ts         # Library entrypoint exposing standard providers
    │       ├── providers/       # Scraper definitions
    │       │   ├── all.ts       # Registry of all 45+ sources and 30+ embeds
    │       │   ├── base.ts      # Base abstract types for Embeds and Sourcerers
    │       │   ├── captions.ts  # Caption utility functions
    │       │   ├── get.ts       # Scraper resolution handlers
    │       │   ├── streams.ts   # Stream type declarations
    │       │   ├── embeds/      # 30+ Direct video host extractors (Upcloud, Vidhide, Filemoon, Dood)
    │       │   └── sources/     # 45+ Index site search scrapers (VidLink, Autoembed, Zoechip, HDRezka)
    │       ├── fetchers/        # Proxy and browser user-agent network adapters
    │       ├── runners/         # Run routines executing scrapes with custom context
    │       └── utils/           # Error classes, text decrypters, and context specifications
    │
    └── server/                  # Nitro Backend Application Code
        ├── middleware/          # Server middlewares
        │   ├── cors.ts          # Access control permissions (CORS headers)
        │   └── metrics.ts       # Route latency measurement handlers
        ├── plugins/             # Nitro server setup hooks
        │   └── metrics.ts       # Injects runtime system tracking hooks
        ├── utils/               # Common helper functions
        │   ├── auth.ts          # JWT session management, public-key verification bypasses
        │   ├── challenge.ts     # Mnemonic signing verification (nacl signature checks)
        │   ├── config.ts        # Exports application configurations and system variables
        │   ├── logger.ts        # Custom server console logging utility
        │   ├── metrics.ts       # System prometheus metrics collectors
        │   ├── nickname.ts      # User registration random nickname generator
        │   ├── playerStatus.ts  # Player health metrics utilities
        │   ├── prisma.ts        # Prisma DB client setup with file fallback proxies [CRITICAL]
        │   └── trakt.ts         # Integrations setup for Trakt API endpoints
        └── routes/              # HTTP Rest Endpoints
            ├── index.ts         # Root path checking route (returns API version)
            ├── healthcheck.ts   # System uptime status path
            ├── meta.ts          # Public settings metadata: name, captcha requirements
            ├── discover/        # Media trends discovery
            │   └── index.ts     # Fetches trending, genre-sorted, top-rated lists via TMDB/Trakt
            ├── sources/         # Video source scrapers
            │   └── [tmdbId].get.ts # Endpoint querying providers-lib server-side
            ├── auth/            # Mnemonic Cryptographic Auth Flow
            │   ├── derive-public-key.post.ts # Generates public credentials from seed key
            │   ├── login/       # Login challenger
            │   │   ├── start/   # Issues login signature challenge code
            │   │   └── complete/# Validates signed challenge, sets session
            │   └── register/    # Registration challenger
            │       ├── start.ts # Initiates registration flow challenge
            │       └── complete.ts # Registers public key, creates new account profile
            └── users/           # User configuration & watch history routes
                ├── @me.ts       # Retreives logged-in user profile attributes
                └── [id]/        # Individual user operations
                    ├── bookmarks.ts # Add, delete, and group media bookmarks
                    ├── group-order.ts # User-defined layout orders for homepage
                    ├── index.ts # Retrieve full profile variables
                    ├── ratings.ts # User movie & show star ratings
                    ├── sessions.ts # Active user devices and active sessions
                    ├── settings.ts # Theme, audio, and scraper provider priority list options
                    └── watch-history/ # Synced playback progress routes
                        ├── index.ts # GET and DELETE user's entire progress history array
                        └── [tmdbid]/ # PUT update / DELETE single progress item
```

---

## 💾 Database Layer & Schema

The database model is defined in [schema.prisma](file:///c:/Users/lavin/psytream/backend/prisma/schema.prisma) using **PostgreSQL** notation.

### Major Models & Their Roles
1. **`users`**: Represents account credentials. Instead of passwords, users are tracked by a `public_key` (crypto signature validation) and a namespace. Nicknames are randomized on account creation.
2. **`watch_history`**: Tracks watched duration, total duration, episode details, update timestamps, and completion states (`completed` is true when >90% watched).
3. **`progress_items`**: Secondary lightweight mapping tracking user media playback position.
4. **`bookmarks`**: User saved movies and series, categorizable into custom folders (`group`).
5. **`user_settings`**: Highly detailed configuration object storing preferred subtitle languages, custom themes, autoplay selections, disabled scraping sources, and customized provider rank order override lists.
6. **`sessions`**: Active authentication sessions linking a user to a specific browser `device` and `user_agent`.
7. **`challenge_codes`**: Temporary records holding cryptographically unique values (UUID) issued to clients to sign during the login/registration workflow. Expires after 10 minutes.

### 🛡️ The Double-Layer DB Fallback Proxy System
A standout feature of SafeStream's backend is the implementation in [prisma.ts](file:///c:/Users/lavin/psytream/backend/server/utils/prisma.ts). The server wraps the Prisma client inside a JavaScript `Proxy`:

- **Case A (Database Configured & Online)**: If `DATABASE_URL` is provided, it connects to PostgreSQL.
- **Case B (PostgreSQL Disconnect / Crash)**: If any operation fails with connection codes (e.g. `P1001`, `ECONNREFUSED`), the proxy interceptor automatically catches the exception, outputs a warning, and falls back to a **local filesystem database** stored as JSON files under the `.data/db/` directory (e.g., `watch_history.json`, `users.json`).
- **Case C (No DB Configured)**: If no database URL is detected, the server operates entirely serverless-style on the local filesystem.

---

## 🔌 Scraping Engine (`providers-lib`)

The scraper sub-workspace (`backend/providers-lib`) is a heavily customized variant of the standard client-side scraping framework. SafeStream runs this engine **server-side** to bypass client-side CORS issues, allowing low-end client devices to receive clean direct streams.

### Architecture: Sourcerers vs. Embeds
- **Sourcerers (Sources)**: Scrapers that search specific movie directories/websites (like `Zoechip`, `Autoembed`, `HDRezka`, `VidLink`) for a given TMDB ID. They return either a direct HLS/MP4 stream or a set of redirects to **Embeds**.
- **Embeds**: Scrapers that resolve third-party video host links (like `Filemoon`, `Upcloud`, `DoodStream`, `Voe`) by unpacking obfuscated scripts (such as packer/Dean Edwards encoding, AES keys) to find the raw `.m3u8` or `.mp4` video files.

### 🚀 Example: The VidLink Scraper flow ([vidlink.ts](file:///c:/Users/lavin/psytream/backend/providers-lib/src/providers/sources/vidlink.ts))
1. **TMDB Encryption**: Receives the TMDB ID from the scrape context, makes an API call to `https://enc-dec.app/api/enc-vidlink` to fetch the encrypted version of the TMDB ID (protecting VidLink's API key).
2. **API Query**: Queries VidLink's API (`https://vidlink.pro/api/b/movie/${encryptedId}` or `/tv/...` for TV episodes).
3. **Data Extract**: Parses the stream playlist URL (`.m3u8`), subtitle language tracks (parsing them into standard VTT/SRT objects), and stream headers (like custom Referer credentials required to fetch chunks without HTTP 403 errors).
4. **Output**: Passes HLS stream playlist and metadata to the main backend event handler.

---

## 🖥️ Frontend Architecture (`frontend/`)

The frontend is an optimized SPA built with vanilla JavaScript. It uses HLS.js for stream rendering.

### 📜 JavaScript Core Modules

#### 1. [main.js](file:///c:/Users/lavin/psytream/frontend/scripts/main.js)
- Runs initial setup commands for systems on DOM Load (`Player.init()`, `SyncEngine.init()`).
- Sets up search listeners (debouncing inputs by 500ms to save API quotas) and calls TMDB.
- Handles the TV show selector: dynamically downloads details, constructs season lists, pulls season episode lists, and displays option lists.
- Triggers the rendering of local watch history cards.

#### 2. [player.js](file:///c:/Users/lavin/psytream/frontend/scripts/player.js)
- **HLS.js Hooking**: Connects video tags to HLS.js. Registers a custom loader that intercepts playlist fetches, injecting backend proxy headers and the scraping agent's user-agent.
- **Custom Controls Overlay**: Disables default browser video controls and styles custom progress bars, mute/volume sliders, overlay play buttons, and settings gear panels.
- **Automatic Fallback Switching**: If a stream fails to fetch (or takes more than 15s to load), it catches the exception and immediately switches to the next available provider source from the scraper results.
- **Keyboard Binds**: Map spacebar to play/pause, arrows left/right to skip 10s, arrows up/down to control volume, `F` for fullscreen, `M` to mute, and `ESC` to exit player.
- **Subtitles Engine**: Downloads captions, parses standard SRT/VTT structures (line-by-line using timestamp ranges), and overlays the text in real-time onto the video player wrapper.

#### 3. [sync.js](file:///c:/Users/lavin/psytream/frontend/scripts/sync.js)
- **Synchronization**: Runs a recurring 10-second sync loop with the backend.
- **Bypassed Authorization**: Configured to sync with standard route parameters using a universal target client identifier (`global_user`), allowing multiple browsers/devices on a local network to share watch history effortlessly.
- **Tab Syncing (BroadcastChannel)**: Sets up a BroadcastChannel (`safestream_sync`). When progress changes in one tab, it broadcasts `HISTORY_UPDATED` to other tabs, syncing progress instantly across multiple open tabs.

#### 4. [providers.js](file:///c:/Users/lavin/psytream/frontend/scripts/providers.js)
- Handles client fetches to backend endpoints. Queries backend source routes, failing over to fallback server URLs if the primary server fails.

#### 5. [storage.js](file:///c:/Users/lavin/psytream/frontend/scripts/storage.js)
- Handles client caching. Sets structures inside LocalStorage prefixed with `safestream_` and includes expiry indicators (TTL verification).

#### 6. [utils.js](file:///c:/Users/lavin/psytream/frontend/scripts/utils.js)
- Defines common utility functions: `timeAgo()`, `formatTime()`, standard DOM selectors, toast display widgets, debouncers, and TMDB fetch functions.

---

## 🔗 Step-by-Step Integration & Media Flow

The following sequence details exactly what happens when a user searches for and plays content on SafeStream:

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Front as Frontend (Browser)
    participant Back as Nitro Backend
    participant TMDB as TMDB API
    participant Scraper as Scraper Engine
    participant Video as Video Host

    User->>Front: Types title in Search Bar
    Front->>TMDB: Search query request (debounced)
    TMDB-->>Front: Return metadata & TMDB ID
    Front->>User: Renders search results dropdown
    User->>Front: Clicks on result
    
    opt If TV Show
        Front->>TMDB: Request TV season details
        TMDB-->>Front: Return season/episode lists
        User->>Front: Selects Season & Episode and clicks Play
    end

    Front->>Back: GET /sources/:tmdbId?type=...&season=...&episode=...
    activate Back
    Back->>Scraper: runAll({ media })
    activate Scraper
    Scraper->>Video: Scrape provider sites & resolve embeds
    Video-->>Scraper: Return raw stream URLs (.m3u8 / .mp4) & Captions
    Scraper-->>Back: Returns resolved sources list
    deactivate Scraper
    Back-->>Front: Return JSON (ordered sources & captions arrays)
    deactivate Back

    Front->>Front: Initialize HLS.js with primary stream
    Front->>Video: HLS.js requests chunks
    Video-->>Front: Serves stream chunks
    Front->>User: Playback begins

    loop Every 2 Seconds
        Front->>Front: Save progress locally to LocalStorage
        Front->>Back: PUT /watch-history/:tmdbId (Update watched seconds)
        Back->>Back: Prisma upsert history record (fallback to JSON DB on fail)
        Front->>Front: Broadcast channel emits UPDATE to other active tabs
    end

    opt On Stream Failure
        Front->>Front: HLS.js triggers fatal error / Timeout 15s
        Front->>Front: Switch to Source #2 in JSON array
        Front->>Video: HLS.js requests source #2 stream
        Front->>User: Resume playback seamlessly
    end
```

---

## 🛠️ Configuration & Deployment Guide

### Environment Variables (`.env`)
For the backend to run properly, configure the following keys:
```env
# Database Credentials
DATABASE_URL=postgresql://user:password@hostname/dbname

# API Integrations
TMDB_API_KEY=797f74f09af514f1d6f9ecdbf70e8597
TRAKT_CLIENT_ID=optional_trakt_client_key
TRAKT_SECRET_ID=optional_trakt_secret_key

# Security
CRYPTO_SECRET=your_minimum_32_character_security_key

# Port
PORT=3000
NODE_ENV=production
```

### Running Locally
1. **Backend**:
   ```bash
   cd backend
   npm install
   # Generates Prisma schemas and starts developer server
   npm run dev
   ```
2. **Frontend**:
   ```bash
   cd frontend
   npm install
   # Launches Vite dev server
   npm run dev
   ```
