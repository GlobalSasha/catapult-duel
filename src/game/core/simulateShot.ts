import type { BattleState, PlayerId } from "./battleTypes";
import {
  DEFAULT_ARENA_ID,
  getArenaDefinition,
  type ArenaId,
} from "../arena/arenaCatalog";
import {
  circleIntersectsRectangle,
  circleIntersectsTerrain,
} from "./collision";
import { calculateDirectDamage } from "./damage";
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
    shooter.catapultX +
    resolvedEnvironment.launchOffsetX * horizontalDirection;
  const startY =
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
  for (let step = 1; step <= maxSteps; step += 1) {
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
    const projectileCircle = {
      x,
      y,
      radius: resolvedEnvironment.projectileRadius,
    };
    const hitTarget =
      resolvedEnvironment.collisionsEnabled &&
      circleIntersectsRectangle(projectileCircle, targetRectangle);
    const hitObject =
      resolvedEnvironment.collisionsEnabled &&
      resolvedEnvironment.obstacles.find((obstacle) =>
        circleIntersectsRectangle(projectileCircle, obstacle),
      );
    const hitGround =
      resolvedEnvironment.collisionsEnabled &&
      circleIntersectsTerrain(
        projectileCircle,
        resolvedEnvironment.terrain,
      );
    const outsideWorld = isOutsideWorld(
      point,
      resolvedEnvironment,
    );
    const shouldSavePoint =
      step % sampleEverySteps === 0 ||
      hitTarget ||
      hitObject ||
      hitGround ||
      outsideWorld ||
      step === maxSteps;

    if (shouldSavePoint) {
      points.push(point);
    }

    if (hitTarget) {
      const impactSpeed = Math.hypot(velocityX, velocityY);
      const projectile = GAME_CONFIG.projectiles[command.projectileType];

      return {
        projectileType: command.projectileType,
        points,
        impact: {
          targetId,
          x,
          y,
          impactSpeed,
          damage: calculateDirectDamage({
            baseDamage: projectile.baseDamage,
            impactSpeed,
            materialCoefficient:
              GAME_CONFIG.damage.defaultMaterialCoefficient,
          }),
        },
        objectImpact: null,
        endReason: "impact",
      };
    }

    if (hitObject) {
      return {
        projectileType: command.projectileType,
        points,
        impact: null,
        objectImpact: {
          targetKind: hitObject.targetKind ?? "obstacle",
          targetId: hitObject.id,
          x,
          y,
          impactSpeed: Math.hypot(velocityX, velocityY),
        },
        endReason: "obstacle",
      };
    }

    if (hitGround) {
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
