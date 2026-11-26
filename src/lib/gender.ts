export type GermanArticle = 'der' | 'die' | 'das' | null | undefined;

export interface GenderStyle {
  articleText: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  label: string;
}

/** der = blue, die = red, das = green (kept consistent across the app). */
export function getGenderStyle(article: GermanArticle): GenderStyle | null {
  switch (article) {
    case 'der':
      return {
        articleText: 'text-[#1899D6]',
        badgeBg: 'bg-[#DDF4FF]',
        badgeBorder: 'border-[#84D8FF]',
        badgeText: 'text-[#1899D6]',
        label: 'masculine',
      };
    case 'die':
      return {
        articleText: 'text-[#EA2B2B]',
        badgeBg: 'bg-[#FFDFE0]',
        badgeBorder: 'border-[#FFB3B3]',
        badgeText: 'text-[#EA2B2B]',
        label: 'feminine',
      };
    case 'das':
      return {
        articleText: 'text-[#58A700]',
        badgeBg: 'bg-[#D7FFB8]',
        badgeBorder: 'border-[#A5E56B]',
        badgeText: 'text-[#58A700]',
        label: 'neuter',
      };
    default:
      return null;
  }
}

export function formatGermanWithArticle(german: string, article: GermanArticle): string {
  if (!article) return german;
  const lower = german.trim().toLowerCase();
  if (lower.startsWith(`${article} `)) return german.trim();
  return `${article} ${german.trim()}`;
}
