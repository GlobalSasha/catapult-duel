import { describe, expect, it } from "vitest";

import { BattleController } from "../src/game/core/BattleController";
import { createInitialBattleState } from "../src/game/core/createInitialBattleState";
import { GAME_CONFIG } from "../src/game/core/gameConfig";
import {
  resolveEndOfTurnEffects,
  resolveProjectileShot,
} from "../src/game/core/projectileEffects";
import { calculateLaunchVelocity } from "../src/game/core/simulateShot";
import type { ShotResult } from "../src/game/core/shotTypes";
import {
  advanceWeather,
  createWeatherState,
  getWeatherDefinition,
  WEATHER_IDS,
  type WeatherId,
} from "../src/game/core/weather";

function directShot(projectileType: "fire" | "ice"): ShotResult {
  return {
    projectileType,
    points: [{ timeMs: 0, x: 6600, y: 640 }],
    impact: {
      targetId: "right",
      x: 6600,
      y: 640,
      impactSpeed: 700,
      damage: 1,
    },
    endReason: "impact",
  };
}

function stateWithWeather(weatherId: WeatherId) {
  const state = createInitialBattleState();

  state.weather.id = weatherId;
  state.weather.wind = 0;
  return state;
}

describe("seeded weather", () => {
  it("reproduces the same weather and wind from the same seed", () => {
    expect(createWeatherState(123456)).toEqual(
      createWeatherState(123456),
    );
  });

  it("can deterministically select every weather mode", () => {
    const selected = new Set<WeatherId>();

    for (let seed = 1; seed <= 20_000; seed += 1) {
      selected.add(createWeatherState(seed).id);
      if (selected.size === WEATHER_IDS.length) {
        break;
      }
    }

    expect(selected).toEqual(new Set(WEATHER_IDS));
  });

  it.each(WEATHER_IDS)(
    "keeps %s wind inside its configured range",
    (weatherId) => {
      let weather = createWeatherState(918273);
      weather = { ...weather, id: weatherId };
      const definition = getWeatherDefinition(weatherId);

      for (let turn = 0; turn < 30; turn += 1) {
        weather = advanceWeather(weather);
        expect(weather.wind).toBeGreaterThanOrEqual(
          definition.windMinimum,
        );
        expect(weather.wind).toBeLessThanOrEqual(
          definition.windMaximum,
        );
        expect(Math.abs(weather.wind % 5)).toBe(0);
      }
    },
  );

  it("changes wind before the next decision without changing weather", () => {
    const controller = new BattleController();
    const before = controller.getState().weather;
    const fire = controller.fire({
      playerId: "left",
      angleDeg: 10,
      power: 20,
      projectileType: "stone",
    });

    expect(fire.ok).toBe(true);
    if (!fire.ok) {
      return;
    }

    controller.resolveShot(fire.shot);
    const after = controller.startNextTurn().state.weather;

    expect(after.id).toBe(before.id);
    expect(after.rngState).not.toBe(before.rngState);
  });

  it("makes superheat burning stronger", () => {
    const hit = resolveProjectileShot(
      stateWithWeather("superheat"),
      directShot("fire"),
    );
    const tick = resolveEndOfTurnEffects(hit.state, "right");

    expect(hit.state.players.right.effects.burningTurnsRemaining).toBe(2);
    expect(tick.state.players.right.health).toBe(91);
  });

  it("limits rain burning to one turn", () => {
    const hit = resolveProjectileShot(
      stateWithWeather("rain"),
      directShot("fire"),
    );

    expect(hit.state.players.right.effects.burningTurnsRemaining).toBe(1);
  });

  it("makes snow freeze last two affected turns", () => {
    const hit = resolveProjectileShot(
      stateWithWeather("snow"),
      directShot("ice"),
    );

    expect(hit.state.players.right.effects.frozenTurnsRemaining).toBe(2);
  });

  it("reduces every snow launch speed by eight percent", () => {
    const normal = calculateLaunchVelocity("left", 45, 100, "stone");
    const snow = calculateLaunchVelocity(
      "left",
      45,
      100,
      "stone",
      GAME_CONFIG.weather.snow.launchSpeedMultiplier,
    );

    expect(Math.hypot(snow.x, snow.y)).toBeCloseTo(
      Math.hypot(normal.x, normal.y) * 0.92,
      10,
    );
  });

  it("shortens only the sandstorm trajectory preview", () => {
    expect(GAME_CONFIG.weather.sandstorm.previewRatio).toBe(0.1);
    expect(GAME_CONFIG.weather.rain.previewRatio).toBe(0.25);
  });
});
