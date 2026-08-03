import { describe, expect, it } from "vitest";

import {
  ARENAS,
  getTerrainHeightAt,
} from "../src/game/arena/arenaCatalog";
import { circleIntersectsTerrain } from "../src/game/core/collision";
import { createInitialBattleState } from "../src/game/core/createInitialBattleState";
import { GAME_CONFIG } from "../src/game/core/gameConfig";
import {
  DEFAULT_SHOT_ENVIRONMENT,
  simulateShot,
} from "../src/game/core/simulateShot";

describe("large arenas", () => {
  it("ships twelve authored worlds with distinct identities", () => {
    expect(ARENAS).toHaveLength(12);
    expect(new Set(ARENAS.map(({ textureKey }) => textureKey)).size).toBe(12);
    expect(new Set(ARENAS.map(({ timeLabel }) => timeLabel)).size).toBeGreaterThanOrEqual(10);
    expect(ARENAS.every(({ terrain }) => terrain.length >= 19)).toBe(true);
  });
  it("keeps opposing catapults outside one viewport", () => {
    expect(GAME_CONFIG.world.width).toBe(
      GAME_CONFIG.viewport.width * 3.375,
    );

    ARENAS.forEach((arena) => {
      expect(arena.spawnX.right - arena.spawnX.left).toBeGreaterThan(
        GAME_CONFIG.viewport.width,
      );
    });
  });

  it("uses the authored terrain height for both spawn points", () => {
    ARENAS.forEach((arena) => {
      const state = createInitialBattleState(arena.id);

      expect(state.players.left.catapultY).toBe(
        getTerrainHeightAt(arena.terrain, arena.spawnX.left),
      );
      expect(state.players.right.catapultY).toBe(
        getTerrainHeightAt(arena.terrain, arena.spawnX.right),
      );
    });
  });

  it("gives the arenas opposite height advantages", () => {
    const highlands = createInitialBattleState("highlands");
    const canyon = createInitialBattleState("canyon");

    expect(
      highlands.players.left.catapultY -
        highlands.players.right.catapultY,
    ).toBeGreaterThanOrEqual(120);
    expect(
      canyon.players.right.catapultY - canyon.players.left.catapultY,
    ).toBeGreaterThanOrEqual(120);
  });

  it("interpolates slopes and detects the visible terrain surface", () => {
    const terrain = [
      { x: 0, y: 700 },
      { x: 100, y: 600 },
    ];

    expect(getTerrainHeightAt(terrain, 50)).toBe(650);
    expect(
      circleIntersectsTerrain(
        { x: 50, y: 639, radius: 10 },
        terrain,
      ),
    ).toBe(false);
    expect(
      circleIntersectsTerrain(
        { x: 50, y: 640, radius: 10 },
        terrain,
      ),
    ).toBe(true);
  });

  it("ends a shot on a physical obstacle before terrain", () => {
    const state = createInitialBattleState();
    const shooter = state.players.left;
    const environment = {
      ...DEFAULT_SHOT_ENVIRONMENT,
      terrain: [
        { x: 0, y: 890 },
        { x: GAME_CONFIG.world.width, y: 890 },
      ],
      obstacles: [
        {
          id: "test-wall",
          x: shooter.catapultX + 100,
          y: shooter.catapultY - 100,
          width: 120,
          height: 160,
        },
      ],
    };
    const shot = simulateShot(
      {
        playerId: "left",
        angleDeg: 10,
        power: 20,
        projectileType: "stone",
      },
      state,
      environment,
    );

    expect(shot.endReason).toBe("obstacle");
    expect(shot.impact).toBeNull();
  });
});
