import type { PlayerId } from "./battleTypes";
import { GAME_CONFIG } from "./gameConfig";
import type { ProtectionType } from "./protection";

const VALID_PROTECTION_TYPES: readonly ProtectionType[] = [
  "wood",
  "net",
  "metal",
];

export interface ProtectionPlacement {
  slotIndex: number;
  type: ProtectionType;
}

export interface PlayerPlacement {
  catapultSlotIndex: number;
  protections: ProtectionPlacement[];
}

export type MatchPlacement = Record<PlayerId, PlayerPlacement>;

export interface PlacementValidation {
  valid: boolean;
  spentBudget: number;
  remainingBudget: number;
  reason:
    | "invalid-catapult-slot"
    | "invalid-protection-slot"
    | "invalid-protection-type"
    | "duplicate-slot"
    | "too-many-protections"
    | "too-many-metal"
    | "over-budget"
    | null;
}

export function createDefaultMatchPlacement(): MatchPlacement {
  const createPlayer = (): PlayerPlacement => ({
    catapultSlotIndex: 1,
    protections: [
      { slotIndex: 2, type: "wood" },
      { slotIndex: 3, type: "net" },
      { slotIndex: 4, type: "metal" },
    ],
  });

  return {
    left: createPlayer(),
    right: createPlayer(),
  };
}

export function cloneMatchPlacement(
  placement: MatchPlacement,
): MatchPlacement {
  return {
    left: {
      ...placement.left,
      protections: placement.left.protections.map((item) => ({
        ...item,
      })),
    },
    right: {
      ...placement.right,
      protections: placement.right.protections.map((item) => ({
        ...item,
      })),
    },
  };
}

export function getProtectionCost(type: ProtectionType): number {
  return GAME_CONFIG.protections[type].cost;
}

export function validatePlayerPlacement(
  placement: PlayerPlacement,
): PlacementValidation {
  const hasInvalidProtectionType = placement.protections.some(
    ({ type }) => !VALID_PROTECTION_TYPES.includes(type),
  );
  const spentBudget = hasInvalidProtectionType
    ? 0
    : placement.protections.reduce(
        (sum, item) => sum + getProtectionCost(item.type),
        0,
      );
  const result = (
    valid: boolean,
    reason: PlacementValidation["reason"],
  ): PlacementValidation => ({
    valid,
    spentBudget,
    remainingBudget:
      GAME_CONFIG.placement.protectionBudget - spentBudget,
    reason,
  });

  if (
    !Number.isInteger(placement.catapultSlotIndex) ||
    placement.catapultSlotIndex < 0 ||
    placement.catapultSlotIndex >=
      GAME_CONFIG.placement.catapultSlots.left.length
  ) {
    return result(false, "invalid-catapult-slot");
  }

  if (
    placement.protections.some(
      ({ slotIndex }) =>
        !Number.isInteger(slotIndex) ||
        slotIndex < 0 ||
        slotIndex >=
          GAME_CONFIG.placement.protectionSlotCenters.left.length,
    )
  ) {
    return result(false, "invalid-protection-slot");
  }

  if (hasInvalidProtectionType) {
    return result(false, "invalid-protection-type");
  }

  if (
    new Set(placement.protections.map(({ slotIndex }) => slotIndex))
      .size !== placement.protections.length
  ) {
    return result(false, "duplicate-slot");
  }

  if (
    placement.protections.length >
    GAME_CONFIG.placement.maximumProtectionCount
  ) {
    return result(false, "too-many-protections");
  }

  if (
    placement.protections.filter(({ type }) => type === "metal")
      .length > GAME_CONFIG.placement.maximumMetalCount
  ) {
    return result(false, "too-many-metal");
  }

  if (spentBudget > GAME_CONFIG.placement.protectionBudget) {
    return result(false, "over-budget");
  }

  return result(true, null);
}

export function isMatchPlacement(
  value: unknown,
): value is MatchPlacement {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<MatchPlacement>;

  return (["left", "right"] as const).every((playerId) => {
    const placement = candidate[playerId];
    return (
      Boolean(placement) &&
      Array.isArray(placement?.protections) &&
      validatePlayerPlacement(placement as PlayerPlacement).valid
    );
  });
}

export function getCatapultSlotX(
  playerId: PlayerId,
  slotIndex: number,
): number {
  return (
    GAME_CONFIG.placement.catapultSlots[playerId][slotIndex] ??
    GAME_CONFIG.placement.catapultSlots[playerId][1]
  );
}

export function getProtectionSlotCenterX(
  playerId: PlayerId,
  slotIndex: number,
): number {
  return (
    GAME_CONFIG.placement.protectionSlotCenters[playerId][slotIndex] ??
    GAME_CONFIG.placement.protectionSlotCenters[playerId][2]
  );
}
