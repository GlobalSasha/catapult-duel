import { describe, expect, it } from "vitest";

import { createInitialBattleState } from "../src/game/core/createInitialBattleState";
import { GAME_CONFIG } from "../src/game/core/gameConfig";
import {
  calculateLaunchVelocity,
  DEFAULT_SHOT_ENVIRONMENT,
  simulateShot,
} from "../src/game/core/simulateShot";
import type {
  FireCommand,
  ShotSimulationEnvironment,
} from "../src/game/core/shotTypes";
import type { ProjectileType } from "../src/game/core/projectileCatalog";

const BASE_COMMAND: FireCommand = {
  playerId: "left",
  angleDeg: 45,
  power: 60,
  projectileType: "stone",
};

const BALLISTICS_ENVIRONMENT: ShotSimulationEnvironment = {
  ...DEFAULT_SHOT_ENVIRONMENT,
  collisionsEnabled: false,
};

const REACHABLE_SHOTS = [
  ["stone", 22],
  ["fire", 19],
  ["ice", 24],
  ["diamond", 24],
  ["bomb", 26],
] as const satisfies readonly (readonly [ProjectileType, number])[];

function createCalmState() {
  const state = createInitialBattleState();

  state.weather.id = "sandstorm";
  state.weather.wind = 0;
  state.protections = [];
  return state;
}

describe("calculateLaunchVelocity", () => {
  it("uses a different launch speed for each projectile type", () => {
    const speeds = Object.fromEntries(
      (["stone", "fire", "ice", "diamond", "bomb"] as const).map(
        (projectileType) => {
          const velocity = calculateLaunchVelocity(
            "left",
            45,
            GAME_CONFIG.aiming.maxPower,
            projectileType,
          );

          return [projectileType, Math.hypot(velocity.x, velocity.y)];
        },
      ),
    );

    expect(speeds.fire).toBeGreaterThan(speeds.stone ?? 0);
    expect(speeds.stone).toBeGreaterThan(speeds.ice ?? 0);
    expect(speeds.ice).toBeGreaterThan(speeds.diamond ?? 0);
    expect(speeds.diamond).toBeGreaterThan(speeds.bomb ?? 0);
  });

  it("maps minimum and maximum power to the configured speed range", () => {
    const minimum = calculateLaunchVelocity(
      "left",
      45,
      GAME_CONFIG.aiming.minPower,
    );
    const maximum = calculateLaunchVelocity(
      "left",
      45,
      GAME_CONFIG.aiming.maxPower,
    );

    expect(Math.hypot(minimum.x, minimum.y)).toBeCloseTo(
      GAME_CONFIG.physics.minSpeed *
        GAME_CONFIG.projectiles.stone.launchSpeedMultiplier,
      10,
    );
    expect(Math.hypot(maximum.x, maximum.y)).toBeCloseTo(
      GAME_CONFIG.physics.maxSpeed *
        GAME_CONFIG.projectiles.stone.launchSpeedMultiplier,
      10,
    );
  });

  it("mirrors horizontal velocity for the right player", () => {
    const left = calculateLaunchVelocity("left", 45, 60);
    const right = calculateLaunchVelocity("right", 45, 60);

    expect(right.x).toBeCloseTo(-left.x, 10);
    expect(right.y).toBeCloseTo(left.y, 10);
  });

  it.each([10, 45, 80])(
    "uses the configured speed formula at %i degrees",
    (angleDeg) => {
      const velocity = calculateLaunchVelocity(
        "left",
        angleDeg,
        GAME_CONFIG.aiming.maxPower,
      );
      const angleRad = (angleDeg * Math.PI) / 180;
      const projectileSpeed =
        GAME_CONFIG.physics.maxSpeed *
        GAME_CONFIG.projectiles.stone.launchSpeedMultiplier;

      expect(velocity.x).toBeCloseTo(
        Math.cos(angleRad) * projectileSpeed,
        10,
      );
      expect(velocity.y).toBeCloseTo(
        -Math.sin(angleRad) * projectileSpeed,
        10,
      );
    },
  );
});

describe("simulateShot", () => {
  it.each<readonly [ProjectileType, number, number]>([
    ["stone", 22, 99],
    ["fire", 19, 99],
    ["ice", 24, 99],
    ["diamond", 24, 100],
    ["bomb", 26, 99],
  ])(
    "keeps %s capable of reaching the opponent",
    (projectileType, angleDeg, power) => {
      const result = simulateShot(
        {
          playerId: "left",
          angleDeg,
          power,
          projectileType,
        },
        createCalmState(),
      );

      expect(result.endReason).toBe("impact");
      expect(result.impact?.targetId).toBe("right");
    },
  );

  it.each([
    ["superheat", -30],
    ["rain", -50],
    ["snow", -40],
    ["sandstorm", -120],
  ] as const)(
    "keeps every projectile viable in %s with the strongest headwind",
    (weatherId, wind) => {
      for (const [projectileType, angleDeg] of REACHABLE_SHOTS) {
        const state = createInitialBattleState();
        state.weather.id = weatherId;
        state.weather.wind = wind;
        state.protections = [];
        const result = simulateShot(
          {
            playerId: "left",
            angleDeg,
            power: 100,
            projectileType,
          },
          state,
        );

        expect(result.endReason, projectileType).toBe("impact");
      }
    },
  );

  it("applies the current wind to projectile flight", () => {
    const followingWind = createCalmState();
    followingWind.weather.wind = 120;
    const headwind = createCalmState();
    headwind.weather.wind = -120;
    const shortEnvironment: ShotSimulationEnvironment = {
      ...BALLISTICS_ENVIRONMENT,
      gravity: 0,
      maxFlightSeconds: 0.5,
      worldWidth: 100_000,
      worldHeight: 100_000,
      terrain: [
        { x: 0, y: 100_000 },
        { x: 100_000, y: 100_000 },
      ],
      obstacles: [],
      outOfBoundsMargin: 1_000,
    };
    const followingResult = simulateShot(
      BASE_COMMAND,
      followingWind,
      shortEnvironment,
    );
    const headwindResult = simulateShot(
      BASE_COMMAND,
      headwind,
      shortEnvironment,
    );

    expect(followingResult.points.at(-1)?.x).toBeGreaterThan(
      headwindResult.points.at(-1)?.x ?? 0,
    );
  });

  it("returns the same result for the same command and state", () => {
    const state = createCalmState();

    expect(simulateShot(BASE_COMMAND, state, BALLISTICS_ENVIRONMENT)).toEqual(
      simulateShot(BASE_COMMAND, state, BALLISTICS_ENVIRONMENT),
    );
  });

  it("produces mirrored trajectories for both players", () => {
    const state = createCalmState();
    const leftResult = simulateShot(
      BASE_COMMAND,
      state,
      BALLISTICS_ENVIRONMENT,
    );
    const rightResult = simulateShot(
      { ...BASE_COMMAND, playerId: "right" },
      state,
      BALLISTICS_ENVIRONMENT,
    );

    expect(rightResult.endReason).toBe(leftResult.endReason);
    expect(rightResult.points).toHaveLength(leftResult.points.length);

    leftResult.points.forEach((leftPoint, index) => {
      const rightPoint = rightResult.points[index];

      expect(rightPoint).toBeDefined();
      expect(rightPoint?.timeMs).toBeCloseTo(leftPoint.timeMs, 10);
      expect(rightPoint?.x).toBeCloseTo(
        GAME_CONFIG.world.width - leftPoint.x,
        9,
      );
      expect(rightPoint?.y).toBeCloseTo(leftPoint.y, 10);
    });
  });

  it("applies gravity with the fixed semi-implicit Euler step", () => {
    const state = createInitialBattleState();
    const result = simulateShot(
      BASE_COMMAND,
      state,
      BALLISTICS_ENVIRONMENT,
    );
    const firstSample = result.points[1];
    const initialVelocity = calculateLaunchVelocity(
      BASE_COMMAND.playerId,
      BASE_COMMAND.angleDeg,
      BASE_COMMAND.power,
    );
    const sampledSteps =
      GAME_CONFIG.physics.stepHz /
      GAME_CONFIG.physics.trajectorySampleHz;
    const timeStepSeconds = 1 / GAME_CONFIG.physics.stepHz;
    const expectedY =
      state.players.left.catapultY +
      GAME_CONFIG.catapult.launchOffsetY +
      initialVelocity.y * timeStepSeconds * sampledSteps +
      GAME_CONFIG.physics.gravity *
        timeStepSeconds *
        timeStepSeconds *
        ((sampledSteps * (sampledSteps + 1)) / 2);

    expect(firstSample).toBeDefined();
    expect(firstSample?.y).toBeCloseTo(expectedY, 10);
  });

  it("samples at the configured rate and always terminates", () => {
    const result = simulateShot(
      BASE_COMMAND,
      createInitialBattleState(),
      BALLISTICS_ENVIRONMENT,
    );
    const regularSampleDurationMs =
      1000 / GAME_CONFIG.physics.trajectorySampleHz;
    const lastPoint = result.points.at(-1);
    const finalStep = Math.round(
      (lastPoint?.timeMs ?? 0) /
        (1000 / GAME_CONFIG.physics.stepHz),
    );
    const sampleEverySteps =
      GAME_CONFIG.physics.stepHz /
      GAME_CONFIG.physics.trajectorySampleHz;
    const expectedPointCount =
      1 +
      Math.floor(finalStep / sampleEverySteps) +
      (finalStep % sampleEverySteps === 0 ? 0 : 1);

    expect(result.endReason).toBe("out-of-bounds");
    expect(result.points.length).toBeGreaterThan(2);
    expect(result.points).toHaveLength(expectedPointCount);
    expect(result.points.length).toBeLessThanOrEqual(
      GAME_CONFIG.physics.maxFlightSeconds *
        GAME_CONFIG.physics.trajectorySampleHz +
        2,
    );
    expect(result.points.at(-1)?.timeMs).toBeLessThanOrEqual(
      GAME_CONFIG.physics.maxFlightSeconds * 1000,
    );

    for (let index = 1; index < result.points.length - 1; index += 1) {
      const point = result.points[index];
      const previousPoint = result.points[index - 1];

      expect(point).toBeDefined();
      expect(previousPoint).toBeDefined();
      expect((point?.timeMs ?? 0) - (previousPoint?.timeMs ?? 0)).toBeCloseTo(
        regularSampleDurationMs,
        10,
      );
    }
  });

  it("ends with a timeout when no collision or boundary can be reached", () => {
    const timeoutEnvironment: ShotSimulationEnvironment = {
      ...BALLISTICS_ENVIRONMENT,
      gravity: 0,
      maxFlightSeconds: 0.1,
      worldWidth: 100_000,
      worldHeight: 100_000,
      terrain: [
        { x: 0, y: 100_000 },
        { x: 100_000, y: 100_000 },
      ],
      obstacles: [],
      outOfBoundsMargin: 1_000,
    };
    const result = simulateShot(
      BASE_COMMAND,
      createInitialBattleState(),
      timeoutEnvironment,
    );

    expect(result.endReason).toBe("timeout");
    expect(result.points.at(-1)?.timeMs).toBeCloseTo(100, 10);
  });
});
