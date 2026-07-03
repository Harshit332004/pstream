# 🎬 SafeStream V2 — Complete Project Overview & Architecture

SafeStream V2 is a high-performance, low-end optimized, self-hosted movie and TV show streaming ecosystem. It integrates a server-side scraping engine, a secure bypass proxy, user synchronization, real-time telemetry, and a web client frontend that can be deployed as an SPA web app.

---

## 🗺️ High-Level System Architecture

```mermaid
flowchart TD
    subgraph Client [Client UI Layer: Web App & Tauri Desktop]
        MainJS[main.js: UI Coordinator]
        PlayerJS[player.js: Custom HLS Player]
        SyncEngine[sync.js: Heartbeat & BroadcastChannel Sync]
        StorageJS[storage.js: Caching Wrapper]
        ProvidersJS[providers.js: Client Fetcher API]
    end

    subgraph Backend [Nitro Server Engine]
        SPARouter[[[...all].ts: SPA Fallback Router]]
        API_Routes[Server Routes & Middlewares]
        ProxyEngine[[proxy/[...all].ts: Stream Bypass Proxy]]
        PrismaProxy[prisma.ts: Dynamic Database Proxy Client]
        LocalJSON[Local JSON DB: .data/db/*.json]
        ScrapingEngine[providers-lib: Scraping Package]
        MetricsEngine[metrics.ts: prom-client Telemetry Manager]
        CronTasks[Nitro Scheduled Tasks: Daily/Weekly/Monthly Cron]
    end

    subgraph External_APIs [Third-Party APIs & Media CDN]
        TMDB[TheMovieDB API: Metadata & Search]
        Trakt[Trakt.tv API: Trending & Lists]
        VidLink[VidLink API & Scrapers]
        OtherScrapers[45+ Scraping Providers & 30+ Embeds]
        VideoHost[Video Hosts / CDN Segments]
    end

    %% Client interactions
    MainJS -->|Searches & Details| TMDB
    MainJS -->|Initiates Playback| PlayerJS
    PlayerJS -->|Requests Sources| ProvidersJS
    ProvidersJS -->|GET /sources/:tmdbId| API_Routes
    SyncEngine -->|PUT /watch-history| API_Routes
    SyncEngine -->|BroadcastChannel| OtherTabs[Other Browser Tabs / Windows]
    StorageJS <-->|Cache / Read| LocalStorage[(Browser LocalStorage)]

    %% Desktop App Integration
    Client <-->|Tauri API / Rust WebView| TauriBackend[Tauri Desktop Core]

    %% Backend interactions
    SPARouter -->|Serves SPA| Client
    API_Routes -->|Scrape Sources| ScrapingEngine
    API_Routes -->|Discover / Trending| TMDB
    API_Routes -->|Trending Lists| Trakt
    API_Routes -->|Record Events| MetricsEngine
    CronTasks -->|Reset Intervals| MetricsEngine
    ScrapingEngine -->|Decrypt & Scrape| VidLink
    ScrapingEngine -->|Scrape streams/embeds| OtherScrapers
    ProxyEngine -->|Fetch & Segment Rewriting| VideoHost
    PlayerJS -->|Request Streams| ProxyEngine
    
    PrismaProxy <-->|Query / Write| PostgreSQL[(PostgreSQL Database)]
    PrismaProxy -.->|Database Offline Fallback| LocalJSON
    API_Routes -->|Read/Write Session/History/Settings| PrismaProxy
```

---

## 📂 Monorepo File Structure & Layout

The project is structured as a monorepo containing the standalone backend API server, the browser frontend client, and the cross-platform Tauri packaging configuration.

```text
psytream/
├── project_overview.md          # Complete architectural overview & developer guide [UPDATED]
├── pstream steps.md             # Guide log detailing deployment and integration workflows
├── sfaestream.md                # Original blueprints and UI design specifications
├── image.png                    # Interface capture asset
│
├── frontend/                    # Vite client application & Tauri desktop structure
│   ├── .env                     # Client environment configuration (VITE_BACKEND_URL)
│   ├── .env.example             # Template for client environment settings
│   ├── index.html               # Main entry HTML5 container (loads HLS.js, styles, and scripts)
│   ├── package.json             # Frontend package definitions (Vite & Tauri dependencies)
│   ├── vite.config.js           # Vite bundler, proxy definitions, and production config
│   │
│   ├── scripts/                 # Core client-side modules
│   │   ├── main.js              # UI Coordinator: search debounce, TV episode selectors, layout handlers
│   │   ├── player.js            # Custom HTML5/HLS Player: event binds, custom overlays, subtitle parser
│   │   ├── providers.js         # API gateway communicating with backend source/meta routes
│   │   ├── storage.js           # TTL-based LocalStorage caching wrapper
│   │   ├── sync.js              # watch-history sync loop & BroadcastChannel browser-tab synchronization
│   │   └── utils.js             # Utility functions: helpers, toast notifications, TMDB endpoints
│   │
│   ├── styles/                  # Clean vanilla CSS design system
│   │   ├── globals.css          # Design variables, typography, reset rules, animations
│   │   ├── mobile.css           # Responsive mobile styles targeting viewport width < 768px
│   │   └── player.css           # Video player overlay styles, custom control bars, and options panel
│   │
│   └── src-tauri/               # Tauri desktop configuration & source files
│       ├── Cargo.toml           # Rust package configuration for the Tauri compiler
│       ├── tauri.conf.json      # Desktop application setup (window size, resizability, bundling target)
│       ├── src/                 # Rust code handling window creation and system APIs
│       └── capabilities/        # Tauri permission profiles for the web view
│
└── backend/                     # Nitro backend server
    ├── Dockerfile               # Multi-stage production container build instructions
    ├── docker-compose.yml       # Local database & service orchestration template
    ├── package.json             # Backend server configuration & script triggers
    ├── nitro.config.ts          # Nitro server engine setup (routing, config injection, cron tasks)
    ├── tsconfig.json            # TypeScript compile configurations
    ├── nixpacks.toml            # Nixpacks container specification (for cloud deployments)
    ├── railpack.json            # Railpack configurations (for Railway deployments)
    │
    ├── prisma/                  # Database schema definitions & migrations
    │   ├── schema.prisma        # Database entity schemas and model definitions
    │   └── migrations/          # SQLite/PostgreSQL schema migration files
    │
    ├── scripts/
    │   └── build-frontend.js    # Build orchestrator script (builds frontend and copies it to backend public)
    │
    ├── providers-lib/           # Dynamic Video Scraper Sub-workspace
    │   ├── package.json         # Scraper module settings
    │   ├── tsconfig.json        # Scraper compilation configuration
    │   ├── vite.config.ts       # Scraper bundler configuration
    │   └── src/                 # Scraper source files
    │       ├── index.ts         # Scraper API library entrypoint
    │       ├── fetchers/        # Custom standard and proxy network fetchers
    │       ├── runners/         # Run controllers managing scraping contexts
    │       ├── utils/           # Decrypters, errors, and m3u8 proxy configuration utils
    │       └── providers/       # Scraper definitions
    │           ├── all.ts       # Central register of all 45+ sources and 30+ embeds
    │           ├── base.ts      # Base abstract types for Sourcerers and Embeds
    │           ├── captions.ts  # Telemetry captions/subtitles formatters
    │           ├── streams.ts   # HLS & MP4 stream configurations
    │           ├── embeds/      # 30+ Direct video host extractors (Filemoon, Voe, Upcloud, Turbovid)
    │           └── sources/     # 45+ Source index site search scrapers (VidLink, Zoechip, HDRezka)
    │
    └── server/                  # Nitro Backend Application Code
        ├── middleware/          # Global Request Handlers
        │   ├── cors.ts          # Access-Control CORS header injections
        │   └── metrics.ts       # HTTP response latency tracking middleware
        ├── plugins/             # Nitro Server Hooks
        │   └── metrics.ts       # Registers metrics engine on application bootstrap
        ├── tasks/               # Experimental Nitro Tasks
        │   └── jobs/            # Scheduled Cron Tasks
        │       └── clear-metrics/# Scripts to reset daily, weekly, monthly telemetry
        ├── utils/               # Common Helper Functions
        │   ├── auth.ts          # JWT session verification & mnemonic public key decryption
        │   ├── challenge.ts     # Cryptographic signature validation (tweetnacl nacl signature checks)
        │   ├── config.ts        # Exports application configuration variables
        │   ├── logger.ts        # Scoped console logging utility
        │   ├── metrics.ts       # prom-client metrics collector with disk snapshot persistency
        │   ├── nickname.ts      # Account profile random nickname generator
        │   ├── playerStatus.ts  # Formatter tools for checking source response metrics
        │   ├── prisma.ts        # Relational Database proxy Client [CRITICAL SYSTEM]
        │   └── trakt.ts         # Integrations setup for Trakt API endpoints
        └── routes/              # HTTP API Endpoints
            ├── [...all].ts      # Single Page Application SPA fallback router
            ├── healthcheck.ts   # System uptime status path
            ├── meta.ts          # Public settings configuration endpoint
            ├── discover/        # Media trends discovery
            │   └── index.ts     # Fetches trending lists from TMDB/Trakt
            ├── sources/         # Video scraper endpoint
            │   └── [tmdbId].get.ts # Queries providers-lib scraper library
            ├── proxy/           # Stream bypass proxy route
            │   └── [...all].ts  # Proxies playlists and binary chunks, rewriting m3u8 playlists
            ├── auth/            # Mnemonic Cryptographic Auth Flow
            │   ├── derive-public-key.post.ts # Generates credentials from a private mnemonic seed
            │   ├── login/
            │   │   ├── start/   # Generates signable login challenge code
            │   │   └── complete/# Verifies signed challenge and sets JWT session cookie
            │   └── register/
            │       ├── start.ts # Initiates registration flow challenge
            │       └── complete.ts # Stores user credentials and profile
            ├── metrics/         # Prometheus scrape routes
            │   ├── index.get.ts # Exposes default (all-time) telemetry
            │   ├── daily.ts     # Exposes daily telemetry
            │   ├── weekly.ts    # Exposes weekly telemetry
            │   ├── monthly.ts   # Exposes monthly telemetry
            │   ├── captcha.post.ts # Records captcha telemetry
            │   └── providers.post.ts # Endpoint mapping scraper successes and failures
            └── users/           # User configuration & watch history routes
                ├── @me.ts       # Retrieves authenticated user details
                └── [id]/        # User specific directories
                    ├── bookmarks.ts # Bookmarks CRUD handler
                    ├── group-order.ts # User-defined category orders
                    ├── ratings.ts   # Media star-ratings collector
                    ├── sessions.ts  # Authentication sessions audit
                    ├── settings.ts  # Configures themes, languages, and scraper overrides
                    └── watch-history/ # Playback progress syncing routes
                        ├── index.ts # Fetches user watch history array
                        └── [tmdbid]/ # Retrieves or updates watch progress details
```

---

## 💾 Database Layer & Schema

The database schema is defined in [schema.prisma](file:///c:/Users/lavin/psytream/backend/prisma/schema.prisma) mapping entities primarily to **PostgreSQL**.

### Entity Schema Maps
*   **`users`**: User account registry. Utilizes Ed25519 cryptography where accounts are identified by their `public_key` and a unique `namespace`. Profile information (avatar, display names) is stored dynamically as a `Json` structure.
*   **`user_settings`**: High-granularity client preference model. Tracks theme options (`application_theme`, `custom_theme`), defaults (`default_subtitle_language`, `enable_autoplay`, `enable_skip_credits`), proxies, and scraper-specific override arrays (`disabled_sources`, `disabled_embeds`, `source_order`, `embed_order`).
*   **`watch_history`**: Holds granular playback metrics. Stores watched/duration values as floats, tracking episode coordinates for TV shows. A media item is marked `completed` once the user has watched past **90%** of the duration.
*   **`progress_items`**: Secondary layout tracking table storing media playback status.
*   **`bookmarks`**: User bookmarked media (movies and shows), support folder tags (`group`) and tracking of individual `favorite_episodes`.
*   **`sessions`**: Active login audit tracking user device identifiers (`device`) and client HTTP user-agents (`user_agent`).
*   **`challenge_codes`**: Cryptographically secure temporary UUIDs generated to validate client-side signatures during auth challenge handshakes. Contains an `expires_at` field enforcing a **10-minute** time-to-live.

### 🛡️ The Double-Layer DB Fallback Proxy System
The backend utilizes a dynamic proxy pattern implemented in [prisma.ts](file:///c:/Users/lavin/psytream/backend/server/utils/prisma.ts) that guarantees high availability even under database downtime:

```mermaid
flowchart TD
    Request([Database Write/Read Request]) --> Proxy{Prisma JS Proxy}
    Proxy -->|Has DATABASE_URL & Online| DB_Query[Query PostgreSQL Database]
    Proxy -->|Database Offline / Connection Failure| DB_Fallback[Intercept Error Code P1001 / ECONNREFUSED]
    Proxy -->|No DATABASE_URL Configured| DB_Fallback
    DB_Fallback --> FileDB[Perform CRUD on Local JSON Files under .data/db/*.json]
```

1.  **Proxied Queries**: All database queries are intercepted by a JS `Proxy` wrapper.
2.  **Fallback Trigger**: If a database query fails with PostgreSQL connection errors (e.g. `P1001` target database unreachable, `ECONNREFUSED` connection refused), the proxy catches the exception, outputs a warning in the server logs, and redirects the operation to the fallback engine.
3.  **JSON Database Engine**: The fallback engine performs standard CRUD operations (simulating `findMany`, `findUnique`, `create`, `update`, `upsert`, `delete`, and `$transaction`) directly using read/write filesystem transactions against `.data/db/[model_name].json` file logs.

---

## ⚡ Stream Proxy Engine (`backend/server/routes/proxy/[...all].ts`)

To bypass client-side CORS issues and browser limitations while maintaining maximum privacy, the backend exposes a robust binary and text streaming proxy.

### How it Works:
1.  **Target Resolving**: The proxy parses the upstream URL parameter sent via query strings (`?host=...`), appending token and search parameters.
2.  **Header Sanitization**: Custom headers (such as `Referer`, `Origin`, and `User-Agent` requested by scrapers) are forwarded dynamically to make the request appear as a valid consumer browser, avoiding CDN blocks. The HTTP `Range` header is passed through to support scrubbing and progressive download features.
3.  **Stream Branch Paths**:
    *   **Text/Playlists (`.m3u8`)**: For HLS playlist configuration files, the proxy downloads the file as text using `got-scraping`. It inspects each line of the document and **rewrites nested sub-playlist URLs** to route back through the self-hosted proxy. For media segments (`.ts` chunk URLs), it leaves them absolute to allow direct CDN streaming when CORS allows, optimizing bandwidth.
    *   **Binary Media Chunks (`.ts`, `.mp4`)**: For binary media, the proxy creates an upstream request stream using `got-scraping` (avoiding TLS fingerprint detection from Cloudflare and CDNs) and pipes the byte stream directly to the client's HTTP response.

---

## 📊 Telemetry Engine (`backend/server/utils/metrics.ts`)

SafeStream V2 embeds a multi-stage monitoring engine powered by `prom-client` to keep track of scraper performance, watch telemetry, and server health.

```text
Intervals managed by the Telemetry Engine:
├── default (All-Time): Hydrated on boot, persists all-time metrics
├── daily: Tracked via Daily Registry, cleared at midnight by cron tasks
├── weekly: Tracked via Weekly Registry, cleared every Sunday by cron tasks
└── monthly: Tracked via Monthly Registry, cleared on the 1st of each month
```

### Telemetry Collectors:
*   `mw_user_count`: Aggregates active registered accounts grouped by namespace.
*   `mw_captcha_solves`: Counts captcha success vs failure counts.
*   `mw_provider_hostname_count`: Logs hostnames targeted during scrape cycles.
*   `mw_provider_status_count`: Measures individual scraper provider response codes.
*   `mw_media_watch_count`: Telemetry detailing watched movie titles, type, successful provider, and search success rate.
*   `mw_provider_tool_count`: Tracks underlying scraper helper calls.
*   `http_request_duration_seconds` & `http_request_summary_seconds`: High-resolution histograms detailing REST request durations grouped by method, route, and status code.

### Persistence and Resiliency:
*   **Startup Restoration**: Metrics are saved locally as `.metrics_[interval].json` snapshots every **60 seconds** and on process exit (`SIGTERM`, `SIGINT`). On application boot, the plugin restores telemetry states from these files.
*   **Nitro Tasks & Cron**: Real-time cron jobs clear target intervals using Nitro's task executor, triggering setup routines that wipe metrics files and register clean registry states at midnight intervals.

---

## 🖥️ Frontend Client Architecture (`frontend/`)

The client side is optimized to run on lightweight consumer devices as a Single Page Application (SPA), utilizing vanilla technologies for maximum load efficiency.

### Core JavaScript Architecture:
*   **[main.js](file:///c:/Users/lavin/psytream/frontend/scripts/main.js)**: Boots client components (`Player.init()`, `SyncEngine.init()`), configures debounced input fields (500ms delay) to lookup media details, populates responsive TV season/episode grids, and initiates local watch history card lists.
*   **[player.js](file:///c:/Users/lavin/psytream/frontend/scripts/player.js)**:
    *   **HLS.js Loader Hooking**: Wraps HLS.js instantiation, intercepting playlist queries to inject custom headers (User-Agent, Referers) and routing HLS requests through the backend's `/proxy` endpoint.
    *   **Subtitles Engine**: Downloads captions, parses standard SRT/VTT structures line-by-line using timestamp ranges, and overlays styled text in real-time onto the video viewport.
    *   **Automatic Provider Fallback**: If a video segment triggers fatal stream errors or loading hangs for more than **15 seconds**, the player catches the failure, halts execution, and falls back to the next scraping provider source returned in the scraper array.
    *   **Keyboard Binds**: Map spacebar to play/pause, arrows left/right to skip 10s, arrows up/down to control volume, `F` for fullscreen, `M` to mute, and `ESC` to exit player.
*   **[sync.js](file:///c:/Users/lavin/psytream/frontend/scripts/sync.js)**: Runs a 10-second sync loop with the backend user watch history routes. Leverages a browser `BroadcastChannel` (`safestream_sync`) to alert and update active playback coordinates across other open browser tabs instantly.
*   **[storage.js](file:///c:/Users/lavin/psytream/frontend/scripts/storage.js)**: Manages key-value pairs in LocalStorage prefixed with `safestream_` using TTL expiration checks.

---

## 🔗 Step-by-Step Media Flow Sequence

The sequence chart below details the entire flow of operations when a user searches for, plays, and updates watch progress on SafeStream V2:

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Front as Frontend (Browser / Tauri)
    participant Back as Nitro Backend
    participant TMDB as TMDB API
    participant Scraper as providers-lib Scraping Engine
    participant Proxy as Stream Proxy
    participant CDN as Media Host CDN

    User->>Front: Types query in Search Bar
    Front->>TMDB: Search query request (debounced)
    TMDB-->>Front: Return media metadata & TMDB ID
    Front->>User: Renders search results layout
    User->>Front: Clicks on title card
    
    opt If TV Show
        Front->>TMDB: Request TV season details
        TMDB-->>Front: Return season/episode lists
        User->>Front: Selects Season & Episode and clicks Play
    end

    Front->>Back: GET /sources/:tmdbId?type=...&season=...&episode=...
    activate Back
    Back->>Scraper: Execute Scrape RunAll({ media })
    activate Scraper
    Scraper->>CDN: Resolve indexers & decrypt embeds
    CDN-->>Scraper: Return raw stream source URLs (.m3u8 / .mp4) & Captions
    Scraper-->>Back: Returns sorted list of resolved streams
    deactivate Scraper
    Back-->>Front: Return JSON payload of streams & subtitles
    deactivate Back

    Front->>Front: Initialize HLS.js with primary stream source
    Front->>Proxy: Playback requests: /proxy?host=...&headers=...
    activate Proxy
    Proxy->>CDN: Download stream segment with spoofed headers
    CDN-->>Proxy: Return binary data chunks / text playlists
    Proxy->>Proxy: Rewrite HLS manifest files to proxy nested paths
    Proxy-->>Front: Stream data to HLS.js player
    deactivate Proxy
    Front->>User: Playback starts

    loop Every 10 Seconds
        Front->>Front: Save progress locally to LocalStorage
        Front->>Back: PUT /users/me/watch-history/:tmdbId (Update watched coordinates)
        Back->>Back: Save to Database (falls back to Local JSON database on failure)
        Front->>Front: Emit BroadcastChannel sync event to other active client tabs
    end

    opt On Stream Segment / Network Timeout (>15s)
        Front->>Front: Catch Player Error / Loader Timeout
        Front->>Front: Extract Next Stream Source from Scraper Array
        Front->>Proxy: Re-route stream request to Source #2
        Proxy->>CDN: Fetch Source #2 stream segments
        CDN-->>Proxy: Return Source #2 segment data
        Proxy-->>Front: Pipe data to player
        Front->>User: Playback resumes seamlessly
    end
```

---

## 🛠️ Configuration & Deployment Guide

### Core Environment Variables (`.env`)
To run the server, populate the following configurations in your environment file:

```env
# Relational Database URL
DATABASE_URL="postgresql://user:password@hostname:5432/dbname?schema=public"

# Database Provider (Set to 'supabase' to enable supabase pgBouncer pooling config)
DB_PROVIDER="supabase"
DB_POOL_MAX=10

# API Configuration
TMDB_API_KEY="your_tmdb_api_key"
TRAKT_CLIENT_ID="optional_trakt_client_id"
TRAKT_SECRET_ID="optional_trakt_client_secret"

# Cryptographic Signatures JWT Key
CRYPTO_SECRET="minimum_32_character_security_secret_string"

# Port & Node Environment
PORT=3000
NODE_ENV="production"
```

### Local Development Setup:
1.  **Clone & Installation**:
    ```bash
    # Install monorepo dependencies
    npm install
    ```
2.  **Database Migration**:
    ```bash
    cd backend
    # Run Prisma migrations
    npx prisma migrate dev
    ```
3.  **Booting the Stack**:
    *   **Start Backend Developer Server**:
        ```bash
        cd backend
        npm run dev
        ```
    *   **Start Frontend Developer Server**:
        ```bash
        cd frontend
        npm run dev
        ```

