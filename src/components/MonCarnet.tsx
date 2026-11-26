import { useMemo, useState } from 'react';
import { BookMarked, Search, Volume2 } from 'lucide-react';
import type { LearningItem, UserProgress } from '../types/database';
import { formatGermanWithArticle, getGenderStyle } from '../lib/gender';
import { speakGerman } from '../lib/speech';

interface MonCarnetProps {
  items: LearningItem[];
  progressMap: Map<string, UserProgress>;
}

type SubView = 'words' | 'cards';
type StatusFilter = 'all' | 'rework' | 'progress' | 'mastered';

export default function MonCarnet({ items, progressMap }: MonCarnetProps) {
  const [subView, setSubView] = useState<SubView>('words');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');

  const encounteredItems = useMemo(() => {
    return items
      .filter((it) => progressMap.has(it.id))
      .map((it) => ({
        item: it,
        progress: progressMap.get(it.id)!,
      }))
      .sort((a, b) => a.item.german.localeCompare(b.item.german, 'de'));
  }, [items, progressMap]);

  const counts = useMemo(() => {
    let rework = 0;
    let progress = 0;
    let mastered = 0;
    for (const { progress: p } of encounteredItems) {
      if (p.repetitions === 0) rework++;
      else if (p.repetitions <= 2) progress++;
      else mastered++;
    }
    return {
      all: encounteredItems.length,
      rework,
      progress,
      mastered,
    };
  }, [encounteredItems]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return encounteredItems.filter(({ item, progress: p }) => {
      if (filter === 'rework' && p.repetitions !== 0) return false;
      if (filter === 'progress' && (p.repetitions < 1 || p.repetitions > 2)) return false;
      if (filter === 'mastered' && p.repetitions < 3) return false;
      if (!q) return true;
      return (
        item.german.toLowerCase().includes(q) ||
        item.translation.toLowerCase().includes(q) ||
        (item.article && `${item.article} ${item.german}`.toLowerCase().includes(q))
      );
    });
  }, [encounteredItems, filter, search]);

  return (
    <div className="animate-fade-in flex flex-1 flex-col gap-4 pb-24">
      {/* Header & Sub-view switcher */}
      <header className="flex flex-col gap-3 pt-1">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-[#4B4B4B]">My Notebook</h1>
          <span className="rounded-xl bg-[#DDF4FF] px-3 py-1 text-xs font-black text-[#1899D6]">
            {counts.all} words seen
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setSubView('words')}
            className={`btn-3d !min-h-[46px] !text-xs ${
              subView === 'words' ? 'btn-blue' : 'btn-white !text-[#777777]'
            }`}
          >
            My Words ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => setSubView('cards')}
            className={`btn-3d !min-h-[46px] !text-xs ${
              subView === 'cards' ? 'btn-blue' : 'btn-white !text-[#777777]'
            }`}
          >
            <BookMarked className="h-4 w-4" />
            <span>A1 Reference Cards</span>
          </button>
        </div>
      </header>

      {subView === 'words' ? (
        <div className="flex flex-col gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-[#AFAFAF]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search German or English..."
              className="text-input !pl-11 !text-sm"
            />
          </div>

          {/* Filter pills */}
          <div className="grid grid-cols-4 gap-1.5">
            {(
              [
                { id: 'all', label: `All (${counts.all})` },
                { id: 'rework', label: `Review (${counts.rework})` },
                { id: 'progress', label: `Learning (${counts.progress})` },
                { id: 'mastered', label: `Mastered (${counts.mastered})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`rounded-xl border-2 border-b-4 px-2 py-2 text-[11px] font-black transition active:translate-y-[1px] ${
                  filter === tab.id
                    ? 'border-[#1899D6] bg-[#DDF4FF] text-[#1899D6]'
                    : 'border-[#E5E5E5] bg-white text-[#777777]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Word list */}
          {filteredItems.length === 0 ? (
            <div className="card-3d p-6 text-center">
              <p className="text-sm font-black text-[#4B4B4B]">
                {counts.all === 0
                  ? 'You have not practiced any words yet. Start a unit on the Path!'
                  : 'No words match this filter.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {filteredItems.map(({ item, progress }) => {
                const gender = getGenderStyle(item.article);
                const spoken = formatGermanWithArticle(item.german, item.article);
                const reps = progress.repetitions;

                const statusBadge =
                  reps === 0
                    ? { label: 'Needs review', cls: 'bg-[#FFDFE0] text-[#EA2B2B]' }
                    : reps <= 2
                      ? { label: `In progress (${reps}/3)`, cls: 'bg-[#FFF8D6] text-[#E5A500]' }
                      : { label: '⭐ Mastered', cls: 'bg-[#D7FFB8] text-[#58A700]' };

                return (
                  <div
                    key={item.id}
                    className="card-3d flex items-center justify-between gap-3 px-3.5 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {item.article && gender && (
                          <span
                            className={`rounded-lg border-2 px-2 py-0.5 text-xs font-black ${gender.badgeBg} ${gender.badgeBorder} ${gender.badgeText}`}
                          >
                            {item.article}
                          </span>
                        )}
                        <span className="text-base font-black text-[#4B4B4B]">{item.german}</span>
                        {item.plural && (
                          <span className="text-xs font-bold text-[#AFAFAF]">
                            (Pl. {item.plural})
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm font-bold text-[#777777]">{item.translation}</p>
                      <span
                        className={`mt-1 inline-block rounded-lg px-2 py-0.5 text-[10px] font-black ${statusBadge.cls}`}
                      >
                        {statusBadge.label}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => speakGerman(spoken)}
                      className="btn-3d btn-white !h-11 !min-h-0 !w-11 shrink-0 !rounded-xl !px-0"
                      aria-label={`Listen to ${spoken}`}
                    >
                      <Volume2 className="h-5 w-5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* 4 Pillars of CEFR A1 Reference Cards */
        <div className="flex flex-col gap-4">
          {/* Card 1: Articles der, die, das (Nominative & Accusative) */}
          <section className="card-3d flex flex-col gap-3 p-4">
            <div>
              <span className="rounded-lg bg-[#DDF4FF] px-2.5 py-1 text-[10px] font-black tracking-wider text-[#1899D6] uppercase">
                Pillar 1 · Articles & Cases
              </span>
              <h2 className="mt-1.5 text-lg font-black text-[#4B4B4B]">
                Definite, Indefinite & Negation (Nom. / Acc.)
              </h2>
              <p className="text-xs font-bold text-[#777777]">
                In the Accusative case (direct object), only the Masculine article changes!
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs font-bold">
                <thead>
                  <tr className="border-b-2 border-[#E5E5E5] text-[#AFAFAF]">
                    <th className="py-1.5 pr-2">Gender</th>
                    <th className="py-1.5 pr-2">Nominative (Subject)</th>
                    <th className="py-1.5">Accusative (Object)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5]">
                  <tr>
                    <td className="py-2 pr-2 font-black text-[#1899D6]">Masc.</td>
                    <td className="py-2 pr-2">der / ein / kein</td>
                    <td className="py-2 font-black text-[#1899D6]">den / einen / keinen</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-2 font-black text-[#EA2B2B]">Fem.</td>
                    <td className="py-2 pr-2">die / eine / keine</td>
                    <td className="py-2">die / eine / keine</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-2 font-black text-[#58A700]">Neut.</td>
                    <td className="py-2 pr-2">das / ein / kein</td>
                    <td className="py-2">das / ein / kein</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-2 font-black text-[#4B4B4B]">Plural</td>
                    <td className="py-2 pr-2">die / — / keine</td>
                    <td className="py-2">die / — / keine</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Card 2: Present Tense Conjugation (sein, haben, regular verbs) */}
          <section className="card-3d flex flex-col gap-3 p-4">
            <div>
              <span className="rounded-lg bg-[#D7FFB8] px-2.5 py-1 text-[10px] font-black tracking-wider text-[#58A700] uppercase">
                Pillar 2 · Present Tense Verbs
              </span>
              <h2 className="mt-1.5 text-lg font-black text-[#4B4B4B]">
                sein (to be), haben (to have) & Regular Verbs
              </h2>
              <p className="text-xs font-bold text-[#777777]">
                Rule V2: the conjugated verb is always the 2nd element in a statement.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs font-bold">
                <thead>
                  <tr className="border-b-2 border-[#E5E5E5] text-[#AFAFAF]">
                    <th className="py-1.5 pr-2">Pronoun</th>
                    <th className="py-1.5 pr-2">sein</th>
                    <th className="py-1.5 pr-2">haben</th>
                    <th className="py-1.5">machen (-en)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5]">
                  <tr>
                    <td className="py-1.5 pr-2 font-black">ich</td>
                    <td className="py-1.5 pr-2">bin</td>
                    <td className="py-1.5 pr-2">habe</td>
                    <td className="py-1.5">mach<strong className="text-[#58A700]">e</strong></td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-2 font-black">du</td>
                    <td className="py-1.5 pr-2">bist</td>
                    <td className="py-1.5 pr-2">hast</td>
                    <td className="py-1.5">mach<strong className="text-[#58A700]">st</strong></td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-2 font-black">er / sie / es</td>
                    <td className="py-1.5 pr-2">ist</td>
                    <td className="py-1.5 pr-2">hat</td>
                    <td className="py-1.5">mach<strong className="text-[#58A700]">t</strong></td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-2 font-black">wir</td>
                    <td className="py-1.5 pr-2">sind</td>
                    <td className="py-1.5 pr-2">haben</td>
                    <td className="py-1.5">mach<strong className="text-[#58A700]">en</strong></td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-2 font-black">ihr</td>
                    <td className="py-1.5 pr-2">seid</td>
                    <td className="py-1.5 pr-2">habt</td>
                    <td className="py-1.5">mach<strong className="text-[#58A700]">t</strong></td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-2 font-black">sie / Sie</td>
                    <td className="py-1.5 pr-2">sind</td>
                    <td className="py-1.5 pr-2">haben</td>
                    <td className="py-1.5">mach<strong className="text-[#58A700]">en</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Card 3: W-Fragen (Question Words) */}
          <section className="card-3d flex flex-col gap-3 p-4">
            <div>
              <span className="rounded-lg bg-[#FFF8D6] px-2.5 py-1 text-[10px] font-black tracking-wider text-[#E5A500] uppercase">
                Pillar 3 · Asking Questions
              </span>
              <h2 className="mt-1.5 text-lg font-black text-[#4B4B4B]">
                Essential W-Fragen (Question Words)
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { de: 'Wer?', en: 'Who?', ex: 'Wer bist du?' },
                { de: 'Was?', en: 'What?', ex: 'Was machst du?' },
                { de: 'Wo?', en: 'Where (at)?', ex: 'Wo wohnst du?' },
                { de: 'Woher?', en: 'Where from?', ex: 'Woher kommst du?' },
                { de: 'Wohin?', en: 'Where to?', ex: 'Wohin fährst du?' },
                { de: 'Wann?', en: 'When?', ex: 'Wann beginnt es?' },
                { de: 'Wie?', en: 'How?', ex: 'Wie heißen Sie?' },
                { de: 'Wie viel?', en: 'How much?', ex: 'Wie viel kostet das?' },
                { de: 'Warum?', en: 'Why?', ex: 'Warum lernst du?' },
                { de: 'Welcher?', en: 'Which?', ex: 'Welcher Zug ist das?' },
              ].map((q) => (
                <button
                  key={q.de}
                  type="button"
                  onClick={() => speakGerman(`${q.de} ${q.ex}`)}
                  className="flex flex-col items-start rounded-xl border-2 border-[#E5E5E5] bg-[#F7F7F7] p-2.5 text-left transition active:scale-95"
                >
                  <span className="font-black text-[#1899D6]">
                    {q.de} <span className="text-[#777777]">— {q.en}</span>
                  </span>
                  <span className="mt-0.5 text-[11px] font-bold text-[#4B4B4B]">{q.ex}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Card 4: Numbers (0-100) & Telling the Time */}
          <section className="card-3d flex flex-col gap-3 p-4">
            <div>
              <span className="rounded-lg bg-[#FFDFE0] px-2.5 py-1 text-[10px] font-black tracking-wider text-[#EA2B2B] uppercase">
                Pillar 4 · Numbers & Time
              </span>
              <h2 className="mt-1.5 text-lg font-black text-[#4B4B4B]">
                Numbers (0–100) & Clock Time
              </h2>
              <p className="text-xs font-bold text-[#777777]">
                From 21 to 99, say the ones before the tens: 24 = vier-und-zwanzig.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-xs font-bold">
              {[
                '0 null',
                '1 eins',
                '2 zwei',
                '3 drei',
                '4 vier',
                '5 fünf',
                '6 sechs',
                '7 sieben',
                '8 acht',
                '9 neun',
                '10 zehn',
                '11 elf',
                '12 zwölf',
                '20 zwanzig',
                '30 dreißig',
                '40 vierzig',
                '50 fünfzig',
                '100 hundert',
              ].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => speakGerman(num.split(' ')[1])}
                  className="rounded-xl border border-[#E5E5E5] bg-[#F7F7F7] px-2.5 py-1.5 text-left font-black text-[#4B4B4B] active:bg-[#DDF4FF]"
                >
                  {num}
                </button>
              ))}
            </div>

            <div className="rounded-xl border-2 border-[#E5E5E5] bg-[#F7F7F7] p-3 text-xs font-bold text-[#4B4B4B]">
              <p className="font-black text-[#1899D6]">Telling the Time (Wie spät ist es?)</p>
              <ul className="mt-1.5 flex flex-col gap-1">
                <li>• <strong>8:00</strong> → Es ist acht Uhr.</li>
                <li>• <strong>8:15</strong> → Es ist Viertel nach acht.</li>
                <li>• <strong>8:30</strong> → Es ist <strong>halb neun</strong> (half to nine!).</li>
                <li>• <strong>8:45</strong> → Es ist Viertel vor neun.</li>
              </ul>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
