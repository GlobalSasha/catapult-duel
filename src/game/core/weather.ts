import { GAME_CONFIG } from "./gameConfig";

export const WEATHER_IDS = [
  "superheat",
  "rain",
  "snow",
  "sandstorm",
] as const;

export type WeatherId = (typeof WEATHER_IDS)[number];

export interface WeatherState {
  id: WeatherId;
  wind: number;
  rngState: number;
}

const UINT32_RANGE = 0x1_0000_0000;
const NON_ZERO_SEED = 0x6d2b_79f5;
const WIND_STEP = 5;

function nextRandom(rngState: number): {
  rngState: number;
  value: number;
} {
  let nextState = (rngState >>> 0) || NON_ZERO_SEED;

  nextState ^= nextState << 13;
  nextState ^= nextState >>> 17;
  nextState ^= nextState << 5;
  nextState >>>= 0;

  return {
    rngState: nextState,
    value: nextState / UINT32_RANGE,
  };
}

export function getWeatherDefinition(weatherId: WeatherId) {
  return GAME_CONFIG.weather[weatherId];
}

function rollWind(
  weatherId: WeatherId,
  rngState: number,
): Pick<WeatherState, "wind" | "rngState"> {
  const random = nextRandom(rngState);
  const definition = getWeatherDefinition(weatherId);
  const wind =
    definition.windMinimum +
    random.value *
      (definition.windMaximum - definition.windMinimum);
  const roundedWind = Math.round(wind / WIND_STEP) * WIND_STEP;

  return {
    rngState: random.rngState,
    wind: Object.is(roundedWind, -0) ? 0 : roundedWind,
  };
}

export function createWeatherState(matchSeed: number): WeatherState {
  const weatherRoll = nextRandom(matchSeed);
  const weatherIndex = Math.min(
    WEATHER_IDS.length - 1,
    Math.floor(weatherRoll.value * WEATHER_IDS.length),
  );
  const id = WEATHER_IDS[weatherIndex] ?? WEATHER_IDS[0];
  const windRoll = rollWind(id, weatherRoll.rngState);

  return {
    id,
    ...windRoll,
  };
}

export function advanceWeather(weather: WeatherState): WeatherState {
  return {
    id: weather.id,
    ...rollWind(weather.id, weather.rngState),
  };
}
