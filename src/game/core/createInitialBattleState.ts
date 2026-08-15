import type {
  BattleState,
  KnightSquadState,
  PlayerId,
  PlayerState,
} from "./battleTypes";
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
  getProtectionDefinition,
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
  const groundY = getTerrainHeightAt(arena.terrain, x);
  const hasCastle = placement[id].protections.length > 0;

  return {
    id,
    health: GAME_CONFIG.catapult.maxHealth,
    repairUsed: false,
    catapultX: x,
    catapultY: hasCastle
      ? groundY - getProtectionDefinition("castle").height + 8
      : groundY,
    ammunition: createInitialAmmunition(),
    selectedProjectileType: "stone",
    effects: {
      burningTurnsRemaining: 0,
      frozenTurnsRemaining: 0,
    },
  };
}

function createKnightSquadState(
  ownerId: PlayerId,
  arenaId: ArenaId,
  players: Record<PlayerId, PlayerState>,
): KnightSquadState {
  const direction = ownerId === "left" ? 1 : -1;
  const x =
    players[ownerId].catapultX +
    direction * GAME_CONFIG.knights.spawnOffset;

  return {
    ownerId,
    health: GAME_CONFIG.knights.maxHealth,
    progress: 0,
    x,
    y: getTerrainHeightAt(getArenaDefinition(arenaId).terrain, x),
  };
}

export function createInitialBattleState(
  arenaId: ArenaId = DEFAULT_ARENA_ID,
  matchSeed: number = GAME_CONFIG.weather.defaultMatchSeed,
  matchPlacement: MatchPlacement = createDefaultMatchPlacement(),
): BattleState {
  const placement = cloneMatchPlacement(matchPlacement);
  const players = {
    left: createPlayerState("left", arenaId, placement),
    right: createPlayerState("right", arenaId, placement),
  };

  return {
    arenaId,
    matchSeed: matchSeed >>> 0,
    placement,
    weather: createWeatherState(matchSeed),
    phase: GAME_CONFIG.battle.initialPhase,
    activePlayerId: GAME_CONFIG.battle.initialActivePlayerId,
    turnNumber: GAME_CONFIG.battle.initialTurnNumber,
    players,
    knightSquads: {
      left: createKnightSquadState("left", arenaId, players),
      right: createKnightSquadState("right", arenaId, players),
    },
    protections: createDefaultProtections(arenaId, placement),
    obstacles: createArenaObstacleStates(arenaId),
    winnerId: null,
    isDraw: false,
    victoryReason: null,
  };
}
