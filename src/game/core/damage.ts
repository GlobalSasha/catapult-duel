import type { BattleState } from "./battleTypes";
import { GAME_CONFIG } from "./gameConfig";
import type { ShotResult } from "./shotTypes";

interface DirectDamageInput {
  baseDamage: number;
  impactSpeed: number;
  materialCoefficient: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function calculateDirectDamage({
  baseDamage,
  impactSpeed,
  materialCoefficient,
}: DirectDamageInput): number {
  const impactFactor = clamp(
    impactSpeed / GAME_CONFIG.damage.referenceImpactSpeed,
    GAME_CONFIG.damage.minImpactFactor,
    GAME_CONFIG.damage.maxImpactFactor,
  );

  return Math.round(baseDamage * impactFactor * materialCoefficient);
}

export function applyShotDamage(
  state: BattleState,
  shot: ShotResult,
): BattleState {
  if (!shot.impact) {
    return state;
  }

  const targetId = shot.impact.targetId;
  const target = state.players[targetId];
  const nextHealth = clamp(
    target.health - shot.impact.damage,
    0,
    GAME_CONFIG.catapult.maxHealth,
  );

  return {
    ...state,
    players: {
      ...state.players,
      [targetId]: {
        ...target,
        health: nextHealth,
      },
    },
  };
}
