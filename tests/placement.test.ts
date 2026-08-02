import { describe, expect, it } from "vitest";

import { createInitialBattleState } from "../src/game/core/createInitialBattleState";
import { GAME_CONFIG } from "../src/game/core/gameConfig";
import {
  cloneMatchPlacement,
  createDefaultMatchPlacement,
  isMatchPlacement,
  validatePlayerPlacement,
} from "../src/game/core/placement";

describe("pre-match placement", () => {
  it("starts with a valid symmetric four-point preset", () => {
    const placement = createDefaultMatchPlacement();

    expect(validatePlayerPlacement(placement.left)).toMatchObject({
      valid: true,
      spentBudget: 4,
      remainingBudget: 0,
    });
    expect(placement.right).toEqual(placement.left);
    expect(isMatchPlacement(placement)).toBe(true);
  });

  it("rejects duplicate slots, excess metal and excess budget", () => {
    expect(
      validatePlayerPlacement({
        catapultSlotIndex: 1,
        protections: [
          { slotIndex: 0, type: "wood" },
          { slotIndex: 0, type: "net" },
        ],
      }).reason,
    ).toBe("duplicate-slot");
    expect(
      validatePlayerPlacement({
        catapultSlotIndex: 1,
        protections: [
          { slotIndex: 0, type: "metal" },
          { slotIndex: 1, type: "metal" },
        ],
      }).reason,
    ).toBe("too-many-metal");
    expect(
      validatePlayerPlacement({
        catapultSlotIndex: 1,
        protections: [
          { slotIndex: 0, type: "metal" },
          { slotIndex: 1, type: "wood" },
          { slotIndex: 2, type: "net" },
          { slotIndex: 3, type: "wood" },
        ],
      }).reason,
    ).toBe("too-many-protections");
  });

  it("creates battle colliders from the chosen slots", () => {
    const placement = createDefaultMatchPlacement();
    placement.left.catapultSlotIndex = 0;
    placement.left.protections = [
      { slotIndex: 0, type: "metal" },
      { slotIndex: 4, type: "wood" },
    ];
    const state = createInitialBattleState(
      "highlands",
      GAME_CONFIG.weather.defaultMatchSeed,
      placement,
    );

    expect(state.players.left.catapultX).toBe(480);
    expect(state.protections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "left-slot-0-metal",
          type: "metal",
        }),
        expect.objectContaining({
          id: "left-slot-4-wood",
          type: "wood",
        }),
      ]),
    );
  });

  it("clones both players without sharing protection arrays", () => {
    const placement = createDefaultMatchPlacement();
    const cloned = cloneMatchPlacement(placement);
    cloned.left.protections[0]!.slotIndex = 0;

    expect(placement.left.protections[0]?.slotIndex).toBe(2);
    expect(cloned.left.protections).not.toBe(placement.left.protections);
  });
});
