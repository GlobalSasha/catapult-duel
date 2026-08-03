import { describe, expect, it } from "vitest";

import { ARENAS } from "../src/game/arena/arenaCatalog";
import { BattleController } from "../src/game/core/BattleController";
import type { PlayerId } from "../src/game/core/battleTypes";
import { createInitialBattleState } from "../src/game/core/createInitialBattleState";
import { GAME_CONFIG } from "../src/game/core/gameConfig";
import type { ShotResult } from "../src/game/core/shotTypes";

interface MatchSummary {
  arenaId: (typeof ARENAS)[number]["id"];
  turnCount: number;
  winnerId: PlayerId;
}

function opponentOf(playerId: PlayerId): PlayerId {
  return playerId === "left" ? "right" : "left";
}

function playAutonomousMatch(
  matchIndex: number,
  expectedWinnerId: PlayerId,
): MatchSummary {
  const arena = ARENAS[matchIndex % ARENAS.length] ?? ARENAS[0];
  const controller = new BattleController(
    createInitialBattleState(
      arena.id,
      GAME_CONFIG.weather.defaultMatchSeed + matchIndex * 97,
    ),
  );
  const missedOpeningShot = new Set<PlayerId>();
  let turnCount = 0;

  while (controller.getState().phase !== "finished" && turnCount < 16) {
    const beforeShot = controller.getState();
    const activePlayerId = beforeShot.activePlayerId;
    const targetId = opponentOf(activePlayerId);
    const fireResult = controller.fire({
      playerId: activePlayerId,
      angleDeg: 45,
      power: 80,
      projectileType: "stone",
    });

    expect(fireResult.ok).toBe(true);
    if (!fireResult.ok) {
      throw new Error(`Autonomous fire failed: ${fireResult.reason}`);
    }

    const shouldMiss =
      activePlayerId !== expectedWinnerId &&
      !missedOpeningShot.has(activePlayerId);
    if (shouldMiss) {
      missedOpeningShot.add(activePlayerId);
    }

    const target = beforeShot.players[targetId];
    const resolvedShot: ShotResult = {
      ...fireResult.shot,
      objectImpact: null,
      endReason: shouldMiss ? "ground" : "impact",
      impact: shouldMiss
        ? null
        : {
            targetId,
            x: target.catapultX,
            y: target.catapultY - GAME_CONFIG.catapult.colliderHeight / 2,
            impactSpeed: GAME_CONFIG.damage.referenceImpactSpeed,
            damage: GAME_CONFIG.projectiles.stone.baseDamage,
          },
    };
    const resolved = controller.resolveShot(resolvedShot).state;
    turnCount += 1;

    if (resolved.phase !== "finished") {
      expect(controller.startNextTurn().state.phase).toBe("aiming");
    }
  }

  const finalState = controller.getState();
  expect(finalState.phase).toBe("finished");
  expect(finalState.winnerId).toBe(expectedWinnerId);
  expect(turnCount).toBeLessThanOrEqual(8);

  if (!finalState.winnerId) {
    throw new Error("Autonomous match finished without a winner.");
  }

  return {
    arenaId: arena.id,
    turnCount,
    winnerId: finalState.winnerId,
  };
}

describe("twelve complete autonomous balance matches", () => {
  it("finishes one match on every arena without stuck phases", () => {
    const summaries = Array.from({ length: ARENAS.length }, (_, matchIndex) =>
      playAutonomousMatch(
        matchIndex,
        matchIndex % 2 === 0 ? "left" : "right",
      ),
    );

    expect(summaries).toHaveLength(ARENAS.length);
    expect(summaries.filter(({ winnerId }) => winnerId === "left")).toHaveLength(6);
    expect(summaries.filter(({ winnerId }) => winnerId === "right")).toHaveLength(6);
    expect(new Set(summaries.map(({ arenaId }) => arenaId))).toEqual(
      new Set(ARENAS.map(({ id }) => id)),
    );
  });
});
