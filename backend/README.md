---
title: PStream Backend
emoji: 🎬
colorFrom: red
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
---

# P-Stream HF Backend

Unified streaming scraping backend running on Express with a CinePro microservice.

- Exposes: `GET /api/stream?id=[TMDB_ID]&type=[movie|tv]&season=[S]&episode=[E]`
- Internal microservice (CinePro) running on port 3001
- Main endpoint running on port 7860
