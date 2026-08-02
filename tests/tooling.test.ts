import { describe, expect, it } from "vitest";

import { GAME_CONFIG } from "../src/game/core/gameConfig";

describe("project tooling", () => {
  it("runs TypeScript tests", () => {
    const supportedInputs = ["mouse", "touch"] as const;

    expect(supportedInputs).toEqual(["mouse", "touch"]);
  });

  it("plays the projectile more slowly than the deterministic simulation", () => {
    expect(GAME_CONFIG.projectiles.stone.playbackScale).toBeGreaterThan(1);
  });
});
