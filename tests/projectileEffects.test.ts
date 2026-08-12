import { describe, expect, it } from "vitest";

import { BattleController } from "../src/game/core/BattleController";
import { createInitialBattleState } from "../src/game/core/createInitialBattleState";
import { GAME_CONFIG } from "../src/game/core/gameConfig";
import {
  getPlayerMaximumPower,
  resolveEndOfTurnEffects,
  resolveProjectileShot,
} from "../src/game/core/projectileEffects";
import type { ProjectileType } from "../src/game/core/projectileCatalog";
import type { ShotResult } from "../src/game/core/shotTypes";
import { createDefaultMatchPlacement } from "../src/game/core/placement";

function directShot(
  projectileType: ProjectileType,
  damage: number,
): ShotResult {
  return {
    projectileType,
    points: [{ timeMs: 0, x: 0, y: 0 }],
    impact: {
      targetId: "right",
      x: 0,
      y: 0,
      impactSpeed: 700,
      damage,
    },
    endReason: "impact",
  };
}

describe("projectile effects", () => {
  it("keeps stone as a direct-damage baseline", () => {
    const transition = resolveProjectileShot(
      createInitialBattleState(),
      directShot("stone", 25),
    );

    expect(transition.state.players.right.health).toBe(75);
    expect(transition.state.players.right.effects).toEqual({
      burningTurnsRemaining: 0,
      frozenTurnsRemaining: 0,
    });
  });

  it("moves a hit catapult and emits a material reaction", () => {
    const placement = createDefaultMatchPlacement();
    placement.left.protections = [];
    placement.right.protections = [];
    const initialState = createInitialBattleState(
      undefined,
      undefined,
      placement,
    );
    Object.values(initialState.obstacles).forEach((obstacle) => {
      obstacle.durability = 0;
    });
    const startX = initialState.players.right.catapultX;
    const shot = directShot("stone", 25);
    if (!shot.impact) {
      throw new Error("Expected direct impact.");
    }
    shot.impact = {
      ...shot.impact,
      velocityX: 1800,
      velocityY: 400,
      normalImpactRatio: 0.95,
      hitZone: "wheels",
      impactSpeed: 1900,
    };
    const transition = resolveProjectileShot(initialState, shot);

    expect(transition.state.players.right.catapultX).toBeGreaterThan(
      startX,
    );
    expect(transition.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "material-reaction",
          reaction: "splinter",
          projectileType: "stone",
          targetKind: "catapult",
          targetId: "right",
        }),
        expect.objectContaining({
          kind: "displacement",
          targetId: "right",
        }),
      ]),
    );
    expect(initialState.players.right.catapultX).toBe(startX);
  });

  it("burns for two target turn endings and refreshes instead of stacking", () => {
    const initialState = createInitialBattleState();
    initialState.players.right.effects.burningTurnsRemaining = 1;
    const hit = resolveProjectileShot(
      initialState,
      directShot("fire", 15),
    );

    expect(hit.state.players.right.health).toBe(85);
    expect(hit.state.players.right.effects.burningTurnsRemaining).toBe(2);

    const firstTick = resolveEndOfTurnEffects(hit.state, "right");
    expect(firstTick.state.players.right.health).toBe(80);
    expect(
      firstTick.state.players.right.effects.burningTurnsRemaining,
    ).toBe(1);

    const secondTick = resolveEndOfTurnEffects(
      firstTick.state,
      "right",
    );
    expect(secondTick.state.players.right.health).toBe(75);
    expect(
      secondTick.state.players.right.effects.burningTurnsRemaining,
    ).toBe(0);
  });

  it("uses ice to clear burning and limit the next turn power", () => {
    const initialState = createInitialBattleState();
    initialState.players.right.effects.burningTurnsRemaining = 2;
    const hit = resolveProjectileShot(
      initialState,
      directShot("ice", 12),
    );
    const frozenPlayer = hit.state.players.right;

    expect(frozenPlayer.health).toBe(88);
    expect(frozenPlayer.effects.burningTurnsRemaining).toBe(0);
    expect(frozenPlayer.effects.frozenTurnsRemaining).toBe(1);
    expect(getPlayerMaximumPower(frozenPlayer)).toBe(70);

    const thawed = resolveEndOfTurnEffects(hit.state, "right");
    expect(thawed.state.players.right.effects.frozenTurnsRemaining).toBe(0);
    expect(getPlayerMaximumPower(thawed.state.players.right)).toBe(100);
  });

  it("rejects power above the frozen cap", () => {
    const initialState = createInitialBattleState();
    initialState.players.left.effects.frozenTurnsRemaining = 1;
    const controller = new BattleController(initialState);
    const command = {
      playerId: "left" as const,
      angleDeg: 20,
      power: 71,
      projectileType: "stone" as const,
    };

    expect(controller.fire(command)).toEqual({
      ok: false,
      reason: "power-restricted",
    });
    expect(controller.fire({ ...command, power: 70 }).ok).toBe(true);
  });

  it("applies bomb splash damage with linear falloff to either player", () => {
    const initialState = createInitialBattleState();
    const left = initialState.players.left;
    const explosionPoint = {
      timeMs: 300,
      x: left.catapultX,
      y: left.catapultY - GAME_CONFIG.catapult.colliderHeight / 2,
    };
    const shot: ShotResult = {
      projectileType: "bomb",
      points: [explosionPoint],
      impact: null,
      endReason: "ground",
    };
    const transition = resolveProjectileShot(initialState, shot);

    expect(transition.state.players.left.health).toBe(70);
    expect(transition.state.players.right.health).toBe(100);
    expect(transition.events).toContainEqual(
      expect.objectContaining({
        kind: "damage",
        targetId: "left",
        amount: 30,
        source: "explosion",
      }),
    );
  });

  it("anchors a bomb explosion to the confirmed impact point", () => {
    const initialState = createInitialBattleState();
    const target = initialState.players.right;
    const impactX = target.catapultX;
    const impactY =
      target.catapultY - GAME_CONFIG.catapult.colliderHeight / 2;
    const shot: ShotResult = {
      projectileType: "bomb",
      points: [{ timeMs: 300, x: 0, y: 0 }],
      impact: {
        targetId: "right",
        x: impactX,
        y: impactY,
        impactSpeed: 700,
        damage: 5,
      },
      endReason: "impact",
    };
    const transition = resolveProjectileShot(initialState, shot);

    expect(transition.state.players.right.health).toBe(65);
    expect(transition.events).toContainEqual(
      expect.objectContaining({
        kind: "damage",
        targetId: "right",
        amount: 30,
        source: "explosion",
        x: impactX,
        y: impactY,
      }),
    );
  });

  it("does not explode a bomb that leaves the world", () => {
    const transition = resolveProjectileShot(createInitialBattleState(), {
      projectileType: "bomb",
      points: [{ timeMs: 300, x: -100, y: -100 }],
      impact: null,
      endReason: "out-of-bounds",
    });

    expect(transition.events).toEqual([]);
    expect(transition.state.players.left.health).toBe(100);
    expect(transition.state.players.right.health).toBe(100);
  });

  it("keeps diamond penetration metadata ready for protection", () => {
    const transition = resolveProjectileShot(
      createInitialBattleState(),
      directShot("diamond", 35),
    );

    expect(transition.state.players.right.health).toBe(65);
    expect(
      GAME_CONFIG.projectileEffects.diamond
        .protectionResistanceIgnored,
    ).toBe(0.5);
  });
});
