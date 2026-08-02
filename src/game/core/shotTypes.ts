import type { PlayerId } from "./battleTypes";
import type { ProjectileType } from "./projectileCatalog";
import type { TerrainPoint } from "../arena/arenaCatalog";

export interface FireCommand {
  playerId: PlayerId;
  angleDeg: number;
  power: number;
  projectileType: ProjectileType;
}

export interface FlightPoint {
  timeMs: number;
  x: number;
  y: number;
}

export interface ImpactEvent {
  targetId: PlayerId;
  x: number;
  y: number;
  impactSpeed: number;
  damage: number;
}

export type DestructibleTargetKind = "protection" | "obstacle";

export interface ObjectImpactEvent {
  targetKind: DestructibleTargetKind;
  targetId: string;
  x: number;
  y: number;
  impactSpeed: number;
}

export type ShotEndReason =
  | "impact"
  | "ground"
  | "obstacle"
  | "out-of-bounds"
  | "timeout";

export interface ShotResult {
  projectileType: ProjectileType;
  points: FlightPoint[];
  impact: ImpactEvent | null;
  objectImpact?: ObjectImpactEvent | null;
  endReason: ShotEndReason;
}

export type DamageSource = "direct" | "explosion" | "burning";

export interface DamageEvent {
  kind: "damage";
  targetId: PlayerId;
  amount: number;
  source: DamageSource;
  x: number;
  y: number;
}

export interface StatusEvent {
  kind: "status";
  targetId: PlayerId;
  status: "burning" | "frozen";
  action: "applied" | "cleared";
  turnsRemaining: number;
}

export interface DurabilityEvent {
  kind: "durability";
  targetKind: DestructibleTargetKind;
  targetId: string;
  amount: number;
  remaining: number;
  destroyed: boolean;
  x: number;
  y: number;
}

export type BattleEvent = DamageEvent | StatusEvent | DurabilityEvent;

export interface BattleTransition {
  state: import("./battleTypes").BattleState;
  events: BattleEvent[];
}

export interface LaunchVelocity {
  x: number;
  y: number;
}

export interface ShotSimulationEnvironment {
  stepHz: number;
  trajectorySampleHz: number;
  gravity: number;
  maxFlightSeconds: number;
  worldWidth: number;
  worldHeight: number;
  terrain: readonly TerrainPoint[];
  obstacles: readonly ShotCollider[];
  outOfBoundsMargin: number;
  verticalOutOfBoundsMargin: number;
  projectileRadius: number;
  catapultColliderWidth: number;
  catapultColliderHeight: number;
  launchOffsetX: number;
  launchOffsetY: number;
  collisionsEnabled: boolean;
}

export interface ShotCollider {
  id: string;
  targetKind?: DestructibleTargetKind;
  x: number;
  y: number;
  width: number;
  height: number;
}
