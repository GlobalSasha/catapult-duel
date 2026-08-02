import { GAME_CONFIG } from "./gameConfig";

export const PROJECTILE_TYPES = [
  "stone",
  "fire",
  "ice",
  "diamond",
  "bomb",
] as const;

export type ProjectileType = (typeof PROJECTILE_TYPES)[number];

export type AmmunitionCount = number | null;

export type AmmunitionInventory = Record<
  ProjectileType,
  AmmunitionCount
>;

export function isProjectileType(
  value: unknown,
): value is ProjectileType {
  return PROJECTILE_TYPES.some((type) => type === value);
}

export function createInitialAmmunition(): AmmunitionInventory {
  return Object.fromEntries(
    PROJECTILE_TYPES.map((type) => [
      type,
      GAME_CONFIG.projectiles[type].initialAmmo,
    ]),
  ) as AmmunitionInventory;
}
