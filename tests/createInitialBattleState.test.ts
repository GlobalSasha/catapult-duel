import { describe, expect, expectTypeOf, it } from "vitest";

import type {
  BattlePhase,
  BattleState,
  PlayerId,
} from "../src/game/core/battleTypes";
import {
  DEFAULT_ARENA_ID,
  getArenaDefinition,
  getTerrainHeightAt,
} from "../src/game/arena/arenaCatalog";
import { createInitialBattleState } from "../src/game/core/createInitialBattleState";
import { GAME_CONFIG } from "../src/game/core/gameConfig";
import { createInitialAmmunition } from "../src/game/core/projectileCatalog";
import { createWeatherState } from "../src/game/core/weather";
import {
  createArenaObstacleStates,
  createDefaultProtections,
} from "../src/game/core/protection";
import { createDefaultMatchPlacement } from "../src/game/core/placement";

describe("createInitialBattleState", () => {
  it("creates the configured P0 starting state", () => {
    const state = createInitialBattleState();
    const arena = getArenaDefinition(DEFAULT_ARENA_ID);

    expect(state).toEqual({
      arenaId: DEFAULT_ARENA_ID,
      matchSeed: GAME_CONFIG.weather.defaultMatchSeed,
      placement: createDefaultMatchPlacement(),
      weather: createWeatherState(
        GAME_CONFIG.weather.defaultMatchSeed,
      ),
      phase: GAME_CONFIG.battle.initialPhase,
      activePlayerId: GAME_CONFIG.battle.initialActivePlayerId,
      turnNumber: GAME_CONFIG.battle.initialTurnNumber,
      players: {
        left: {
          id: "left",
          health: GAME_CONFIG.catapult.maxHealth,
          catapultX: arena.spawnX.left,
          catapultY: getTerrainHeightAt(
            arena.terrain,
            arena.spawnX.left,
          ),
          ammunition: createInitialAmmunition(),
          selectedProjectileType: "stone",
          effects: {
            burningTurnsRemaining: 0,
            frozenTurnsRemaining: 0,
          },
        },
        right: {
          id: "right",
          health: GAME_CONFIG.catapult.maxHealth,
          catapultX: arena.spawnX.right,
          catapultY: getTerrainHeightAt(
            arena.terrain,
            arena.spawnX.right,
          ),
          ammunition: createInitialAmmunition(),
          selectedProjectileType: "stone",
          effects: {
            burningTurnsRemaining: 0,
            frozenTurnsRemaining: 0,
          },
        },
      },
      protections: createDefaultProtections(DEFAULT_ARENA_ID),
      obstacles: createArenaObstacleStates(DEFAULT_ARENA_ID),
      winnerId: null,
    });
  });

  it("creates independent state and player objects", () => {
    const firstState = createInitialBattleState();
    const secondState = createInitialBattleState();

    firstState.players.left.health = 0;
    firstState.weather.wind = 999;
    firstState.protections[0]!.durability = 0;
    firstState.obstacles["highlands-center-ridge"]!.durability = 0;

    expect(firstState).not.toBe(secondState);
    expect(firstState.players).not.toBe(secondState.players);
    expect(firstState.players.left).not.toBe(secondState.players.left);
    expect(secondState.players.left.health).toBe(
      GAME_CONFIG.catapult.maxHealth,
    );
    expect(secondState.weather.wind).not.toBe(999);
    expect(secondState.protections[0]?.durability).toBeGreaterThan(0);
    expect(
      secondState.obstacles["highlands-center-ridge"]?.durability,
    ).toBeGreaterThan(0);
  });

  it("keeps player and phase values constrained by TypeScript", () => {
    expectTypeOf<PlayerId>().toEqualTypeOf<"left" | "right">();
    expectTypeOf<BattlePhase>().toEqualTypeOf<
      "aiming" | "projectile-flight" | "resolving" | "finished"
    >();
    expectTypeOf(createInitialBattleState()).toEqualTypeOf<BattleState>();
  });
});
