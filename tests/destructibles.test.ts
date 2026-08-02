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
  it("creates the three protection materials for both players", () => {
    const state = createInitialBattleState();

    expect(
      state.protections.map((protection) => protection.type),
    ).toEqual(["wood", "net", "metal", "wood", "net", "metal"]);
    expect(
      state.protections.reduce(
        (sum, protection) => sum + protection.maxDurability,
        0,
      ),
    ).toBe(210);
  });

  it("makes fire damage wood more than metal", () => {
    const state = createInitialBattleState();
    const woodHit = resolveProjectileShot(
      state,
      objectShot("fire", "protection", "right-slot-2-wood"),
    );
    const metalHit = resolveProjectileShot(
      state,
      objectShot("fire", "protection", "right-slot-4-metal"),
    );

    expect(
      woodHit.state.protections.find(
        ({ id }) => id === "right-slot-2-wood",
      )
        ?.durability,
    ).toBe(7);
    expect(
      metalHit.state.protections.find(
        ({ id }) => id === "right-slot-4-metal",
      )
        ?.durability,
    ).toBe(50);
  });

  it("applies the net first-intercept penalty and destroys it", () => {
    const transition = resolveProjectileShot(
      createInitialBattleState(),
      objectShot("stone", "protection", "right-slot-3-net"),
    );
    const net = transition.state.protections.find(
      ({ id }) => id === "right-slot-3-net",
    );

    expect(net?.durability).toBe(0);
    expect(net?.interceptCount).toBe(1);
    expect(transition.events).toContainEqual(
      expect.objectContaining({
        kind: "durability",
        targetId: "right-slot-3-net",
        remaining: 0,
        destroyed: true,
      }),
    );
  });

  it("removes destroyed protection from future collision checks", () => {
    const transition = resolveProjectileShot(
      createInitialBattleState(),
      objectShot("stone", "protection", "right-slot-3-net"),
    );
    const environment = createShotEnvironment(
      transition.state.arenaId,
      "stone",
      transition.state,
    );

    expect(
      environment.obstacles.some(
        ({ id }) => id === "right-slot-3-net",
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
      objectShot("diamond", "protection", "right-slot-4-metal"),
    );

    expect(
      state.protections.find(
        ({ id }) => id === "right-slot-4-metal",
      )
        ?.durability,
    ).toBe(55);
    expect(
      transition.state.protections.find(
        ({ id }) => id === "right-slot-4-metal",
      )?.durability,
    ).toBe(20);
  });
});
