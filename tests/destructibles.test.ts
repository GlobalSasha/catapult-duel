import { describe, expect, it } from "vitest";

import { createInitialBattleState } from "../src/game/core/createInitialBattleState";
import { resolveProjectileShot } from "../src/game/core/projectileEffects";
import type { ProjectileType } from "../src/game/core/projectileCatalog";
import { createShotEnvironment } from "../src/game/core/simulateShot";
import type {
  DestructibleTargetKind,
  ShotResult,
} from "../src/game/core/shotTypes";

function objectShot(
  projectileType: ProjectileType,
  targetKind: DestructibleTargetKind,
  targetId: string,
): ShotResult {
  return {
    projectileType,
    points: [{ timeMs: 500, x: 3600, y: 600 }],
    impact: null,
    objectImpact: {
      targetKind,
      targetId,
      x: 3600,
      y: 600,
      impactSpeed: 700,
    },
    endReason: "obstacle",
  };
}

describe("destructible protection and arena obstacles", () => {
  it("creates one castle tower for both players", () => {
    const state = createInitialBattleState();

    expect(
      state.protections.map((protection) => protection.type),
    ).toEqual(["castle", "castle"]);
    expect(
      state.protections.reduce(
        (sum, protection) => sum + protection.maxDurability,
        0,
      ),
    ).toBe(200);
  });

  it("makes stone damage castle walls more than fire", () => {
    const state = createInitialBattleState();
    const stoneHit = resolveProjectileShot(
      state,
      objectShot("stone", "protection", "right-slot-0-castle"),
    );
    const fireHit = resolveProjectileShot(
      state,
      objectShot("fire", "protection", "right-slot-0-castle"),
    );

    expect(
      stoneHit.state.protections.find(
        ({ id }) => id === "right-slot-0-castle",
      )
        ?.durability,
    ).toBe(75);
    expect(
      fireHit.state.protections.find(
        ({ id }) => id === "right-slot-0-castle",
      )
        ?.durability,
    ).toBe(90);
  });

  it("destroys a castle tower after four direct stone hits and drops the catapult", () => {
    let state = createInitialBattleState();
    const towerTopY = state.players.right.catapultY;
    const shot = objectShot(
      "stone",
      "protection",
      "right-slot-0-castle",
    );
    let transition = resolveProjectileShot(state, shot);
    state = transition.state;
    transition = resolveProjectileShot(state, shot);
    state = transition.state;
    transition = resolveProjectileShot(state, shot);
    state = transition.state;
    transition = resolveProjectileShot(state, shot);
    const wall = transition.state.protections.find(
      ({ id }) => id === "right-slot-0-castle",
    );

    expect(wall?.durability).toBe(0);
    expect(wall?.interceptCount).toBe(4);
    expect(transition.state.players.right.catapultY).toBeGreaterThan(
      towerTopY,
    );
    expect(transition.events).toContainEqual(
      expect.objectContaining({
        kind: "durability",
        targetId: "right-slot-0-castle",
        remaining: 0,
        destroyed: true,
      }),
    );
  });

  it("removes destroyed protection from future collision checks", () => {
    let state = createInitialBattleState();
    const shot = objectShot(
      "stone",
      "protection",
      "right-slot-0-castle",
    );
    for (let hit = 0; hit < 4; hit += 1) {
      state = resolveProjectileShot(state, shot).state;
    }
    const environment = createShotEnvironment(
      state.arenaId,
      "stone",
      state,
    );

    expect(
      environment.obstacles.some(
        ({ id }) => id === "right-slot-0-castle",
      ),
    ).toBe(false);
  });

  it("damages a rock over several hits before removing its collider", () => {
    let state = createInitialBattleState();
    const shot = objectShot(
      "stone",
      "obstacle",
      "highlands-center-ridge",
    );

    for (let hit = 0; hit < 4; hit += 1) {
      state = resolveProjectileShot(state, shot).state;
    }

    expect(
      state.obstacles["highlands-center-ridge"]?.durability,
    ).toBe(20);

    const finalHit = resolveProjectileShot(state, shot);
    expect(
      finalHit.state.obstacles["highlands-center-ridge"]?.durability,
    ).toBe(0);
    expect(
      createShotEnvironment(
        finalHit.state.arenaId,
        "stone",
        finalHit.state,
      ).obstacles.some(
        ({ id }) => id === "highlands-center-ridge",
      ),
    ).toBe(false);
  });

  it("does not mutate the previous durability state", () => {
    const state = createInitialBattleState();
    const transition = resolveProjectileShot(
      state,
      objectShot("diamond", "protection", "right-slot-0-castle"),
    );

    expect(
      state.protections.find(
        ({ id }) => id === "right-slot-0-castle",
      )
        ?.durability,
    ).toBe(100);
    expect(
      transition.state.protections.find(
        ({ id }) => id === "right-slot-0-castle",
      )?.durability,
    ).toBe(56);
  });
});
