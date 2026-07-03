# VidNest-Decryptor 🚀

A high-performance, native Python API engine designed to reverse-engineer and decode custom VidNest payload ciphers. This project provides seamless access to video streams and subtitles for Movies, TV Series, and Anime.

---

## ✨ Features

- **Native Decryption**: Pure Python implementation of VidNest's custom Base64 cipher. No external Node.js or WASM dependencies required.
- **Multi-Source Support**:
  - **Movies & TV**: Real-time extraction of signed MP4 stream links and SRT subtitles via TMDB IDs.
  - **Anime**: Support for multiple providers (`Hianime`, `AnimePahe`) using AniList IDs.
- **Cyberpunk Dashboard**: Built-in interactive UI documentation with live query testing.
- **Optimized Performance**: Built on **FastAPI** for asynchronous, high-concurrency handling.

---

## 🛠️ Technology Stack

- **Language**: Python 3.10+
- **Framework**: FastAPI + Uvicorn
- **Logic**: Custom Base64 Decoding + Urllib
- **Styling**: Vanilla CSS (Cyberpunk/Neon Aesthetic)

---

## 🚀 Quick Start

### 1. Installation
```ps1
# Clone the repository
git clone https://github.com/walterwhite-69/Vidnest-Decryptor.git
cd Vidnest-Decryptor

# Install dependencies
pip install -r requirements.txt
```

### 2. Run the Engine
```ps1
uvicorn main:app --reload --port 8001
```

### 3. Access the Dashboard
Open `http://127.0.0.1:8001/` in your browser to explore the interactive documentation.

---

## 📡 API Reference

### Get Sources (Movies/TV)
`GET /sources?tmdbId={id}&mediaType={movie|tv}&seasonId={s}&episodeId={e}`
- **Note**: `seasonId` and `episodeId` are only required for TV shows.

### Get Anime
`GET /anime?anilistId={id}&episode={e}&type={sub|dub}&provider={hianime|animepahe}`
- **Default**: `provider=hianime`

### Get Subtitles
`GET /subtitles?tmdbId={id}&mediaType={movie|tv}`
- Returns direct VTT subtitle tracks.

---

## 🔐 Logic Breakdown

The core of the project lies in `_decode_vidnest()`, which reverses the custom alphabet-based Base64 encoding used by VidNest:
`RB0fpH8ZEyVLkv7c2i6MAJ5u3IKFDxlS1NTsnGaqmXYdUrtzjwObCgQP94hoeW+/=`

The engine intercepts encrypted JSON payloads, performs bit-wise shifts to recover the original binary data, and serves it as a clean JSON response.

---

## ⚠️ Disclaimer

This project is not for educational purposes . Use however you want
