import { describe, expect, it } from "vitest";

import { createInitialBattleState } from "../src/game/core/createInitialBattleState";
import {
  applyShotDamage,
  calculateDirectDamage,
} from "../src/game/core/damage";
import { GAME_CONFIG } from "../src/game/core/gameConfig";
import { simulateShot } from "../src/game/core/simulateShot";
import type { FireCommand } from "../src/game/core/shotTypes";

function command(angleDeg: number, power: number): FireCommand {
  return {
    playerId: "left",
    angleDeg,
    power,
    projectileType: "stone",
  };
}

function createUnprotectedState() {
  const state = createInitialBattleState();
  state.protections = [];
  return state;
}

describe("collision and damage", () => {
  it("damages the target once on a direct hit", () => {
    const state = createUnprotectedState();
    const shot = simulateShot(command(22, 100), state);
    const nextState = applyShotDamage(state, shot);

    expect(shot.endReason).toBe("impact");
    expect(shot.impact?.targetId).toBe("right");
    expect(shot.impact?.damage).toBeGreaterThan(0);
    expect(nextState.players.right.health).toBe(
      GAME_CONFIG.catapult.maxHealth - (shot.impact?.damage ?? 0),
    );
    expect(state.players.right.health).toBe(
      GAME_CONFIG.catapult.maxHealth,
    );
  });

  it("stops on the ground without changing health", () => {
    const state = createUnprotectedState();
    const shot = simulateShot(command(10, 20), state);

    expect(shot.endReason).toBe("ground");
    expect(shot.impact).toBeNull();
    expect(applyShotDamage(state, shot)).toBe(state);
  });

  it("does not change health on an out-of-bounds miss", () => {
    const state = createUnprotectedState();
    const shot = simulateShot(command(80, 100), state);

    expect(shot.endReason).toBe("out-of-bounds");
    expect(shot.impact).toBeNull();
    expect(applyShotDamage(state, shot)).toBe(state);
  });

  it("clamps direct damage and target health", () => {
    expect(
      calculateDirectDamage({
        baseDamage: GAME_CONFIG.projectiles.stone.baseDamage,
        impactSpeed: 0,
        materialCoefficient:
          GAME_CONFIG.damage.defaultMaterialCoefficient,
      }),
    ).toBe(
      Math.round(
        GAME_CONFIG.projectiles.stone.baseDamage *
          GAME_CONFIG.damage.minImpactFactor,
      ),
    );
    expect(
      calculateDirectDamage({
        baseDamage: GAME_CONFIG.projectiles.stone.baseDamage,
        impactSpeed: 10_000,
        materialCoefficient:
          GAME_CONFIG.damage.defaultMaterialCoefficient,
      }),
    ).toBe(
      Math.round(
        GAME_CONFIG.projectiles.stone.baseDamage *
          GAME_CONFIG.damage.maxImpactFactor,
      ),
    );

    const state = createInitialBattleState();
    const lethalShot = {
      projectileType: "stone" as const,
      points: [],
      impact: {
        targetId: "right" as const,
        x: 0,
        y: 0,
        impactSpeed: 10_000,
        damage: 10_000,
      },
      endReason: "impact" as const,
    };

    expect(applyShotDamage(state, lethalShot).players.right.health).toBe(0);
  });
});
