import { describe, expect, it } from "vitest";

import {
  createDefaultMatchSettings,
  getRatingForPlayer,
  loadPlayerProfile,
  recordMatchResult,
  saveMatchSettings,
} from "../src/game/core/matchSession";

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("match profile", () => {
  it("stores names, mode and AI difficulty", () => {
    const storage = createMemoryStorage();
    const settings = createDefaultMatchSettings();
    settings.playerNames.left = "Алекс";
    settings.aiDifficulty = "hard";

    saveMatchSettings(settings, storage);

    expect(loadPlayerProfile(storage).settings).toEqual(settings);
  });

  it("updates a human rating after an AI match", () => {
    const storage = createMemoryStorage();
    const settings = createDefaultMatchSettings();
    settings.playerNames.left = "Алекс";

    recordMatchResult(settings, "left", storage);
    recordMatchResult(settings, "right", storage);

    expect(getRatingForPlayer("Алекс", storage)).toMatchObject({
      rating: 1010,
      wins: 1,
      losses: 1,
    });
  });

  it("updates both players in a local match", () => {
    const storage = createMemoryStorage();
    const settings = createDefaultMatchSettings();
    settings.mode = "local";
    settings.playerNames = { left: "Первый", right: "Второй" };

    recordMatchResult(settings, "right", storage);

    expect(getRatingForPlayer("Первый", storage).rating).toBe(985);
    expect(getRatingForPlayer("Второй", storage).rating).toBe(1025);
  });
});
