import type { BattleState, PlayerId, PlayerState } from "./battleTypes";
import { getArenaDefinition } from "../arena/arenaCatalog";
import { calculateDirectDamage } from "./damage";
import { GAME_CONFIG } from "./gameConfig";
import type {
  BattleEvent,
  BattleTransition,
  DamageSource,
  ShotResult,
} from "./shotTypes";
import { getWeatherDefinition } from "./weather";
import { getProtectionDefinition } from "./protection";
import { cloneMatchPlacement } from "./placement";

function clampHealth(health: number): number {
  return Math.min(
    GAME_CONFIG.catapult.maxHealth,
    Math.max(0, health),
  );
}

function cloneBattleState(state: BattleState): BattleState {
  return {
    ...state,
    placement: cloneMatchPlacement(state.placement),
    weather: { ...state.weather },
    protections: state.protections.map((protection) => ({
      ...protection,
    })),
    obstacles: Object.fromEntries(
      Object.entries(state.obstacles).map(([id, obstacle]) => [
        id,
        { ...obstacle },
      ]),
    ),
    players: {
      left: {
        ...state.players.left,
        ammunition: { ...state.players.left.ammunition },
        effects: { ...state.players.left.effects },
      },
      right: {
        ...state.players.right,
        ammunition: { ...state.players.right.ammunition },
        effects: { ...state.players.right.effects },
      },
    },
  };
}

function applyDurabilityDamage(
  state: BattleState,
  events: BattleEvent[],
  targetKind: "protection" | "obstacle",
  targetId: string,
  amount: number,
  x: number,
  y: number,
): void {
  const roundedAmount = Math.max(0, Math.round(amount));

  if (roundedAmount === 0) {
    return;
  }

  if (targetKind === "protection") {
    const target = state.protections.find(
      (protection) => protection.id === targetId,
    );

    if (!target || target.durability === 0) {
      return;
    }

    const actualDamage = Math.min(target.durability, roundedAmount);
    target.durability -= actualDamage;
    target.interceptCount += 1;
    events.push({
      kind: "durability",
      targetKind,
      targetId,
      amount: actualDamage,
      remaining: target.durability,
      destroyed: target.durability === 0,
      x,
      y,
    });
    return;
  }

  const target = state.obstacles[targetId];

  if (!target || target.durability === 0) {
    return;
  }

  const actualDamage = Math.min(target.durability, roundedAmount);
  target.durability -= actualDamage;
  events.push({
    kind: "durability",
    targetKind,
    targetId,
    amount: actualDamage,
    remaining: target.durability,
    destroyed: target.durability === 0,
    x,
    y,
  });
}

function getObjectDamageCoefficient(
  state: BattleState,
  targetKind: "protection" | "obstacle",
  targetId: string,
  projectileType: ShotResult["projectileType"],
): number {
  if (targetKind === "protection") {
    const protection = state.protections.find(
      (candidate) => candidate.id === targetId,
    );

    if (!protection) {
      return 1;
    }

    const coefficient =
      getProtectionDefinition(protection.type).damageCoefficients[
        projectileType
      ];

    if (projectileType !== "diamond" || coefficient >= 1) {
      return coefficient;
    }

    return (
      coefficient +
      (1 - coefficient) *
        GAME_CONFIG.projectileEffects.diamond
          .protectionResistanceIgnored
    );
  }

  const obstacle = getArenaDefinition(state.arenaId).obstacles.find(
    (candidate) => candidate.id === targetId,
  );

  return obstacle
    ? GAME_CONFIG.arenaObstacles[obstacle.kind].damageCoefficients[
        projectileType
      ]
    : 1;
}

function applyDirectObjectHit(
  state: BattleState,
  shot: ShotResult,
  events: BattleEvent[],
): void {
  if (!shot.objectImpact) {
    return;
  }

  const coefficient = getObjectDamageCoefficient(
    state,
    shot.objectImpact.targetKind,
    shot.objectImpact.targetId,
    shot.projectileType,
  );
  let damage = calculateDirectDamage({
    baseDamage: GAME_CONFIG.projectiles[shot.projectileType].baseDamage,
    impactSpeed: shot.objectImpact.impactSpeed,
    materialCoefficient: coefficient,
  });

  if (shot.objectImpact.targetKind === "protection") {
    const protection = state.protections.find(
      (candidate) => candidate.id === shot.objectImpact?.targetId,
    );

    if (protection && protection.interceptCount === 0) {
      damage +=
        getProtectionDefinition(protection.type).firstInterceptPenalty;
    }
  }

  applyDurabilityDamage(
    state,
    events,
    shot.objectImpact.targetKind,
    shot.objectImpact.targetId,
    damage,
    shot.objectImpact.x,
    shot.objectImpact.y,
  );
}

function applyDamage(
  state: BattleState,
  events: BattleEvent[],
  targetId: PlayerId,
  amount: number,
  source: DamageSource,
  x: number,
  y: number,
): void {
  const roundedAmount = Math.max(0, Math.round(amount));

  if (roundedAmount === 0) {
    return;
  }

  const target = state.players[targetId];
  target.health = clampHealth(target.health - roundedAmount);
  events.push({
    kind: "damage",
    targetId,
    amount: roundedAmount,
    source,
    x,
    y,
  });
}

function applyDirectHit(
  state: BattleState,
  shot: ShotResult,
  events: BattleEvent[],
): PlayerState | null {
  if (!shot.impact) {
    return null;
  }

  applyDamage(
    state,
    events,
    shot.impact.targetId,
    shot.impact.damage,
    "direct",
    shot.impact.x,
    shot.impact.y,
  );

  return state.players[shot.impact.targetId];
}

function applyBombExplosion(
  state: BattleState,
  shot: ShotResult,
  events: BattleEvent[],
): void {
  if (
    shot.projectileType !== "bomb" ||
    !["impact", "ground", "obstacle"].includes(shot.endReason)
  ) {
    return;
  }

  const explosionPoint = shot.points.at(-1);

  if (!explosionPoint) {
    return;
  }

  const { explosionRadius, maxExplosionDamage } =
    GAME_CONFIG.projectileEffects.bomb;

  (["left", "right"] as const).forEach((playerId) => {
    const player = state.players[playerId];
    const centerY =
      player.catapultY - GAME_CONFIG.catapult.colliderHeight / 2;
    const distance = Math.hypot(
      explosionPoint.x - player.catapultX,
      explosionPoint.y - centerY,
    );

    if (distance >= explosionRadius) {
      return;
    }

    const damage =
      maxExplosionDamage * (1 - distance / explosionRadius);
    applyDamage(
      state,
      events,
      playerId,
      damage,
      "explosion",
      explosionPoint.x,
      explosionPoint.y,
    );
  });

  nextDestructibleTargets(state).forEach((target) => {
    const distance = Math.hypot(
      explosionPoint.x - target.centerX,
      explosionPoint.y - target.centerY,
    );

    if (distance >= explosionRadius) {
      return;
    }

    const coefficient = getObjectDamageCoefficient(
      state,
      target.kind,
      target.id,
      "bomb",
    );
    const damage =
      maxExplosionDamage *
      (1 - distance / explosionRadius) *
      coefficient;
    applyDurabilityDamage(
      state,
      events,
      target.kind,
      target.id,
      damage,
      explosionPoint.x,
      explosionPoint.y,
    );
  });
}

function nextDestructibleTargets(state: BattleState) {
  const arena = getArenaDefinition(state.arenaId);
  const protections = state.protections
    .filter((protection) => protection.durability > 0)
    .map((protection) => ({
      id: protection.id,
      kind: "protection" as const,
      centerX: protection.x + protection.width / 2,
      centerY: protection.y + protection.height / 2,
    }));
  const obstacles = arena.obstacles
    .filter(
      (obstacle) =>
        (state.obstacles[obstacle.id]?.durability ?? 0) > 0,
    )
    .map((obstacle) => ({
      id: obstacle.id,
      kind: "obstacle" as const,
      centerX: obstacle.x + obstacle.width / 2,
      centerY: obstacle.y + obstacle.height / 2,
    }));

  return [...protections, ...obstacles];
}

function applyStatusEffect(
  target: PlayerState | null,
  shot: ShotResult,
  events: BattleEvent[],
  weatherId: BattleState["weather"]["id"],
): void {
  if (!target || target.health === 0) {
    return;
  }

  if (shot.projectileType === "fire") {
    const weather = getWeatherDefinition(weatherId);
    target.effects.burningTurnsRemaining =
      weather.burnDurationTurns;
    events.push({
      kind: "status",
      targetId: target.id,
      status: "burning",
      action: "applied",
      turnsRemaining: target.effects.burningTurnsRemaining,
    });
    return;
  }

  if (shot.projectileType !== "ice") {
    return;
  }

  if (target.effects.burningTurnsRemaining > 0) {
    target.effects.burningTurnsRemaining = 0;
    events.push({
      kind: "status",
      targetId: target.id,
      status: "burning",
      action: "cleared",
      turnsRemaining: 0,
    });
  }

  target.effects.frozenTurnsRemaining =
    getWeatherDefinition(weatherId).freezeDurationTurns;
  events.push({
    kind: "status",
    targetId: target.id,
    status: "frozen",
    action: "applied",
    turnsRemaining: target.effects.frozenTurnsRemaining,
  });
}

export function resolveProjectileShot(
  state: BattleState,
  shot: ShotResult,
): BattleTransition {
  const nextState = cloneBattleState(state);
  const events: BattleEvent[] = [];
  const directTarget = applyDirectHit(nextState, shot, events);

  applyDirectObjectHit(nextState, shot, events);
  applyStatusEffect(
    directTarget,
    shot,
    events,
    nextState.weather.id,
  );
  applyBombExplosion(nextState, shot, events);

  return { state: nextState, events };
}

export function resolveEndOfTurnEffects(
  state: BattleState,
  playerId: PlayerId,
): BattleTransition {
  const nextState = cloneBattleState(state);
  const events: BattleEvent[] = [];
  const player = nextState.players[playerId];

  if (player.effects.burningTurnsRemaining > 0) {
    applyDamage(
      nextState,
      events,
      playerId,
      getWeatherDefinition(nextState.weather.id).burnDamagePerTurn,
      "burning",
      player.catapultX,
      player.catapultY - GAME_CONFIG.catapult.colliderHeight / 2,
    );
    player.effects.burningTurnsRemaining -= 1;

    if (player.effects.burningTurnsRemaining === 0) {
      events.push({
        kind: "status",
        targetId: playerId,
        status: "burning",
        action: "cleared",
        turnsRemaining: 0,
      });
    }
  }

  if (player.effects.frozenTurnsRemaining > 0) {
    player.effects.frozenTurnsRemaining -= 1;

    if (player.effects.frozenTurnsRemaining === 0) {
      events.push({
        kind: "status",
        targetId: playerId,
        status: "frozen",
        action: "cleared",
        turnsRemaining: 0,
      });
    }
  }

  return { state: nextState, events };
}

export function getPlayerMaximumPower(player: PlayerState): number {
  return player.effects.frozenTurnsRemaining > 0
    ? GAME_CONFIG.projectileEffects.ice.frozenMaxPower
    : GAME_CONFIG.aiming.maxPower;
}
