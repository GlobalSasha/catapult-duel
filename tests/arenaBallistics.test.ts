import { describe, expect, it } from "vitest";

import { ARENAS } from "../src/game/arena/arenaCatalog";
import type { PlayerId } from "../src/game/core/battleTypes";
import { createInitialBattleState } from "../src/game/core/createInitialBattleState";
import { simulateShot } from "../src/game/core/simulateShot";
import { createDefaultMatchPlacement } from "../src/game/core/placement";

describe("arena ballistic variety", () => {
  it("offers multiple viable angle and power bands from every base", () => {
    for (const arena of ARENAS) {
      for (const playerId of [
        "left",
        "right",
      ] as const satisfies readonly PlayerId[]) {
        const placement = createDefaultMatchPlacement();
        placement.left.protections = [];
        placement.right.protections = [];
        const state = createInitialBattleState(
          arena.id,
          undefined,
          placement,
        );
        state.weather.id = "superheat";
        state.weather.wind = 0;
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

        const label = `${arena.id}:${playerId}`;

        expect(hits.length, label).toBeGreaterThanOrEqual(13);
        expect(Math.min(...successfulAngles), label).toBeLessThanOrEqual(22);
        expect(Math.max(...successfulAngles), label).toBeGreaterThanOrEqual(58);
        expect(successfulAngles.length, label).toBeGreaterThanOrEqual(13);
        expect(successfulPowers.length, label).toBeGreaterThanOrEqual(9);
      }
    }
  }, 15_000);
});
