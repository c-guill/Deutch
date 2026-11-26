import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { buildSessionExercises, type SessionExercise } from './lib/srsEngine';
import type { LearningItem, Module, Theme, UserProgress } from './types/database';
import ThemeMap from './components/ThemeMap';
import ThemeIntro from './components/ThemeIntro';
import SessionRunner from './components/SessionRunner';

type Screen =
  | { view: 'map' }
  | { view: 'intro'; theme: Theme }
  | { view: 'session'; title: string; exercises: SessionExercise[]; returnTheme?: Theme };

export default function App() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [items, setItems] = useState<LearningItem[]>([]);
  const [progressMap, setProgressMap] = useState<Map<string, UserProgress>>(() => new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ view: 'map' });

  const loadCurriculum = useCallback(async (isRefresh = false) => {
    if (!supabase || !isSupabaseConfigured) {
      setError('Supabase is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.');
      setLoading(false);
      return;
    }

    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [themesRes, modulesRes, itemsPage1, itemsPage2, progressRes] = await Promise.all([
        supabase.from('themes').select('*').order('order_index', { ascending: true }),
        supabase
          .from('modules')
          .select('*')
          .order('theme_id', { ascending: true })
          .order('order_index', { ascending: true })
          .range(0, 999),
        supabase.from('learning_items').select('*').range(0, 999),
        supabase.from('learning_items').select('*').range(1000, 2999),
        supabase.from('user_progress').select('*').range(0, 2999),
      ]);

      if (themesRes.error) throw themesRes.error;
      if (itemsPage1.error) throw itemsPage1.error;
      if (itemsPage2.error) throw itemsPage2.error;
      if (progressRes.error) throw progressRes.error;

      setThemes((themesRes.data as Theme[]) ?? []);
      if (!modulesRes.error) {
        setModules((modulesRes.data as Module[]) ?? []);
      }
      setItems([
        ...((itemsPage1.data as LearningItem[]) ?? []),
        ...((itemsPage2.data as LearningItem[]) ?? []),
      ]);

      const nextProgress = new Map<string, UserProgress>();
      for (const row of (progressRes.data as UserProgress[]) ?? []) {
        nextProgress.set(row.item_id, row);
      }
      setProgressMap(nextProgress);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Failed to load data from Supabase.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCurriculum(false);
  }, [loadCurriculum]);

  const dueCount = useMemo(() => {
    const now = Date.now();
    let count = 0;
    for (const p of progressMap.values()) {
      if (new Date(p.next_review_at).getTime() <= now) {
        count++;
      }
    }
    return count;
  }, [progressMap]);

  const sentencePracticeCount = useMemo(() => {
    const startedThemeIds = new Set<number>();
    for (const item of items) {
      if (progressMap.has(item.id)) {
        startedThemeIds.add(item.theme_id);
      }
    }
    return items.filter(
      (it) =>
        startedThemeIds.has(it.theme_id) &&
        it.sentence_de?.trim().length > 0 &&
        it.sentence_translation?.trim().length > 0
    ).length;
  }, [items, progressMap]);

  const handleProgressUpdated = useCallback((updated: UserProgress) => {
    setProgressMap((prev) => {
      const next = new Map(prev);
      next.set(updated.item_id, updated);
      return next;
    });
  }, []);

  const handleStartThemeLesson = (theme: Theme, mod?: Module) => {
    const exercises = buildSessionExercises({
      mode: 'theme',
      themeId: theme.id,
      moduleId: mod?.id,
      allItems: items,
      progressMap,
      sessionSize: 10,
    });
    const sessionTitle = mod
      ? `${theme.title} · ${String(mod.order_index).padStart(2, '0')}. ${mod.title}`
      : theme.title;
    setScreen({ view: 'session', title: sessionTitle, exercises, returnTheme: theme });
  };

  const handleStartDueReview = () => {
    const exercises = buildSessionExercises({
      mode: 'review',
      allItems: items,
      progressMap,
      sessionSize: 10,
    });
    setScreen({ view: 'session', title: 'Due Review Session', exercises });
  };

  const handleStartSentencePractice = () => {
    const exercises = buildSessionExercises({
      mode: 'sentence_practice',
      allItems: items,
      progressMap,
      sessionSize: 10,
    });
    setScreen({ view: 'session', title: 'Sentence Writing Practice', exercises });
  };

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col bg-white px-4 py-4 text-[#4B4B4B]">
      {loading ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-[#AFAFAF]">
          <Loader2 className="h-10 w-10 animate-spin text-[#58CC02]" />
          <p className="text-sm font-black">Loading your A1 German path...</p>
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFDFE0] text-[#FF4B4B]">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-lg font-black text-[#4B4B4B]">Connection Error</h1>
            <p className="mt-1 text-sm font-bold text-[#777777]">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => loadCurriculum(false)}
            className="btn-3d btn-blue"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Retry</span>
          </button>
        </div>
      ) : screen.view === 'map' ? (
        <ThemeMap
          themes={themes}
          modules={modules}
          items={items}
          progressMap={progressMap}
          dueCount={dueCount}
          sentencePracticeCount={sentencePracticeCount}
          onSelectTheme={(theme) => setScreen({ view: 'intro', theme })}
          onStartReview={handleStartDueReview}
          onStartSentencePractice={handleStartSentencePractice}
          onRefresh={() => loadCurriculum(true)}
          isRefreshing={refreshing}
        />
      ) : screen.view === 'intro' ? (
        <ThemeIntro
          theme={screen.theme}
          themeModules={modules.filter((m) => m.theme_id === screen.theme.id)}
          themeItems={items.filter((it) => it.theme_id === screen.theme.id)}
          progressMap={progressMap}
          onBack={() => setScreen({ view: 'map' })}
          onStartLesson={(mod) => handleStartThemeLesson(screen.theme, mod)}
        />
      ) : (
        <SessionRunner
          title={screen.title}
          exercises={screen.exercises}
          progressMap={progressMap}
          onProgressUpdated={handleProgressUpdated}
          onExit={() => {
            if (screen.returnTheme) {
              setScreen({ view: 'intro', theme: screen.returnTheme });
            } else {
              setScreen({ view: 'map' });
            }
            loadCurriculum(true);
          }}
        />
      )}
    </div>
  );
}
