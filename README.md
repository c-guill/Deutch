# Deutsch A1 — Interactive German Learning PWA

A mobile-first Progressive Web App (PWA) designed to take absolute beginners to **CEFR A1 German** through a Duolingo-style playful interface, structured grammatical progression, and an adaptive **SM-2 Spaced Repetition System (SRS)** backed by **Supabase Cloud**.

---

## ✨ Key Features

- **19 Progressive CEFR A1 Units (~1,960 items)**:
  - Structured path from *Greetings & First Contacts*, *Pronouns & Grammar Basics*, and *Numbers & Prices* all the way to *Perfekt (Talking About the Past)*.
  - Each unit starts with a **"Theme Essentials"** memo sheet summarizing key grammar rules and core vocabulary with audio pronunciation.
- **Zero Blind Guessing (`DiscoveryCard`)**:
  - Brand-new words (`repetitions === 0`) are never tested cold. They first appear on an interactive collector-style Discovery Card with color-coded gender articles, an example sentence in context, a grammar tip, and dual-speed German TTS (`de-DE` normal & slow), then get tested in recognition 2–3 steps later in the same session.
- **4-Stage Adaptive Mastery (SM-2 Spaced Repetition)**:
  1. **Stage 1 — Discovery & Recognition (`repetitions === 0`)**: `DiscoveryCard` followed by 5-pair `MatchingExercise` or `McqExercise`.
  2. **Stage 2 — Consolidation in Context (`repetitions === 1`)**: Fill-in-the-blank (`ClozeExercise`) or word-order sentence building (`ReorderExercise` to anchor the German V2 verb-second rule).
  3. **Stage 3 — Word Production (`repetitions === 2`)**: Direct writing (`TypingExercise` `mode="word"`) requiring the German word and its definite article.
  4. **Stage 4 — Full Sentence Translation (`repetitions >= 3`)**: Full sentence writing (`TypingExercise` `mode="sentence"`) with word-count placeholders, progressive first-letter hints, an on-screen German umlaut keyboard (`ä`, `ö`, `ü`, `ß`), proportional Levenshtein typo tolerance, and word-by-word diff feedback.
- **Systematic Gender Color Coding**:
  - <kbd>der</kbd> (masculine) → **Blue** (`#1899D6`)
  - <kbd>die</kbd> (feminine) → **Red** (`#EA2B2B`)
  - <kbd>das</kbd> (neuter) → **Green** (`#58A700`)
- **Playful Tactile UI & Local Gamification**:
  - Rounded **Nunito** typography, 3D tactile buttons and cards, winding unit path with circular progress rings, daily streak counter (`🔥`), XP counter (`⚡`), combo badges, WebAudio sound effects, and confetti celebration on lesson completion.

---

## 🛠️ Tech Stack

- **Frontend**: React 19 + TypeScript + Vite 6 + Tailwind CSS 4 (PWA-ready with `manifest.json` & Service Worker)
- **Database**: Supabase Cloud (PostgreSQL + Row Level Security)
- **Speech & Audio**: Web Speech API (`de-DE` Text-to-Speech, normal & slow rates) + WebAudio API synthesized feedback tones
- **Data Pipeline**: Node.js scripts + Google Gemini (`@google/genai`) for CEFR A1 curriculum enrichment

---

## 🚀 Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in your Supabase Cloud credentials (and optional Gemini API key for data scripts):

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key

# Used only by CLI data-seeding scripts in /scripts
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key
GEMINI_API_KEY=your-google-ai-studio-api-key
```

### 3. Initialize the Supabase schema

Open the **SQL Editor** in your Supabase Cloud dashboard and run:

- [`supabase/migrations/001_init_schema.sql`](supabase/migrations/001_init_schema.sql)

This creates the `themes`, `learning_items`, and `user_progress` tables along with indexes and Row Level Security policies.

### 4. Seed or update curriculum data (optional if already seeded)

```bash
# Seed Supabase directly from the local enriched backup (data/enriched_backup.json)
npm run data:seed -- --seed-only

# Or enrich remaining raw items via Gemini and sync to Supabase
npm run data:seed

# Reorganize grammar/function words into Unit 03
node scripts/fix-grammar-themes.mjs
```

### 5. Run the development server

```bash
npm run dev
```

Open `http://localhost:5173` on mobile or desktop (centered mobile viewport `max-w-[480px]`).

### 6. Build for production

```bash
npm run build
npm run preview
```

---

## 📁 Project Structure

```text
├── public/
│   ├── icons/                  # PWA SVG icons (192x192, 512x512)
│   ├── manifest.json           # PWA Web App Manifest
│   └── sw.js                   # Service Worker
├── scripts/
│   ├── fetch-sources.mjs       # Raw A1 corpus fetcher & normalizer
│   ├── enrich-and-seed.mjs     # Gemini batch enrichment + Supabase Cloud upserter
│   └── fix-grammar-themes.mjs  # Grammar/function-word theme organizer
├── supabase/
│   └── migrations/
│       └── 001_init_schema.sql # PostgreSQL schema & RLS policies
└── src/
    ├── components/
    │   ├── ThemeMap.tsx        # Winding Duolingo-style learning path & top bar
    │   ├── ThemeIntro.tsx      # "Theme Essentials" grammar & vocabulary memo
    │   ├── SessionRunner.tsx   # 10-exercise lesson engine & sliding feedback drawer
    │   ├── DiscoveryCard.tsx   # First-exposure collector card with dual-speed audio
    │   ├── SessionComplete.tsx # Lesson victory screen with confetti & stats
    │   └── exercises/
    │       ├── MatchingExercise.tsx
    │       ├── McqExercise.tsx
    │       ├── ClozeExercise.tsx
    │       ├── ReorderExercise.tsx
    │       └── TypingExercise.tsx
    ├── lib/
    │   ├── srsEngine.ts        # SM-2 algorithm, session builder & Levenshtein evaluator
    │   ├── gameState.ts        # LocalStorage XP, daily streak & WebAudio sound effects
    │   ├── gender.ts           # der/die/das color utilities
    │   ├── speech.ts           # Web Speech API (de-DE) wrapper
    │   └── supabase.ts         # Supabase client singleton
    └── types/
        └── database.ts         # TypeScript interfaces
```
