import type { BattleState, PlayerId, PlayerState } from "./battleTypes";
import {
  DEFAULT_ARENA_ID,
  getArenaDefinition,
  getTerrainHeightAt,
  type ArenaId,
} from "../arena/arenaCatalog";
import { GAME_CONFIG } from "./gameConfig";
import { createInitialAmmunition } from "./projectileCatalog";
import { createWeatherState } from "./weather";
import {
  createArenaObstacleStates,
  createDefaultProtections,
} from "./protection";
import {
  cloneMatchPlacement,
  createDefaultMatchPlacement,
  getCatapultSlotX,
  type MatchPlacement,
} from "./placement";

function createPlayerState(
  id: PlayerId,
  arenaId: ArenaId,
  placement: MatchPlacement,
): PlayerState {
  const arena = getArenaDefinition(arenaId);
  const x = getCatapultSlotX(
    id,
    placement[id].catapultSlotIndex,
  );

  return {
    id,
    health: GAME_CONFIG.catapult.maxHealth,
    catapultX: x,
    catapultY: getTerrainHeightAt(arena.terrain, x),
    ammunition: createInitialAmmunition(),
    selectedProjectileType: "stone",
    effects: {
      burningTurnsRemaining: 0,
      frozenTurnsRemaining: 0,
    },
  };
}

export function createInitialBattleState(
  arenaId: ArenaId = DEFAULT_ARENA_ID,
  matchSeed: number = GAME_CONFIG.weather.defaultMatchSeed,
  matchPlacement: MatchPlacement = createDefaultMatchPlacement(),
): BattleState {
  const placement = cloneMatchPlacement(matchPlacement);

  return {
    arenaId,
    matchSeed: matchSeed >>> 0,
    placement,
    weather: createWeatherState(matchSeed),
    phase: GAME_CONFIG.battle.initialPhase,
    activePlayerId: GAME_CONFIG.battle.initialActivePlayerId,
    turnNumber: GAME_CONFIG.battle.initialTurnNumber,
    players: {
      left: createPlayerState("left", arenaId, placement),
      right: createPlayerState("right", arenaId, placement),
    },
    protections: createDefaultProtections(arenaId, placement),
    obstacles: createArenaObstacleStates(arenaId),
    winnerId: null,
  };
}
