# H4C Monorepo ($MemO Collective)

- `/web` — Next.js app (SSG/ISR articles, OG images)
- `/bot` — Discord bot (badges↔roles, LP leaderboard, reputation v2)
- `/shared` — Shared config
- `/scripts` — Utilities

## Quick Start
1) Copy your article JSONs to `web/content/mega_article/`.
2) Put images into `web/public` (`logo.png`, badges/, etc.).
3) Create `.env` from `.env.example`.
4) Install & run:
   ```bash
   npm run install:all
   npm run dev
