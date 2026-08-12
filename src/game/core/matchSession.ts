import type { PlayerId } from "./battleTypes";
import { createCastlePlayerPlacement } from "./placement";

export type GameMode = "ai" | "local";
export type AiDifficulty = "easy" | "normal" | "hard";

export interface MatchSettings {
  mode: GameMode;
  aiDifficulty: AiDifficulty;
  playerNames: Record<PlayerId, string>;
}

export interface RatingRecord {
  name: string;
  rating: number;
  wins: number;
  losses: number;
}

export interface PlayerProfile {
  settings: MatchSettings;
  ratings: Record<string, RatingRecord>;
}

export interface MatchRatingResult {
  winner: RatingRecord;
  loser?: RatingRecord;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const MATCH_SETTINGS_REGISTRY_KEY = "match-settings";
const PROFILE_STORAGE_KEY = "catapult-duel:profile:v1";
const STARTING_RATING = 1000;

export function createDefaultMatchSettings(): MatchSettings {
  return {
    mode: "ai",
    aiDifficulty: "normal",
    playerNames: {
      left: "ИГРОК 1",
      right: "РАЗБОЙНИК AI",
    },
  };
}

export function normalizePlayerName(value: string, fallback: string): string {
  const normalized = value.replace(/\s+/g, " ").trim().slice(0, 16);
  return normalized || fallback;
}

export function isMatchSettings(value: unknown): value is MatchSettings {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<MatchSettings>;
  return (
    (candidate.mode === "ai" || candidate.mode === "local") &&
    (candidate.aiDifficulty === "easy" ||
      candidate.aiDifficulty === "normal" ||
      candidate.aiDifficulty === "hard") &&
    typeof candidate.playerNames?.left === "string" &&
    typeof candidate.playerNames?.right === "string"
  );
}

export function readMatchSettings(value: unknown): MatchSettings {
  return isMatchSettings(value)
    ? {
        mode: value.mode,
        aiDifficulty: value.aiDifficulty,
        playerNames: { ...value.playerNames },
      }
    : createDefaultMatchSettings();
}

function getBrowserStorage(): StorageLike | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function ratingKey(name: string): string {
  return name.toLocaleLowerCase("ru-RU");
}

function createRating(name: string): RatingRecord {
  return { name, rating: STARTING_RATING, wins: 0, losses: 0 };
}

export function loadPlayerProfile(
  storage: StorageLike | undefined = getBrowserStorage(),
): PlayerProfile {
  const fallback: PlayerProfile = {
    settings: createDefaultMatchSettings(),
    ratings: {},
  };

  if (!storage) {
    return fallback;
  }

  try {
    const raw = storage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    const settings = readMatchSettings(parsed.settings);
    const ratings =
      parsed.ratings && typeof parsed.ratings === "object"
        ? parsed.ratings
        : {};

    return { settings, ratings };
  } catch {
    return fallback;
  }
}

export function saveMatchSettings(
  settings: MatchSettings,
  storage: StorageLike | undefined = getBrowserStorage(),
): void {
  if (!storage) {
    return;
  }

  const profile = loadPlayerProfile(storage);
  profile.settings = readMatchSettings(settings);
  storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

export function getRatingForPlayer(
  name: string,
  storage: StorageLike | undefined = getBrowserStorage(),
): RatingRecord {
  const profile = loadPlayerProfile(storage);
  return profile.ratings[ratingKey(name)] ?? createRating(name);
}

export function getRatingLeaderboard(
  storage: StorageLike | undefined = getBrowserStorage(),
): RatingRecord[] {
  return Object.values(loadPlayerProfile(storage).ratings)
    .sort((a, b) => b.rating - a.rating || b.wins - a.wins)
    .slice(0, 5);
}

export function recordMatchResult(
  settings: MatchSettings,
  winnerId: PlayerId,
  storage: StorageLike | undefined = getBrowserStorage(),
): MatchRatingResult {
  const profile = loadPlayerProfile(storage);
  const winnerName = settings.playerNames[winnerId];
  const loserId: PlayerId = winnerId === "left" ? "right" : "left";
  const loserName = settings.playerNames[loserId];
  const winnerKey = ratingKey(winnerName);
  const loserKey = ratingKey(loserName);
  const winner = profile.ratings[winnerKey] ?? createRating(winnerName);
  const loser = profile.ratings[loserKey] ?? createRating(loserName);

  const tracksWinner = settings.mode === "local" || winnerId === "left";
  if (tracksWinner) {
    winner.name = winnerName;
    winner.rating += 25;
    winner.wins += 1;
    profile.ratings[winnerKey] = winner;
  }

  const tracksLoser = settings.mode === "local" || loserId === "left";
  if (tracksLoser) {
    loser.name = loserName;
    loser.rating = Math.max(0, loser.rating - 15);
    loser.losses += 1;
    profile.ratings[loserKey] = loser;
  }

  profile.settings = readMatchSettings(settings);
  storage?.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));

  return { winner: { ...winner }, loser: tracksLoser ? { ...loser } : undefined };
}

export function createAiPlacement(difficulty: AiDifficulty) {
  const catapultSlotIndex = difficulty === "hard" ? 0 : 1;

  return createCastlePlayerPlacement(
    "right",
    catapultSlotIndex,
    true,
  );
}
