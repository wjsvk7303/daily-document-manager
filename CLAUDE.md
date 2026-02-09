# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Project name**: 문서를 일자로 보관 (Daily Document Manager)

A document management application with Korean language UI. The project has two layers:

1. **`index.html`** — The live, fully-featured standalone SPA using Supabase for persistence. This is the working application.
2. **`app/`** — A scaffolded Next.js 15 project with Clerk authentication, currently at the default create-next-app template stage (not yet integrated with the document management features).

## Commands

```bash
npm run dev    # Start Next.js dev server (localhost:3000)
npm run build  # Production build
npm run lint   # ESLint (next/core-web-vitals + next/typescript)
npm run start  # Start production server
```

The legacy `index.html` can be opened directly in a browser — no build step needed.

## Tech Stack

- **Legacy SPA**: Pure HTML/CSS/JS, Supabase JS SDK v2 (CDN)
- **Next.js app**: Next.js 15.4, React 19, TypeScript, Tailwind CSS v4, Clerk auth (`@clerk/nextjs`)
- **Styling**: Tailwind via `@tailwindcss/postcss`; Geist font family
- **Path alias**: `@/*` maps to project root (tsconfig)

## Architecture

### Legacy SPA (`index.html`)

All logic is in a single file (~2900 lines). Key architecture:

- **Data layer**: Supabase client (`supabaseClient`) handles all CRUD. Documents are stored in a Supabase `documents` table and cached in a local `documents` array.
- **Rendering**: Imperative DOM manipulation — `renderAll()` orchestrates `renderCategories()`, `renderDocuments()`, `updateStats()`, and `updateCategoryOptions()`.
- **Document model**: `{ id, title, content, category, createdAt, updatedAt }` plus image attachments.
- **Features**: Category management (rename/delete), calendar view, date filtering, search with highlighting, image upload/paste/resize/lightbox, find-in-document, export/import JSON, pagination, toast notifications.

### Next.js App (`app/`)

Standard App Router structure:
- `app/layout.tsx` — Root layout wrapped in `ClerkProvider` with sign-in/sign-up/user buttons in header
- `app/page.tsx` — Default Next.js template (not yet customized)
- `middleware.ts` — Clerk middleware for auth route protection

## Environment

Clerk requires `.env.local` with `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` (not committed, covered by `.gitignore`).

## Korean UI

All user-facing text in the legacy SPA is in Korean. Maintain Korean for UI strings.
