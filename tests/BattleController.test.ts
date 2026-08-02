import { describe, expect, it } from "vitest";

import {
  BattleController,
  type FireErrorReason,
} from "../src/game/core/BattleController";
import { createInitialBattleState } from "../src/game/core/createInitialBattleState";
import { GAME_CONFIG } from "../src/game/core/gameConfig";
import type { FireCommand, ShotResult } from "../src/game/core/shotTypes";

function createCommand(
  playerId: "left" | "right" = "left",
): FireCommand {
  return {
    playerId,
    angleDeg: GAME_CONFIG.aiming.initialAngleDeg,
    power: GAME_CONFIG.aiming.initialPower,
    projectileType: "stone",
  };
}

function expectFireError(
  result: ReturnType<BattleController["fire"]>,
  reason: FireErrorReason,
): void {
  expect(result).toEqual({
    ok: false,
    reason,
  });
}

function getShot(
  result: ReturnType<BattleController["fire"]>,
): ShotResult {
  if (!result.ok) {
    throw new Error(`Expected a shot, received "${result.reason}".`);
  }

  return result.shot;
}

const MISS_SHOT: ShotResult = {
  projectileType: "stone",
  points: [],
  impact: null,
  endReason: "ground",
};

describe("BattleController", () => {
  it("selects a projectile and spends only finite ammunition", () => {
    const controller = new BattleController();

    expect(controller.selectProjectile("left", "fire")).toEqual({
      ok: true,
    });
    const fireResult = controller.fire({
      ...createCommand(),
      projectileType: "fire",
    });

    expect(fireResult.ok).toBe(true);
    expect(controller.getState().players.left.ammunition.fire).toBe(1);

    const stoneController = new BattleController();

    expect(stoneController.fire(createCommand()).ok).toBe(true);
    expect(
      stoneController.getState().players.left.ammunition.stone,
    ).toBeNull();
  });

  it("rejects an unavailable or unselected projectile", () => {
    const emptyState = createInitialBattleState();
    emptyState.players.left.ammunition.fire = 0;
    const controller = new BattleController(emptyState);

    expect(controller.selectProjectile("left", "fire")).toEqual({
      ok: false,
      reason: "out-of-ammo",
    });
    expectFireError(
      controller.fire({
        ...createCommand(),
        projectileType: "ice",
      }),
      "projectile-not-selected",
    );
  });

  it("owns an independent copy of the initial state", () => {
    const initialState = createInitialBattleState();
    const controller = new BattleController(initialState);
    const exposedState = controller.getState();

    initialState.players.left.health = 1;
    initialState.players.left.ammunition.fire = 0;
    exposedState.players.right.health = 2;
    exposedState.players.right.ammunition.ice = 0;

    expect(controller.getState().players.left.health).toBe(
      GAME_CONFIG.catapult.maxHealth,
    );
    expect(controller.getState().players.right.health).toBe(
      GAME_CONFIG.catapult.maxHealth,
    );
    expect(controller.getState().players.left.ammunition.fire).toBe(2);
    expect(controller.getState().players.right.ammunition.ice).toBe(2);
  });

  it("moves through flight and resolving before starting the next turn", () => {
    const controller = new BattleController();
    const shot = getShot(controller.fire(createCommand()));

    expect(controller.getState().phase).toBe("projectile-flight");

    const resolvingState = controller.resolveShot(shot).state;

    expect(resolvingState.phase).toBe("resolving");
    expect(resolvingState.players.right.health).toBe(
      GAME_CONFIG.catapult.maxHealth - (shot.impact?.damage ?? 0),
    );
    expect(resolvingState.activePlayerId).toBe("left");
    expect(resolvingState.turnNumber).toBe(1);

    const nextTurnState = controller.startNextTurn().state;

    expect(nextTurnState.phase).toBe("aiming");
    expect(nextTurnState.activePlayerId).toBe("right");
    expect(nextTurnState.turnNumber).toBe(2);
  });

  it("rejects a repeated fire command while the projectile is in flight", () => {
    const controller = new BattleController();

    expect(controller.fire(createCommand()).ok).toBe(true);
    const stateBeforeRepeatedFire = controller.getState();
    const repeatedFire = controller.fire(createCommand());

    expectFireError(repeatedFire, "wrong-phase");
    expect(controller.getState()).toEqual(stateBeforeRepeatedFire);
  });

  it("rejects a command from the inactive player", () => {
    const controller = new BattleController();

    expectFireError(
      controller.fire(createCommand("right")),
      "not-active-player",
    );
    expect(controller.getState().phase).toBe("aiming");
  });

  it("returns typed validation errors without changing the match", () => {
    const controller = new BattleController();
    const initialState = controller.getState();

    expectFireError(
      controller.fire({
        ...createCommand(),
        angleDeg: GAME_CONFIG.aiming.minAngleDeg - 1,
      }),
      "invalid-angle",
    );
    expectFireError(
      controller.fire({
        ...createCommand(),
        power: GAME_CONFIG.aiming.maxPower + 1,
      }),
      "invalid-power",
    );

    expect(controller.getState()).toEqual(initialState);
  });

  it("reports a finished match before other fire validation", () => {
    const finishedState = createInitialBattleState();
    finishedState.phase = "finished";
    finishedState.winnerId = "left";
    const controller = new BattleController(finishedState);

    expectFireError(
      controller.fire({
        ...createCommand("right"),
        angleDeg: Number.NaN,
      }),
      "match-finished",
    );
  });

  it("alternates players through ten sequential shots", () => {
    const controller = new BattleController();

    for (let shotNumber = 1; shotNumber <= 10; shotNumber += 1) {
      const beforeShot = controller.getState();
      expect(
        controller.fire(createCommand(beforeShot.activePlayerId)).ok,
      ).toBe(true);

      expect(controller.getState().phase).toBe("projectile-flight");
      expect(controller.resolveShot(MISS_SHOT).state.phase).toBe(
        "resolving",
      );

      const nextTurn = controller.startNextTurn().state;

      expect(nextTurn.turnNumber).toBe(shotNumber + 1);
      expect(nextTurn.phase).toBe("aiming");
      expect(nextTurn.activePlayerId).toBe(
        shotNumber % 2 === 0 ? "left" : "right",
      );
    }

    expect(controller.getState()).toMatchObject({
      phase: "aiming",
      activePlayerId: "left",
      turnNumber: 11,
    });
  });

  it("finishes the match at zero health and blocks further shots", () => {
    const controller = new BattleController();
    const shot = getShot(controller.fire(createCommand()));
    const winningShot: ShotResult = {
      ...shot,
      impact: shot.impact
        ? {
            ...shot.impact,
            damage: GAME_CONFIG.catapult.maxHealth,
          }
        : {
            targetId: "right",
            x: 0,
            y: 0,
            impactSpeed: 0,
            damage: GAME_CONFIG.catapult.maxHealth,
          },
    };

    const finishedState = controller.resolveShot(winningShot).state;

    expect(finishedState).toMatchObject({
      phase: "finished",
      winnerId: "left",
      turnNumber: 1,
    });
    expect(finishedState.players.right.health).toBe(0);
    expectFireError(controller.fire(createCommand()), "match-finished");
    expect(() => controller.startNextTurn()).toThrow(
      /Cannot start the next turn/,
    );

    const newMatch = new BattleController().getState();

    expect(newMatch.phase).toBe("aiming");
    expect(newMatch.winnerId).toBeNull();
    expect(newMatch.players.left.health).toBe(
      GAME_CONFIG.catapult.maxHealth,
    );
    expect(newMatch.players.right.health).toBe(
      GAME_CONFIG.catapult.maxHealth,
    );
  });

  it("throws only when an internal transition invariant is violated", () => {
    const controller = new BattleController();
    const impossibleShot: ShotResult = {
      projectileType: "stone",
      points: [],
      impact: null,
      endReason: "timeout",
    };

    expect(() => controller.resolveShot(impossibleShot)).toThrow(
      /Cannot resolve a shot/,
    );
    expect(() => controller.startNextTurn()).toThrow(
      /Cannot start the next turn/,
    );
  });
});
