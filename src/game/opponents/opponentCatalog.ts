import type { AiDifficulty } from "../core/matchSession";

export interface OpponentDefinition {
  difficulty: AiDifficulty;
  displayName: string;
  rankLabel: string;
  description: string;
  doctrine: string;
  accentColor: number;
  accentTextColor: string;
}

export const OPPONENTS: readonly OpponentDefinition[] = [
  {
    difficulty: "easy",
    displayName: "КАРТЕЧНИК",
    rankLabel: "НОВОБРАНЕЦ",
    description: "Стреляет быстро, но часто ошибается в расчётах",
    doctrine: "ПРЯМАЯ АТАКА",
    accentColor: 0x74d6a0,
    accentTextColor: "#a9ebc5",
  },
  {
    difficulty: "normal",
    displayName: "ИНЖЕНЕР ОСАДЫ",
    rankLabel: "ВЕТЕРАН",
    description: "Учитывает ветер, рельеф и безопасную траекторию",
    doctrine: "ТОЧНЫЙ РАСЧЁТ",
    accentColor: 0x45d5df,
    accentTextColor: "#9eeef3",
  },
  {
    difficulty: "hard",
    displayName: "МАРШАЛ ПЕПЛА",
    rankLabel: "ЭЛИТА",
    description: "Меняет боеприпасы и ищет наиболее опасный выстрел",
    doctrine: "ПОЛНОЕ РАЗРУШЕНИЕ",
    accentColor: 0xff7557,
    accentTextColor: "#ffb29f",
  },
] as const;

export function getOpponentDefinition(
  difficulty: AiDifficulty,
): OpponentDefinition {
  return (
    OPPONENTS.find((opponent) => opponent.difficulty === difficulty) ??
    OPPONENTS[1]
  );
}

export function isOpponentDisplayName(value: string): boolean {
  return OPPONENTS.some((opponent) => opponent.displayName === value);
}
