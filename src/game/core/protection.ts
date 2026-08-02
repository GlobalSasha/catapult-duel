import {
  getArenaDefinition,
  getTerrainHeightAt,
  type ArenaId,
} from "../arena/arenaCatalog";
import type { PlayerId } from "./battleTypes";
import { GAME_CONFIG } from "./gameConfig";
import {
  createDefaultMatchPlacement,
  getProtectionSlotCenterX,
  type MatchPlacement,
} from "./placement";

export const PROTECTION_TYPES = ["wood", "net", "metal"] as const;

export type ProtectionType = (typeof PROTECTION_TYPES)[number];

export function isProtectionType(
  value: unknown,
): value is ProtectionType {
  return PROTECTION_TYPES.includes(value as ProtectionType);
}

export interface ProtectionState {
  id: string;
  ownerId: PlayerId;
  type: ProtectionType;
  x: number;
  y: number;
  width: number;
  height: number;
  durability: number;
  maxDurability: number;
  interceptCount: number;
}

export interface ArenaObstacleState {
  id: string;
  durability: number;
  maxDurability: number;
}

export function getProtectionDefinition(type: ProtectionType) {
  return GAME_CONFIG.protections[type];
}

export function createDefaultProtections(
  arenaId: ArenaId,
  matchPlacement: MatchPlacement = createDefaultMatchPlacement(),
): ProtectionState[] {
  const arena = getArenaDefinition(arenaId);

  return (["left", "right"] as const).flatMap((ownerId) =>
    matchPlacement[ownerId].protections.map(({ type, slotIndex }) => {
      const definition = getProtectionDefinition(type);
      const centerX = getProtectionSlotCenterX(ownerId, slotIndex);
      const x = centerX - definition.width / 2;

      return {
        id: `${ownerId}-slot-${slotIndex}-${type}`,
        ownerId,
        type,
        x,
        y:
          getTerrainHeightAt(arena.terrain, centerX) -
          definition.height,
        width: definition.width,
        height: definition.height,
        durability: definition.maxDurability,
        maxDurability: definition.maxDurability,
        interceptCount: 0,
      };
    }),
  );
}

export function createArenaObstacleStates(
  arenaId: ArenaId,
): Record<string, ArenaObstacleState> {
  const arena = getArenaDefinition(arenaId);

  return Object.fromEntries(
    arena.obstacles.map((obstacle) => {
      const maxDurability =
        GAME_CONFIG.arenaObstacles[obstacle.kind].maxDurability;

      return [
        obstacle.id,
        {
          id: obstacle.id,
          durability: maxDurability,
          maxDurability,
        },
      ];
    }),
  );
}
