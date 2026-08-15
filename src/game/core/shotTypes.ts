import type { PlayerId } from "./battleTypes";
import type { ProjectileType } from "./projectileCatalog";
import type { TerrainPoint } from "../arena/arenaCatalog";

export interface FireCommand {
  playerId: PlayerId;
  angleDeg: number;
  power: number;
  projectileType: ProjectileType;
  launchPoint?: {
    x: number;
    y: number;
  };
}

export interface FlightPoint {
  timeMs: number;
  x: number;
  y: number;
}

export type CatapultHitZone = "arm" | "frame" | "wheels";

export interface ImpactKinematics {
  velocityX?: number;
  velocityY?: number;
  normalImpactRatio?: number;
}

export interface ImpactEvent extends ImpactKinematics {
  targetId: PlayerId;
  x: number;
  y: number;
  impactSpeed: number;
  damage: number;
  hitZone?: CatapultHitZone;
}

export type DestructibleTargetKind = "protection" | "obstacle";

export interface ObjectImpactEvent extends ImpactKinematics {
  targetKind: DestructibleTargetKind;
  targetId: string;
  x: number;
  y: number;
  impactSpeed: number;
}

export interface KnightImpactEvent extends ImpactKinematics {
  targetId: PlayerId;
  x: number;
  y: number;
  impactSpeed: number;
  damage: number;
}

export type ShotEndReason =
  | "impact"
  | "knight-impact"
  | "ground"
  | "obstacle"
  | "out-of-bounds"
  | "timeout";

export interface ShotResult {
  projectileType: ProjectileType;
  points: FlightPoint[];
  impact: ImpactEvent | null;
  knightImpact?: KnightImpactEvent | null;
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

export type MaterialReaction =
  | "splinter"
  | "tear"
  | "spark"
  | "crack"
  | "scorch"
  | "frost"
  | "dust";

export interface MaterialReactionEvent {
  kind: "material-reaction";
  reaction: MaterialReaction;
  projectileType: ProjectileType;
  targetKind?: DestructibleTargetKind | "catapult";
  targetId?: string;
  x: number;
  y: number;
  intensity: number;
}

export interface DisplacementEvent {
  kind: "displacement";
  targetId: PlayerId;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  distance: number;
}

export interface RepairEvent {
  kind: "repair";
  targetId: PlayerId;
  amount: number;
  health: number;
  maximumHealth: number;
}

export interface KnightDamageEvent {
  kind: "knight-damage";
  targetId: PlayerId;
  amount: number;
  health: number;
  source: "direct" | "explosion";
  x: number;
  y: number;
}

export interface KnightMoveEvent {
  kind: "knight-move";
  targetId: PlayerId;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number;
}

export type BattleEvent =
  | DamageEvent
  | StatusEvent
  | DurabilityEvent
  | MaterialReactionEvent
  | DisplacementEvent
  | RepairEvent
  | KnightDamageEvent
  | KnightMoveEvent;

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
