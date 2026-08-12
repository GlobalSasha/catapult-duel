import { GAME_CONFIG } from "./core/gameConfig";

export const GAME_WIDTH = GAME_CONFIG.viewport.width;
export const GAME_HEIGHT = GAME_CONFIG.viewport.height;

export const IS_MOBILE_RENDER_TARGET =
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;

export const RENDER_SCALE = IS_MOBILE_RENDER_TARGET ? 1 : 1.6;
export const RENDER_WIDTH = Math.round(GAME_WIDTH * RENDER_SCALE);
export const RENDER_HEIGHT = Math.round(GAME_HEIGHT * RENDER_SCALE);
