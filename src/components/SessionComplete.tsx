import { useMemo } from 'react';
import { Flame, Target, Zap } from 'lucide-react';
import { playSound } from '../lib/gameState';
import { useEffect } from 'react';

interface SessionCompleteProps {
  title: string;
  correctCount: number;
  gradedTotal: number;
  sessionXp: number;
  streak: number;
  streakExtendedToday: boolean;
  discoveredCount: number;
  reviewCount: number;
  onExit: () => void;
}

const CONFETTI_COLORS = ['#58CC02', '#1CB0F6', '#FFC800', '#FF4B4B', '#FF9600', '#CE82FF'];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        duration: 2.4 + Math.random() * 2,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      })),
    []
  );
  return (
    <>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </>
  );
}

export default function SessionComplete({
  title,
  correctCount,
  gradedTotal,
  sessionXp,
  streak,
  streakExtendedToday,
  discoveredCount,
  reviewCount,
  onExit,
}: SessionCompleteProps) {
  const accuracy = gradedTotal > 0 ? Math.round((correctCount / gradedTotal) * 100) : 100;

  useEffect(() => {
    playSound('complete');
  }, []);

  return (
    <div className="flex flex-1 flex-col justify-between gap-6 py-4 text-center">
      <Confetti />

      <div className="flex flex-col items-center gap-3 pt-6">
        <div className="animate-pop flex h-28 w-28 items-center justify-center rounded-full border-b-8 border-[#E5A500] bg-[#FFC800] text-6xl">
          🏆
        </div>
        <h1 className="animate-fade-in text-3xl font-black text-[#FFC800]">Lesson complete!</h1>
        <p className="text-sm font-bold text-[#AFAFAF]">{title}</p>
        {(discoveredCount > 0 || reviewCount > 0) && (
          <p className="text-xs font-black tracking-wider text-[#1899D6] uppercase">
            {discoveredCount > 0 ? `${discoveredCount} new words learned` : `${reviewCount} words reviewed`}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border-2 border-[#FFC800] bg-[#FFC800]">
          <p className="py-1 text-[11px] font-black tracking-wider text-white uppercase">Total XP</p>
          <div className="flex items-center justify-center gap-1 rounded-b-xl bg-white py-3 text-xl font-black text-[#E5A500]">
            <Zap className="h-5 w-5 fill-[#FFC800] text-[#FFC800]" />+{sessionXp}
          </div>
        </div>
        <div className="rounded-2xl border-2 border-[#58CC02] bg-[#58CC02]">
          <p className="py-1 text-[11px] font-black tracking-wider text-white uppercase">Accuracy</p>
          <div className="flex items-center justify-center gap-1 rounded-b-xl bg-white py-3 text-xl font-black text-[#58A700]">
            <Target className="h-5 w-5" />
            {accuracy}%
          </div>
        </div>
        <div className="rounded-2xl border-2 border-[#FF9600] bg-[#FF9600]">
          <p className="py-1 text-[11px] font-black tracking-wider text-white uppercase">Streak</p>
          <div className="flex items-center justify-center gap-1 rounded-b-xl bg-white py-3 text-xl font-black text-[#FF9600]">
            <Flame className="h-5 w-5 fill-[#FF9600]" />
            {streak}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold text-[#777777]">
          {correctCount}/{gradedTotal} correct ·{' '}
          {streakExtendedToday
            ? `🔥 Day streak extended to ${streak} ${streak === 1 ? 'day' : 'days'}!`
            : `🔥 You already kept your streak today (${streak} ${streak === 1 ? 'day' : 'days'})`}
        </p>
      </div>

      <button type="button" onClick={onExit} className="btn-3d btn-green w-full !min-h-14 !text-base">
        Back to path
      </button>
    </div>
  );
}
