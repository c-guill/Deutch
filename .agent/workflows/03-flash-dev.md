---
description: Développement rapide de la PWA React TypeScript Tailwind connectée à Supabase Cloud (modèle Gemini Flash)
---

# Agent `@FlashDev` — Développement PWA Frontend & Connexion Supabase

## Modèle cible
Exécuter cet agent avec **Gemini Flash** pour un développement rapide et itératif.

## Rôle
Développeur full-stack React + TypeScript + Tailwind CSS + Supabase Cloud, respectant strictement les règles de `.agent/rules/pedagogy-ux.md`.

## Étapes d'exécution

1. **Initialisation & Configuration PWA**
   - Initialiser l'application Vite + React + TypeScript + Tailwind CSS + `lucide-react` + `@supabase/supabase-js`.
   - Configurer la PWA installable sur mobile (`manifest.json`, icônes, service worker, balises meta viewport / theme-color).
   - Créer `.env.example` avec `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`.

2. **Implémentation Frontend (100 % anglais & allemand — zéro français, connectée à Supabase Cloud, aucune donnée en dur)**
   - `ThemeMap.tsx` : Parcours vertical des 18 thèmes avec progression en % et bouton prioritaire `"Review Due Items (X due)"` si des notions ont `next_review_at <= now()`.
   - `ThemeIntro.tsx` : Fiche mémo grammaticale et lexicale (*"Theme Essentials"*) avant de démarrer une leçon.
   - `SessionRunner.tsx` : Orchestrateur de session de 10 exercices (~70 % nouveaux / ~30 % révisions) alternant dynamiquement selon le niveau SM-2 :
     - `MatchingExercise.tsx` : relier 5 paires de mots allemand ↔ anglais.
     - `ClozeExercise.tsx` : compléter une phrase en contexte avec 4 choix (`cloze_target` + 3 `distractors`).
     - `ReorderExercise.tsx` : remettre les mots d'une phrase allemande dans le bon ordre.
     - `TypingExercise.tsx` : écriture directe avec barre de caractères spéciaux (`ä`, `ö`, `ü`, `ß`) et tolérance Levenshtein `<= 1`.
   - `srsEngine.ts` : algorithme SM-2 (calcul `repetitions`, `interval_days`, `ease_factor`, `next_review_at`) et synchronisation `user_progress` avec Supabase.
   - `speech.ts` : lecture audio `de-DE` via la Web Speech API intégrée au navigateur.

3. **Vérification**
   - Exécuter `npm run build` et corriger toute erreur TypeScript ou Vite jusqu'à obtenir un build propre.
