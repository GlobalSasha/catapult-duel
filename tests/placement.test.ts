import { describe, expect, it } from "vitest";

import { createInitialBattleState } from "../src/game/core/createInitialBattleState";
import { GAME_CONFIG } from "../src/game/core/gameConfig";
import {
  cloneMatchPlacement,
  createCastlePlayerPlacement,
  createDefaultMatchPlacement,
  isMatchPlacement,
  validatePlayerPlacement,
} from "../src/game/core/placement";

describe("pre-match placement", () => {
  it("starts with a valid symmetric castle preset", () => {
    const placement = createDefaultMatchPlacement();

    expect(validatePlayerPlacement(placement.left)).toMatchObject({
      valid: true,
      spentBudget: 1,
      remainingBudget: 0,
    });
    expect(placement.right.protections.map(({ type, slotIndex }) => ({
      type,
      slotIndex,
    }))).toEqual(
      placement.left.protections.map(({ type, slotIndex }) => ({
        type,
        slotIndex,
      })),
    );
    expect(isMatchPlacement(placement)).toBe(true);
  });

  it("rejects duplicate and excess castle towers", () => {
    expect(
      validatePlayerPlacement({
        catapultSlotIndex: 1,
        protections: [
          { slotIndex: 0, type: "castle" },
          { slotIndex: 0, type: "castle" },
        ],
      }).reason,
    ).toBe("duplicate-slot");
    expect(
      validatePlayerPlacement({
        catapultSlotIndex: 1,
        protections: [
          { slotIndex: 0, type: "castle" },
          { slotIndex: 1, type: "castle" },
          { slotIndex: 2, type: "castle" },
        ],
      }).reason,
    ).toBe("too-many-protections");
  });

  it("creates battle colliders from the chosen slots", () => {
    const placement = createDefaultMatchPlacement();
    placement.left.catapultSlotIndex = 0;
    placement.left = createCastlePlayerPlacement("left", 0);
    const state = createInitialBattleState(
      "highlands",
      GAME_CONFIG.weather.defaultMatchSeed,
      placement,
    );

    expect(state.players.left.catapultX).toBe(480);
    expect(state.protections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "left-slot-0-castle",
          type: "castle",
        }),
      ]),
    );
  });

  it("centers the castle tower under the catapult", () => {
    const placement = createDefaultMatchPlacement();
    placement.left = createCastlePlayerPlacement("left", 0);
    const state = createInitialBattleState(
      "highlands",
      GAME_CONFIG.weather.defaultMatchSeed,
      placement,
    );
    const protection = state.protections.find(
      ({ ownerId }) => ownerId === "left",
    );

    expect(protection?.x).toBe(
      state.players.left.catapultX -
        GAME_CONFIG.protections.castle.width / 2,
    );
  });

  it("clones both players without sharing protection arrays", () => {
    const placement = createDefaultMatchPlacement();
    const cloned = cloneMatchPlacement(placement);
    cloned.left.protections[0]!.slotIndex = 1;

    expect(placement.left.protections[0]?.slotIndex).toBe(0);
    expect(cloned.left.protections).not.toBe(placement.left.protections);
  });
});
