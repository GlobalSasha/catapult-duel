import type { BattleState, PlayerId } from "./battleTypes";
import {
  DEFAULT_ARENA_ID,
  getArenaDefinition,
  type ArenaId,
} from "../arena/arenaCatalog";
import {
  sweepCircleAgainstRectangle,
  sweepCircleAgainstTerrain,
  type SweptCollision,
} from "./collision";
import { calculatePhysicalImpactDamage } from "./damage";
import { GAME_CONFIG } from "./gameConfig";
import type { ProjectileType } from "./projectileCatalog";
import { getWeatherDefinition } from "./weather";
import type {
  FireCommand,
  FlightPoint,
  LaunchVelocity,
  ShotResult,
  ShotSimulationEnvironment,
} from "./shotTypes";

const MILLISECONDS_PER_SECOND = 1000;
const DEGREES_IN_HALF_TURN = 180;

export function createShotEnvironment(
  arenaId: ArenaId,
  projectileType: ProjectileType = "stone",
  battleState?: BattleState,
): ShotSimulationEnvironment {
  const arena = getArenaDefinition(arenaId);
  const activeObstacles = arena.obstacles
    .filter(
      (obstacle) =>
        !battleState ||
        (battleState.obstacles[obstacle.id]?.durability ?? 0) > 0,
    )
    .flatMap((obstacle) =>
      obstacle.collisionParts.map((part) => ({
        id: obstacle.id,
        targetKind: "obstacle" as const,
        x: obstacle.x + part.offsetX,
        y: obstacle.y + part.offsetY,
        width: part.width,
        height: part.height,
      })),
    );
  const activeProtections = (battleState?.protections ?? [])
    .filter((protection) => protection.durability > 0)
    .map((protection) => ({
      id: protection.id,
      targetKind: "protection" as const,
      x: protection.x,
      y: protection.y,
      width: protection.width,
      height: protection.height,
    }));

  return {
    stepHz: GAME_CONFIG.physics.stepHz,
    trajectorySampleHz: GAME_CONFIG.physics.trajectorySampleHz,
    gravity: GAME_CONFIG.physics.gravity,
    maxFlightSeconds: GAME_CONFIG.physics.maxFlightSeconds,
    worldWidth: GAME_CONFIG.world.width,
    worldHeight: GAME_CONFIG.world.height,
    outOfBoundsMargin: GAME_CONFIG.world.outOfBoundsMargin,
    verticalOutOfBoundsMargin:
      GAME_CONFIG.world.verticalOutOfBoundsMargin,
    projectileRadius: GAME_CONFIG.projectiles[projectileType].radius,
    catapultColliderWidth: GAME_CONFIG.catapult.colliderWidth,
    catapultColliderHeight: GAME_CONFIG.catapult.colliderHeight,
    launchOffsetX: GAME_CONFIG.catapult.launchOffsetX,
    launchOffsetY: GAME_CONFIG.catapult.launchOffsetY,
    terrain: arena.terrain,
    obstacles: [...activeObstacles, ...activeProtections],
    collisionsEnabled: true,
  };
}

export const DEFAULT_SHOT_ENVIRONMENT: ShotSimulationEnvironment =
  createShotEnvironment(DEFAULT_ARENA_ID);

function powerToSpeed(
  power: number,
  projectileType: ProjectileType,
  weatherSpeedMultiplier: number,
): number {
  const powerRange =
    GAME_CONFIG.aiming.maxPower - GAME_CONFIG.aiming.minPower;
  const powerRatio = (power - GAME_CONFIG.aiming.minPower) / powerRange;
  const speedRange =
    GAME_CONFIG.physics.maxSpeed - GAME_CONFIG.physics.minSpeed;

  const baseSpeed =
    GAME_CONFIG.physics.minSpeed + powerRatio * speedRange;

  return (
    baseSpeed *
    GAME_CONFIG.projectiles[projectileType].launchSpeedMultiplier *
    weatherSpeedMultiplier
  );
}

export function calculateLaunchVelocity(
  playerId: PlayerId,
  angleDeg: number,
  power: number,
  projectileType: ProjectileType = "stone",
  weatherSpeedMultiplier: number = 1,
): LaunchVelocity {
  const speed = powerToSpeed(
    power,
    projectileType,
    weatherSpeedMultiplier,
  );
  const angleRad = (angleDeg * Math.PI) / DEGREES_IN_HALF_TURN;
  const horizontalDirection = playerId === "left" ? 1 : -1;

  return {
    x: Math.cos(angleRad) * speed * horizontalDirection,
    y: -Math.sin(angleRad) * speed,
  };
}

function isOutsideWorld(
  point: FlightPoint,
  environment: ShotSimulationEnvironment,
): boolean {
  const margin = environment.outOfBoundsMargin;
  const verticalMargin = environment.verticalOutOfBoundsMargin;

  return (
    point.x < -margin ||
    point.x > environment.worldWidth + margin ||
    point.y < -verticalMargin ||
    point.y > environment.worldHeight + margin
  );
}

function getTargetPlayerId(playerId: PlayerId): PlayerId {
  return playerId === "left" ? "right" : "left";
}

function getNormalImpactRatio(
  velocityX: number,
  velocityY: number,
  normalX: number,
  normalY: number,
): number {
  const speed = Math.max(1, Math.hypot(velocityX, velocityY));

  return Math.min(
    1,
    Math.abs(velocityX * normalX + velocityY * normalY) / speed,
  );
}

type CollisionCandidate =
  | { kind: "target"; hit: SweptCollision }
  | { kind: "squad"; hit: SweptCollision }
  | {
      kind: "object";
      hit: SweptCollision;
      object: ShotSimulationEnvironment["obstacles"][number];
    }
  | { kind: "ground"; hit: SweptCollision };

const COLLISION_PRIORITY: Record<CollisionCandidate["kind"], number> = {
  object: 0,
  squad: 1,
  target: 2,
  ground: 3,
};

function getFirstCollision(
  start: FlightPoint,
  end: FlightPoint,
  targetRectangle: { x: number; y: number; width: number; height: number },
  squadRectangle: { x: number; y: number; width: number; height: number } | null,
  environment: ShotSimulationEnvironment,
  ignoreLaunchOverlap: boolean,
  highestTerrainY: number,
): CollisionCandidate | null {
  if (!environment.collisionsEnabled) {
    return null;
  }

  const candidates: CollisionCandidate[] = [];
  const targetHit = sweepCircleAgainstRectangle(
    start,
    end,
    environment.projectileRadius,
    targetRectangle,
  );

  if (targetHit) {
    candidates.push({ kind: "target", hit: targetHit });
  }

  const squadHit = squadRectangle
    ? sweepCircleAgainstRectangle(
        start,
        end,
        environment.projectileRadius,
        squadRectangle,
      )
    : null;

  if (squadHit) {
    candidates.push({ kind: "squad", hit: squadHit });
  }

  environment.obstacles.forEach((object) => {
    const hit = sweepCircleAgainstRectangle(
      start,
      end,
      environment.projectileRadius,
      object,
    );

    const movementIntoSurface = hit
      ? (end.x - start.x) * hit.normalX +
        (end.y - start.y) * hit.normalY
      : 0;
    const startsInside = hit?.time === 0;
    const allowLaunchOverlap = startsInside && ignoreLaunchOverlap;

    if (
      hit &&
      (!allowLaunchOverlap || movementIntoSurface < -1e-6)
    ) {
      candidates.push({ kind: "object", hit, object });
    }
  });

  const groundHit =
    Math.max(start.y, end.y) + environment.projectileRadius >=
    highestTerrainY
      ? sweepCircleAgainstTerrain(
          start,
          end,
          environment.projectileRadius,
          environment.terrain,
        )
      : null;

  if (groundHit) {
    candidates.push({ kind: "ground", hit: groundHit });
  }

  return candidates.reduce<CollisionCandidate | null>(
    (earliest, candidate) => {
      if (!earliest) {
        return candidate;
      }

      const timeDifference = candidate.hit.time - earliest.hit.time;
      return timeDifference < 0 ||
        (Math.abs(timeDifference) <= 1e-9 &&
          COLLISION_PRIORITY[candidate.kind] <
            COLLISION_PRIORITY[earliest.kind])
        ? candidate
        : earliest;
    },
    null,
  );
}

export function simulateShot(
  command: FireCommand,
  state: BattleState,
  environment?: ShotSimulationEnvironment,
): ShotResult {
  const resolvedEnvironment =
    environment ??
    createShotEnvironment(
      state.arenaId,
      command.projectileType,
      state,
    );
  const shooter = state.players[command.playerId];
  const horizontalDirection = command.playerId === "left" ? 1 : -1;
  const startX =
    command.launchPoint?.x ??
    shooter.catapultX +
      resolvedEnvironment.launchOffsetX * horizontalDirection;
  const startY =
    command.launchPoint?.y ??
    shooter.catapultY + resolvedEnvironment.launchOffsetY;
  const velocity = calculateLaunchVelocity(
    command.playerId,
    command.angleDeg,
    command.power,
    command.projectileType,
    getWeatherDefinition(state.weather.id).launchSpeedMultiplier,
  );
  const weatherDefinition = getWeatherDefinition(state.weather.id);
  const timeStepSeconds = 1 / resolvedEnvironment.stepHz;
  const sampleEverySteps =
    resolvedEnvironment.stepHz /
    resolvedEnvironment.trajectorySampleHz;
  const maxSteps =
    resolvedEnvironment.stepHz *
    resolvedEnvironment.maxFlightSeconds;

  let x = startX;
  let y = startY;
  let velocityX = velocity.x;
  let velocityY = velocity.y;

  const points: FlightPoint[] = [{ timeMs: 0, x, y }];
  const targetId = getTargetPlayerId(command.playerId);
  const target = state.players[targetId];
  const targetRectangle = {
    x:
      target.catapultX -
      resolvedEnvironment.catapultColliderWidth / 2,
    y:
      target.catapultY -
      resolvedEnvironment.catapultColliderHeight,
    width: resolvedEnvironment.catapultColliderWidth,
    height: resolvedEnvironment.catapultColliderHeight,
  };
  const targetSquad = state.knightSquads[targetId];
  const squadRectangle =
    targetSquad.health > 0
      ? {
          x: targetSquad.x - GAME_CONFIG.knights.colliderWidth / 2,
          y: targetSquad.y - GAME_CONFIG.knights.colliderHeight,
          width: GAME_CONFIG.knights.colliderWidth,
          height: GAME_CONFIG.knights.colliderHeight,
        }
      : null;
  const highestTerrainY = Math.min(
    ...resolvedEnvironment.terrain.map(({ y: terrainY }) => terrainY),
  );
  for (let step = 1; step <= maxSteps; step += 1) {
    const previousPoint: FlightPoint = {
      timeMs: (step - 1) * timeStepSeconds * MILLISECONDS_PER_SECOND,
      x,
      y,
    };
    velocityX +=
      state.weather.wind *
      GAME_CONFIG.projectiles[command.projectileType].windFactor *
      GAME_CONFIG.physics.windAccelerationScale *
      timeStepSeconds;
    velocityY +=
      resolvedEnvironment.gravity *
      weatherDefinition.gravityMultiplier *
      timeStepSeconds;
    x += velocityX * timeStepSeconds;
    y += velocityY * timeStepSeconds;

    const point: FlightPoint = {
      timeMs: step * timeStepSeconds * MILLISECONDS_PER_SECOND,
      x,
      y,
    };
    const collision = getFirstCollision(
      previousPoint,
      point,
      targetRectangle,
      squadRectangle,
      resolvedEnvironment,
      step <= 2,
      highestTerrainY,
    );
    if (collision) {
      point.timeMs =
        previousPoint.timeMs +
        collision.hit.time * timeStepSeconds * MILLISECONDS_PER_SECOND;
      point.x = collision.hit.centerX;
      point.y = collision.hit.centerY;
      x = point.x;
      y = point.y;
    }
    const outsideWorld = isOutsideWorld(
      point,
      resolvedEnvironment,
    );
    const shouldSavePoint =
      step % sampleEverySteps === 0 ||
      collision !== null ||
      outsideWorld ||
      step === maxSteps;

    if (shouldSavePoint) {
      points.push(point);
    }

    if (collision?.kind === "target") {
      const impactSpeed = Math.hypot(velocityX, velocityY);
      const projectile = GAME_CONFIG.projectiles[command.projectileType];
      const normalImpactRatio = getNormalImpactRatio(
        velocityX,
        velocityY,
        collision.hit.normalX,
        collision.hit.normalY,
      );
      const normalizedY = Math.min(
        1,
        Math.max(
          0,
          (collision.hit.contactY - targetRectangle.y) /
            targetRectangle.height,
        ),
      );
      const hitZone =
        normalizedY < 0.34
          ? "arm"
          : normalizedY > 0.72
            ? "wheels"
            : "frame";

      return {
        projectileType: command.projectileType,
        points,
        impact: {
          targetId,
          x: collision.hit.contactX,
          y: collision.hit.contactY,
          impactSpeed,
          velocityX,
          velocityY,
          normalImpactRatio,
          hitZone,
          damage: calculatePhysicalImpactDamage({
            baseDamage: projectile.baseDamage,
            impactSpeed,
            relativeMass: projectile.relativeMass,
            normalImpactRatio,
            materialCoefficient:
              GAME_CONFIG.damage.defaultMaterialCoefficient,
            hitZone,
          }),
        },
        objectImpact: null,
        endReason: "impact",
      };
    }


    if (collision?.kind === "squad") {
      const impactSpeed = Math.hypot(velocityX, velocityY);
      const projectile = GAME_CONFIG.projectiles[command.projectileType];
      const normalImpactRatio = getNormalImpactRatio(
        velocityX,
        velocityY,
        collision.hit.normalX,
        collision.hit.normalY,
      );

      return {
        projectileType: command.projectileType,
        points,
        impact: null,
        knightImpact: {
          targetId,
          x: collision.hit.contactX,
          y: collision.hit.contactY,
          impactSpeed,
          velocityX,
          velocityY,
          normalImpactRatio,
          damage: calculatePhysicalImpactDamage({
            baseDamage: projectile.baseDamage,
            impactSpeed,
            relativeMass: projectile.relativeMass,
            normalImpactRatio,
            materialCoefficient:
              GAME_CONFIG.knights.damageCoefficients[
                command.projectileType
              ],
          }),
        },
        objectImpact: null,
        endReason: "knight-impact",
      };
    }

    if (collision?.kind === "object") {
      const normalImpactRatio = getNormalImpactRatio(
        velocityX,
        velocityY,
        collision.hit.normalX,
        collision.hit.normalY,
      );
      return {
        projectileType: command.projectileType,
        points,
        impact: null,
        objectImpact: {
          targetKind: collision.object.targetKind ?? "obstacle",
          targetId: collision.object.id,
          x: collision.hit.contactX,
          y: collision.hit.contactY,
          impactSpeed: Math.hypot(velocityX, velocityY),
          velocityX,
          velocityY,
          normalImpactRatio,
        },
        endReason: "obstacle",
      };
    }

    if (collision?.kind === "ground") {
      return {
        projectileType: command.projectileType,
        points,
        impact: null,
        objectImpact: null,
        endReason: "ground",
      };
    }

    if (outsideWorld) {
      return {
        projectileType: command.projectileType,
        points,
        impact: null,
        objectImpact: null,
        endReason: "out-of-bounds",
      };
    }
  }

  return {
    projectileType: command.projectileType,
    points,
    impact: null,
    objectImpact: null,
    endReason: "timeout",
  };
}
