import { describe, expect, it } from "vitest";
import { createInitialBattleState } from "../src/game/core/createInitialBattleState";
import { simulateShot } from "../src/game/core/simulateShot";

describe("release launch point regression", () => {
  it("keeps the screenshot shot outside the own castle collider", () => {
    const state = createInitialBattleState("highlands");
    state.weather.id = "sandstorm";
    state.weather.wind = 65;

    // This is the point produced after the visual body recoil. It overlaps
    // the left castle protection and reproduces the reported self-hit.
    const recoilResult = simulateShot({
      playerId: "left",
      angleDeg: 21,
      power: 60,
      projectileType: "stone",
      launchPoint: { x: 566, y: 449 },
    }, state);
    expect(recoilResult).toMatchObject({
      endReason: "obstacle",
      objectImpact: { targetId: "left-slot-0-castle" },
    });

    // The release cup point is evaluated before recoil moves the body.
    const releaseResult = simulateShot({
      playerId: "left",
      angleDeg: 21,
      power: 60,
      projectileType: "stone",
      launchPoint: { x: 574, y: 443 },
    }, state);
    expect(releaseResult.objectImpact).toBeNull();
  });
});
