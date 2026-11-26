import { useEffect, useRef, useState } from 'react';
import { Lightbulb, Turtle, Volume2 } from 'lucide-react';
import type { LearningItem } from '../types/database';
import { formatGermanWithArticle, getGenderStyle } from '../lib/gender';
import { speakGerman } from '../lib/speech';

interface DiscoveryCardProps {
  item: LearningItem;
  onContinue: () => void;
}

function SoundWave() {
  return (
    <span className="flex h-6 items-center gap-[3px]" aria-hidden="true">
      {[0, 0.12, 0.24, 0.1].map((delay, i) => (
        <span key={i} className="sound-bar" style={{ animationDelay: `${delay}s` }} />
      ))}
    </span>
  );
}

export default function DiscoveryCard({ item, onContinue }: DiscoveryCardProps) {
  const gender = getGenderStyle(item.article);
  const fullWord = formatGermanWithArticle(item.german, item.article);
  const [playing, setPlaying] = useState<'normal' | 'slow' | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );

  const play = (text: string, rate: number, kind: 'normal' | 'slow') => {
    speakGerman(text, rate);
    setPlaying(kind);
    if (timer.current) window.clearTimeout(timer.current);
    const ms = Math.min(6000, Math.max(1100, (text.length * 95) / rate));
    timer.current = window.setTimeout(() => setPlaying(null), ms);
  };

  return (
    <div className="animate-fade-in flex flex-1 flex-col justify-between gap-5">
      <div className="flex flex-col gap-4">
        {/* Collector card */}
        <section className="relative overflow-hidden rounded-3xl border-2 border-b-4 border-[#84D8FF] bg-[#DDF4FF] p-5 pt-7 text-center">
          <span className="absolute top-0 left-1/2 -translate-x-1/2 rounded-b-xl bg-[#1CB0F6] px-4 py-1 text-[11px] font-black tracking-widest text-white uppercase">
            ✨ New Word
          </span>

          <div className="flex min-h-6 flex-wrap items-center justify-center gap-2">
            {item.article && gender && (
              <span
                className={`rounded-xl border-2 px-2.5 py-0.5 text-xs font-black uppercase ${gender.badgeBg} ${gender.badgeBorder} ${gender.badgeText}`}
              >
                {gender.label}
              </span>
            )}
            <span className="rounded-xl bg-white/80 px-2.5 py-0.5 text-xs font-black text-[#AFAFAF] uppercase">
              {item.item_type}
            </span>
            {item.plural && (
              <span className="rounded-xl bg-white/80 px-2.5 py-0.5 text-xs font-black text-[#4B4B4B]">
                Pl. {item.plural}
              </span>
            )}
          </div>

          <h2 className="mt-3 text-4xl font-black tracking-tight text-[#4B4B4B]">
            {item.article && gender && <span className={`mr-2 ${gender.articleText}`}>{item.article}</span>}
            {item.german}
          </h2>
          <p className="mt-1 text-xl font-bold text-[#777777]">{item.translation}</p>

          {/* Big animated audio buttons */}
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => play(fullWord, 0.92, 'normal')}
              className="btn-3d btn-blue !h-16 !min-w-[148px] !rounded-2xl !text-base"
              aria-label={`Listen to ${fullWord} at normal speed`}
            >
              {playing === 'normal' ? <SoundWave /> : <Volume2 className="h-6 w-6" />}
              <span>Normal</span>
            </button>
            <button
              type="button"
              onClick={() => play(fullWord, 0.62, 'slow')}
              className="btn-3d btn-white !h-16 !min-w-[110px] !rounded-2xl !text-base"
              aria-label={`Listen to ${fullWord} slowly`}
            >
              {playing === 'slow' ? <SoundWave /> : <Turtle className="h-6 w-6" />}
              <span>Slow</span>
            </button>
          </div>
        </section>

        {/* Example sentence */}
        <section className="card-3d p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black tracking-wider text-[#AFAFAF] uppercase">In context</p>
              <p className="mt-1.5 text-lg leading-snug font-black text-[#4B4B4B]">{item.sentence_de}</p>
              <p className="mt-1 text-sm font-bold text-[#777777]">{item.sentence_translation}</p>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <button
                type="button"
                onClick={() => play(item.sentence_de, 0.92, 'normal')}
                className="btn-3d btn-white !h-11 !min-h-0 !w-11 !rounded-xl !px-0"
                aria-label="Listen to example sentence at normal speed"
                title="Normal speed"
              >
                <Volume2 className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => play(item.sentence_de, 0.62, 'slow')}
                className="btn-3d btn-white !h-11 !min-h-0 !w-11 !rounded-xl !px-0 !text-[#E5A500]"
                aria-label="Listen to example sentence slowly"
                title="Slow speed"
              >
                <Turtle className="h-5 w-5" />
              </button>
            </div>
          </div>
        </section>

        {/* Grammar tip */}
        {item.grammar_tip && (
          <section className="flex items-start gap-3 rounded-2xl border-2 border-b-4 border-[#FFE27A] bg-[#FFF8D6] p-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFC800] text-white">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-black tracking-wider text-[#E5A500] uppercase">Grammar tip</p>
              <p className="text-sm leading-relaxed font-bold text-[#6B5B00]">{item.grammar_tip}</p>
            </div>
          </section>
        )}
      </div>

      <button type="button" onClick={onContinue} className="btn-3d btn-green w-full !min-h-14 !text-base">
        Got it, continue
      </button>
    </div>
  );
}
