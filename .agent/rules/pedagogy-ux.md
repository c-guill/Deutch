---
trigger: always_on
---

# Agent `@PedagogyUX` — Règles Pédagogiques CECRL A1 & UX Mobile-First

## Rôle
Concepteur pédagogique CECRL A1 et designer UX mobile-first inspiré de **Speexx** et des cahiers d'exercices interactifs. Cette règle globale est active pour tous les agents du dépôt.

## Langue de l'application (Règle stricte — 100 % Anglais & Allemand)
- **Zéro français dans l'application et ses données** : toute l'interface utilisateur (boutons, titres, navigation, messages d'état, métadonnées PWA `index.html` / `manifest.json`), tous les contenus pédagogiques (titres/descriptions/mémos des thèmes, `translation`, `sentence_translation`, `grammar_tip`) et les exercices doivent être **strictement en anglais** (langue d'instruction et de traduction) et en **allemand** (langue cible).
- Ne jamais mélanger de français dans les données Supabase (`themes`, `learning_items`), les prompts IA ou les composants React.

## Progression Pédagogique (De zéro jusqu'au niveau A1)
- L'apprenant part de zéro.
- Le programme est découpé en **15 à 18 thèmes progressifs** (du grand débutant *Salutations & présentations* jusqu'à la fin du niveau A1).
- Chaque thème commence par une **mini-fiche mémo** (*"Theme Essentials"*: key grammar rules + core vocabulary, en anglais et allemand uniquement) consultable avant de démarrer les exercices.

## Moteur de Session (10 exercices par leçon)
- **Répartition** : chaque leçon pioche environ **70 % de nouvelles notions** dans le thème actif et **30 % de révisions** issues des thèmes précédents dont `next_review_at <= now()`.
- **Règle d'exposition préalable (zéro devinette à l'aveugle)** :
  - Un mot ou une notion jamais vu (`repetitions === 0` ou absent de `user_progress`) ne doit **jamais** être testé à l'aveugle.
  - Il passe obligatoirement d'abord par une **carte de découverte** (`DiscoveryCard` : mot + article coloré, traduction, phrase d'exemple, `grammar_tip`, audio `de-DE` vitesse normale et lente), puis est testé en **reconnaissance** 2 à 3 étapes plus tard dans la même session.
- **Adaptation stricte du format selon la maîtrise (algorithme SM-2 — 4 paliers)** :
  1. **Palier 1 — Découverte & Reconnaissance** (`repetitions === 0`) : `DiscoveryCard` puis exercice de reconnaissance (`MatchingExercise` 5 paires ou QCM simple) 2 à 3 étapes plus tard dans la même session.
  2. **Palier 2 — Consolidation** (`repetitions === 1`) : Phrase à trous en contexte (`ClozeExercise` avec `cloze_target` + 3 `distractors`) ou remise en ordre des mots (`ReorderExercise`, pour ancrer la règle V2).
  3. **Palier 3 — Production de mot** (`repetitions === 2`) : Écriture directe du mot avec son article (`TypingExercise` `mode="word"`).
  4. **Palier 4 — Production de phrase complète** (`repetitions >= 3`) : Traduction écrite de la phrase complète en allemand (`TypingExercise` `mode="sentence"`, à partir de `sentence_translation` → `sentence_de`), avec aides anti-blocage (nombre de mots, indice progressif) et tolérance Levenshtein proportionnelle.

## Charte graphique ludique (style Duolingo — Règle globale)
- **Police** : **Nunito** (graisses 600/700/800/900), importée dans `index.html`, appliquée partout via `--font-sans`.
- **Fond clair épuré** : `#FFFFFF` (conteneur) et `#F7F7F7` (page).
- **Palette** (couleur + bordure basse épaisse) :
  - Vert victoire / action principale : `#58CC02` / `#58A700`
  - Bleu ciel / découverte / sélection : `#1CB0F6` / `#1899D6` (sélection : fond `#DDF4FF`, bordure `#84D8FF`)
  - Jaune or / XP & récompenses : `#FFC800` / `#E5A500`
  - Rouge corail / erreur : `#FF4B4B` / `#EA2B2B`
- **Boutons et cartes tactiles "3D"** : classes utilitaires dans `src/index.css` (`btn-3d` + `btn-green|blue|gold|red|white`, `card-3d`, `tile` + `tile-selected|correct|wrong|dim`, `key-3d`) avec `border-2 border-b-4 rounded-2xl` et effet d'enfoncement (`active:translate-y-[2px]`, bordure basse réduite à 2px).
- **Gamification 100 % locale** : XP (+10 par bonne réponse), série de jours (streak) et préférence sonore stockés dans `localStorage` (`src/lib/gameState.ts`). **Aucune modification du schéma Supabase.**
- **Écran d'accueil** : barre fixe (🔥 série, ⚡ XP, badge « A1 Goal »), bannière « Quick Review » si des mots sont dus, bouton « Sentence Writing Practice », parcours sinueux (zigzag gauche → centre → droite → centre) avec anneau de progression, emoji thématique et infobulle animée « START » / « CONTINUE » sur l'unité active.
- **Session immersive** : en-tête avec bouton fermer et barre épaisse brillante, badge « 🔥 N in a row », tiroir de correction qui glisse depuis le bas (vert `#D7FFB8` si juste avec titre aléatoire « Ausgezeichnet! / Super! / Perfect! » et « +10 XP » ; rouge `#FFDFE0` si faux avec bonne réponse et `grammar_tip`), écran final `SessionComplete` (confettis, précision, XP, série, « Back to path »).
- **Langue de l'interface** : tous les libellés ludiques restent en **anglais** (règle « zéro français » prioritaire) ; le contenu cible reste en allemand.

## Contraintes UX Mobile-First
- **Ergonomie au pouce** : design conçu pour smartphone (`max-w-[480px]` centré sur desktop, `min-h-[100dvh]`, gros boutons tactiles >= 48px de hauteur, aucune barre latérale).
- **Clavier allemand** : barre dédiée aux caractères spéciaux allemands (`ä`, `ö`, `ü`, `ß`, plus majuscules si pertinent) affichée juste au-dessus du clavier virtuel lors des exercices d'écriture directe.
- **Validation tolérante & feedback riche** :
  - Distance de Levenshtein `<= 1` acceptée comme correcte avec affichage de la graphie exacte attendue.
  - Code couleur systématique des genres grammaticaux :
    - `der` (masculin) : **bleu**
    - `die` (féminin) : **rouge**
    - `das` (neutre) : **vert**
  - Affichage d'une astuce grammaticale contextuelle (`grammar_tip`) après réponse.
  - Bouton de lecture audio en allemand (`de-DE`) via la Web Speech API sur les mots et phrases.
