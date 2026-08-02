import type { ArenaId } from "../arena/arenaCatalog";
import type {
  AmmunitionInventory,
  ProjectileType,
} from "./projectileCatalog";
import type { WeatherState } from "./weather";
import type {
  ArenaObstacleState,
  ProtectionState,
} from "./protection";
import type { MatchPlacement } from "./placement";

export type PlayerId = "left" | "right";

export type BattlePhase =
  | "aiming"
  | "projectile-flight"
  | "resolving"
  | "finished";

export interface PlayerStatusEffects {
  burningTurnsRemaining: number;
  frozenTurnsRemaining: number;
}

export interface PlayerState {
  id: PlayerId;
  health: number;
  catapultX: number;
  catapultY: number;
  ammunition: AmmunitionInventory;
  selectedProjectileType: ProjectileType;
  effects: PlayerStatusEffects;
}

export interface BattleState {
  arenaId: ArenaId;
  matchSeed: number;
  placement: MatchPlacement;
  weather: WeatherState;
  phase: BattlePhase;
  activePlayerId: PlayerId;
  turnNumber: number;
  players: Record<PlayerId, PlayerState>;
  protections: ProtectionState[];
  obstacles: Record<string, ArenaObstacleState>;
  winnerId: PlayerId | null;
}
