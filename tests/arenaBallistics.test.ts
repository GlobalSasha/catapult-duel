import { describe, expect, it } from "vitest";

import { ARENAS } from "../src/game/arena/arenaCatalog";
import type { PlayerId } from "../src/game/core/battleTypes";
import { createInitialBattleState } from "../src/game/core/createInitialBattleState";
import { simulateShot } from "../src/game/core/simulateShot";

describe("arena ballistic variety", () => {
  it("offers multiple viable angle and power bands from every base", () => {
    for (const arena of ARENAS) {
      for (const playerId of [
        "left",
        "right",
      ] as const satisfies readonly PlayerId[]) {
        const state = createInitialBattleState(arena.id);
        state.weather.id = "superheat";
        state.weather.wind = 0;
        state.protections = [];
        const targetId = playerId === "left" ? "right" : "left";
        const hits: Array<{ angle: number; power: number }> = [];

        for (let angle = 10; angle <= 80; angle += 2) {
          for (let power = 45; power <= 100; power += 1) {
            const result = simulateShot(
              {
                playerId,
                angleDeg: angle,
                power,
                projectileType: "stone",
              },
              state,
            );
            if (result.impact?.targetId === targetId) {
              hits.push({ angle, power });
            }
          }
        }

        const successfulAngles = [...new Set(hits.map(({ angle }) => angle))];
        const successfulPowers = [...new Set(hits.map(({ power }) => power))];

        expect(hits.length).toBeGreaterThanOrEqual(30);
        expect(Math.min(...successfulAngles)).toBeLessThanOrEqual(20);
        expect(Math.max(...successfulAngles)).toBeGreaterThanOrEqual(60);
        expect(successfulAngles.length).toBeGreaterThanOrEqual(20);
        expect(successfulPowers.length).toBeGreaterThanOrEqual(10);
      }
    }
  });
});
