import type { BattleState, PlayerId, PlayerState } from "./battleTypes";
import {
  getArenaDefinition,
  getTerrainHeightAt,
} from "../arena/arenaCatalog";
import {
  calculateDirectDamage,
  calculatePhysicalImpactDamage,
} from "./damage";
import { GAME_CONFIG } from "./gameConfig";
import type {
  BattleEvent,
  BattleTransition,
  CatapultHitZone,
  DamageSource,
  MaterialReaction,
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
    knightSquads: {
      left: { ...state.knightSquads.left },
      right: { ...state.knightSquads.right },
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

    if (target.durability === 0) {
      const player = state.players[target.ownerId];
      const groundY = getTerrainHeightAt(
        getArenaDefinition(state.arenaId).terrain,
        player.catapultX,
      );

      if (player.catapultY !== groundY) {
        const fromY = player.catapultY;
        player.catapultY = groundY;
        events.push({
          kind: "displacement",
          targetId: target.ownerId,
          fromX: player.catapultX,
          fromY,
          toX: player.catapultX,
          toY: groundY,
          distance: Math.round(Math.abs(groundY - fromY)),
        });
      }
    }
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

type ImpactMaterial =
  | "stone"
  | "composite";

function getObjectMaterial(
  state: BattleState,
  targetKind: "protection" | "obstacle",
  targetId: string,
): ImpactMaterial {
  if (targetKind === "protection") {
    return "stone";
  }

  const obstacle = getArenaDefinition(state.arenaId).obstacles.find(
    (candidate) => candidate.id === targetId,
  );

  return obstacle?.kind === "rock" ? "stone" : "composite";
}

function getMaterialReaction(
  projectileType: ShotResult["projectileType"],
  material: ImpactMaterial,
): MaterialReaction {
  if (projectileType === "fire") {
    return "scorch";
  }

  if (projectileType === "ice") {
    return "frost";
  }

  if (material === "stone") {
    return "crack";
  }

  return "splinter";
}

function pushMaterialReaction(
  events: BattleEvent[],
  shot: ShotResult,
  material: ImpactMaterial,
  targetKind: "protection" | "obstacle" | "catapult",
  targetId: string,
  x: number,
  y: number,
  impactSpeed: number,
): void {
  events.push({
    kind: "material-reaction",
    reaction: getMaterialReaction(shot.projectileType, material),
    projectileType: shot.projectileType,
    targetKind,
    targetId,
    x,
    y,
    intensity: Math.min(
      1.5,
      Math.max(0.45, impactSpeed / GAME_CONFIG.damage.energyReferenceSpeed),
    ),
  });
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
  const projectile = GAME_CONFIG.projectiles[shot.projectileType];
  let damage =
    shot.objectImpact.normalImpactRatio === undefined
      ? calculateDirectDamage({
          baseDamage: projectile.baseDamage,
          impactSpeed: shot.objectImpact.impactSpeed,
          materialCoefficient: coefficient,
        })
      : calculatePhysicalImpactDamage({
          baseDamage: projectile.baseDamage,
          impactSpeed: shot.objectImpact.impactSpeed,
          relativeMass: projectile.relativeMass,
          normalImpactRatio: shot.objectImpact.normalImpactRatio,
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
  pushMaterialReaction(
    events,
    shot,
    getObjectMaterial(
      state,
      shot.objectImpact.targetKind,
      shot.objectImpact.targetId,
    ),
    shot.objectImpact.targetKind,
    shot.objectImpact.targetId,
    shot.objectImpact.x,
    shot.objectImpact.y,
    shot.objectImpact.impactSpeed,
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
  pushMaterialReaction(
    events,
    shot,
    "composite",
    "catapult",
    shot.impact.targetId,
    shot.impact.x,
    shot.impact.y,
    shot.impact.impactSpeed,
  );

  return state.players[shot.impact.targetId];
}

function applyKnightDamage(
  state: BattleState,
  events: BattleEvent[],
  targetId: PlayerId,
  amount: number,
  source: "direct" | "explosion",
  x: number,
  y: number,
): void {
  const target = state.knightSquads[targetId];
  const roundedAmount = Math.max(0, Math.round(amount));

  if (target.health === 0 || roundedAmount === 0) {
    return;
  }

  const actualDamage = Math.min(target.health, roundedAmount);
  target.health -= actualDamage;
  events.push({
    kind: "knight-damage",
    targetId,
    amount: actualDamage,
    health: target.health,
    source,
    x,
    y,
  });
}

function applyDirectKnightHit(
  state: BattleState,
  shot: ShotResult,
  events: BattleEvent[],
): void {
  if (!shot.knightImpact) {
    return;
  }

  applyKnightDamage(
    state,
    events,
    shot.knightImpact.targetId,
    shot.knightImpact.damage,
    "direct",
    shot.knightImpact.x,
    shot.knightImpact.y,
  );
}

function rectanglesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function isCatapultPositionAvailable(
  state: BattleState,
  playerId: PlayerId,
  x: number,
  y: number,
): boolean {
  const margin = GAME_CONFIG.displacement.worldMargin;

  if (x < margin || x > GAME_CONFIG.world.width - margin) {
    return false;
  }

  const opponentId = playerId === "left" ? "right" : "left";

  if (
    Math.abs(x - state.players[opponentId].catapultX) <
    GAME_CONFIG.displacement.minimumOpponentGap
  ) {
    return false;
  }

  const bounds = {
    x: x - GAME_CONFIG.catapult.colliderWidth / 2,
    y: y - GAME_CONFIG.catapult.colliderHeight,
    width: GAME_CONFIG.catapult.colliderWidth,
    height: GAME_CONFIG.catapult.colliderHeight,
  };
  const protectionCollision = state.protections
    .filter((protection) => protection.durability > 0)
    .some((protection) => rectanglesOverlap(bounds, protection));

  if (protectionCollision) {
    return false;
  }

  return !getArenaDefinition(state.arenaId).obstacles
    .filter(
      (obstacle) => (state.obstacles[obstacle.id]?.durability ?? 0) > 0,
    )
    .some((obstacle) =>
      obstacle.collisionParts.some((part) =>
        rectanglesOverlap(bounds, {
          x: obstacle.x + part.offsetX,
          y: obstacle.y + part.offsetY,
          width: part.width,
          height: part.height,
        }),
      ),
    );
}

function moveCatapult(
  state: BattleState,
  events: BattleEvent[],
  playerId: PlayerId,
  requestedDistance: number,
): void {
  const player = state.players[playerId];

  if (
    state.protections.some(
      (protection) =>
        protection.ownerId === playerId && protection.durability > 0,
    )
  ) {
    return;
  }

  const arena = getArenaDefinition(state.arenaId);
  const direction = Math.sign(requestedDistance);
  const absoluteDistance = Math.abs(requestedDistance);

  if (
    direction === 0 ||
    absoluteDistance < GAME_CONFIG.displacement.minimumDistance
  ) {
    return;
  }

  for (
    let distance = absoluteDistance;
    distance >= GAME_CONFIG.displacement.minimumDistance;
    distance -= GAME_CONFIG.displacement.searchStep
  ) {
    const nextX = player.catapultX + direction * distance;
    const nextY = getTerrainHeightAt(arena.terrain, nextX);

    if (
      Math.abs(nextY - player.catapultY) >
        GAME_CONFIG.displacement.maximumTerrainStep ||
      !isCatapultPositionAvailable(state, playerId, nextX, nextY)
    ) {
      continue;
    }

    const fromX = player.catapultX;
    const fromY = player.catapultY;
    player.catapultX = nextX;
    player.catapultY = nextY;
    events.push({
      kind: "displacement",
      targetId: playerId,
      fromX,
      fromY,
      toX: nextX,
      toY: nextY,
      distance: Math.round(Math.hypot(nextX - fromX, nextY - fromY)),
    });
    return;
  }
}

function applyImpactDisplacement(
  state: BattleState,
  shot: ShotResult,
  events: BattleEvent[],
): void {
  const impact = shot.impact;

  if (
    !impact ||
    impact.velocityX === undefined ||
    impact.impactSpeed < GAME_CONFIG.displacement.minimumImpactSpeed
  ) {
    return;
  }

  const hitZone: CatapultHitZone = impact.hitZone ?? "frame";
  const projectile = GAME_CONFIG.projectiles[shot.projectileType];
  const requestedDistance = Math.min(
    GAME_CONFIG.displacement.maximumDistance,
    Math.abs(impact.velocityX) *
      GAME_CONFIG.displacement.speedToDistance *
      projectile.relativeMass *
      GAME_CONFIG.displacement.hitZoneMobility[hitZone] *
      GAME_CONFIG.displacement.weatherMobility[state.weather.id],
  );

  moveCatapult(
    state,
    events,
    impact.targetId,
    Math.sign(impact.velocityX) * requestedDistance,
  );
}

function applyBombDisplacement(
  state: BattleState,
  shot: ShotResult,
  events: BattleEvent[],
): void {
  if (
    shot.projectileType !== "bomb" ||
    !["impact", "knight-impact", "ground", "obstacle"].includes(
      shot.endReason,
    )
  ) {
    return;
  }

  const explosionPoint = getExplosionPoint(shot);

  if (!explosionPoint) {
    return;
  }

  const positions = (["left", "right"] as const).map((playerId) => {
    const player = state.players[playerId];
    const distance = Math.hypot(
      player.catapultX - explosionPoint.x,
      player.catapultY - GAME_CONFIG.catapult.colliderHeight / 2 -
        explosionPoint.y,
    );

    return { playerId, x: player.catapultX, distance };
  });

  positions.forEach(({ playerId, x, distance }) => {
    if (
      distance >= GAME_CONFIG.projectileEffects.bomb.explosionRadius ||
      shot.impact?.targetId === playerId
    ) {
      return;
    }

    const falloff =
      1 - distance / GAME_CONFIG.projectileEffects.bomb.explosionRadius;
    const direction = Math.sign(x - explosionPoint.x) ||
      (playerId === "left" ? -1 : 1);
    moveCatapult(
      state,
      events,
      playerId,
      direction * GAME_CONFIG.displacement.maximumDistance * 0.7 * falloff,
    );
  });
}

function applyBombExplosion(
  state: BattleState,
  shot: ShotResult,
  events: BattleEvent[],
): void {
  if (
    shot.projectileType !== "bomb" ||
    !["impact", "knight-impact", "ground", "obstacle"].includes(
      shot.endReason,
    )
  ) {
    return;
  }

  const explosionPoint = getExplosionPoint(shot);

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

  (["left", "right"] as const).forEach((playerId) => {
    const squad = state.knightSquads[playerId];

    if (squad.health === 0) {
      return;
    }

    const distance = Math.hypot(
      explosionPoint.x - squad.x,
      explosionPoint.y -
        (squad.y - GAME_CONFIG.knights.colliderHeight / 2),
    );

    if (distance >= explosionRadius) {
      return;
    }

    applyKnightDamage(
      state,
      events,
      playerId,
      maxExplosionDamage *
        (1 - distance / explosionRadius) *
        GAME_CONFIG.knights.damageCoefficients.bomb,
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
    pushMaterialReaction(
      events,
      shot,
      getObjectMaterial(state, target.kind, target.id),
      target.kind,
      target.id,
      explosionPoint.x,
      explosionPoint.y,
      GAME_CONFIG.damage.energyReferenceSpeed * (0.7 + damage / 100),
    );
  });
}

function getExplosionPoint(
  shot: ShotResult,
): { x: number; y: number } | null {
  if (shot.impact) {
    return { x: shot.impact.x, y: shot.impact.y };
  }

  if (shot.objectImpact) {
    return { x: shot.objectImpact.x, y: shot.objectImpact.y };
  }

  if (shot.knightImpact) {
    return { x: shot.knightImpact.x, y: shot.knightImpact.y };
  }

  const lastPoint = shot.points.at(-1);
  return lastPoint ? { x: lastPoint.x, y: lastPoint.y } : null;
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

  applyDirectKnightHit(nextState, shot, events);
  applyDirectObjectHit(nextState, shot, events);
  applyStatusEffect(
    directTarget,
    shot,
    events,
    nextState.weather.id,
  );
  applyBombExplosion(nextState, shot, events);
  applyImpactDisplacement(nextState, shot, events);
  applyBombDisplacement(nextState, shot, events);

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
