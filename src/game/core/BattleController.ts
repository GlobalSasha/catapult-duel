import type { BattleState, PlayerId } from "./battleTypes";
import { createInitialBattleState } from "./createInitialBattleState";
import { GAME_CONFIG } from "./gameConfig";
import {
  getPlayerMaximumPower,
  resolveEndOfTurnEffects,
  resolveProjectileShot,
} from "./projectileEffects";
import {
  isProjectileType,
  type ProjectileType,
} from "./projectileCatalog";
import { simulateShot } from "./simulateShot";
import type {
  BattleTransition,
  FireCommand,
  ShotResult,
} from "./shotTypes";
import { advanceWeather } from "./weather";
import { cloneMatchPlacement } from "./placement";

export type FireErrorReason =
  | "wrong-phase"
  | "not-active-player"
  | "invalid-angle"
  | "invalid-power"
  | "power-restricted"
  | "invalid-projectile"
  | "projectile-not-selected"
  | "out-of-ammo"
  | "match-finished";

export type SelectProjectileErrorReason =
  | "wrong-phase"
  | "not-active-player"
  | "invalid-projectile"
  | "out-of-ammo"
  | "match-finished";

export type FireResult =
  | {
      ok: true;
      shot: ShotResult;
    }
  | {
      ok: false;
      reason: FireErrorReason;
    };

export type SelectProjectileResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      reason: SelectProjectileErrorReason;
    };

function cloneBattleState(state: BattleState): BattleState {
  return {
    ...state,
    placement: cloneMatchPlacement(state.placement),
    weather: { ...state.weather },
    protections: state.protections.map((protection) => ({
      ...protection,
    })),
    obstacles: Object.fromEntries(
      Object.entries(state.obstacles).map(([id, obstacle]) => [
        id,
        { ...obstacle },
      ]),
    ),
    players: {
      left: {
        ...state.players.left,
        ammunition: { ...state.players.left.ammunition },
        effects: { ...state.players.left.effects },
      },
      right: {
        ...state.players.right,
        ammunition: { ...state.players.right.ammunition },
        effects: { ...state.players.right.effects },
      },
    },
  };
}

function getNextPlayerId(playerId: PlayerId): PlayerId {
  return playerId === "left" ? "right" : "left";
}

function isWithinRange(
  value: number,
  minimum: number,
  maximum: number,
): boolean {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

export class BattleController {
  private state: BattleState;

  constructor(initialState: BattleState = createInitialBattleState()) {
    this.state = cloneBattleState(initialState);
  }

  getState(): BattleState {
    return cloneBattleState(this.state);
  }

  fire(command: FireCommand): FireResult {
    const errorReason = this.validateFireCommand(command);

    if (errorReason) {
      return {
        ok: false,
        reason: errorReason,
      };
    }

    const shot = simulateShot(command, this.state);
    const activePlayer = this.state.players[command.playerId];
    const remainingAmmo =
      activePlayer.ammunition[command.projectileType];
    const nextAmmunition = {
      ...activePlayer.ammunition,
      [command.projectileType]:
        remainingAmmo === null
          ? null
          : Math.max(0, remainingAmmo - 1),
    };

    this.state = {
      ...this.state,
      phase: "projectile-flight",
      players: {
        ...this.state.players,
        [command.playerId]: {
          ...activePlayer,
          ammunition: nextAmmunition,
        },
      },
    };

    return {
      ok: true,
      shot,
    };
  }

  selectProjectile(
    playerId: PlayerId,
    projectileType: ProjectileType,
  ): SelectProjectileResult {
    if (this.state.phase === "finished") {
      return { ok: false, reason: "match-finished" };
    }

    if (this.state.phase !== "aiming") {
      return { ok: false, reason: "wrong-phase" };
    }

    if (playerId !== this.state.activePlayerId) {
      return { ok: false, reason: "not-active-player" };
    }

    if (!isProjectileType(projectileType)) {
      return { ok: false, reason: "invalid-projectile" };
    }

    const player = this.state.players[playerId];

    if (player.ammunition[projectileType] === 0) {
      return { ok: false, reason: "out-of-ammo" };
    }

    this.state = {
      ...this.state,
      players: {
        ...this.state.players,
        [playerId]: {
          ...player,
          selectedProjectileType: projectileType,
        },
      },
    };

    return { ok: true };
  }

  resolveShot(shot: ShotResult): BattleTransition {
    if (this.state.phase !== "projectile-flight") {
      throw new Error(
        `Cannot resolve a shot during the "${this.state.phase}" phase.`,
      );
    }

    const transition = resolveProjectileShot(this.state, shot);
    const defeatedPlayer = (["left", "right"] as const).find(
      (playerId) => transition.state.players[playerId].health === 0,
    );

    this.state = defeatedPlayer
      ? {
          ...transition.state,
          phase: "finished",
          winnerId: getNextPlayerId(defeatedPlayer),
        }
      : {
          ...transition.state,
          phase: "resolving",
        };

    return {
      state: this.getState(),
      events: transition.events,
    };
  }

  startNextTurn(): BattleTransition {
    if (this.state.phase !== "resolving") {
      throw new Error(
        `Cannot start the next turn during the "${this.state.phase}" phase.`,
      );
    }

    const outgoingPlayerId = this.state.activePlayerId;
    const nextPlayerId = getNextPlayerId(outgoingPlayerId);
    const transition = resolveEndOfTurnEffects(
      this.state,
      outgoingPlayerId,
    );

    this.state =
      transition.state.players[outgoingPlayerId].health === 0
        ? {
            ...transition.state,
            phase: "finished",
            winnerId: nextPlayerId,
          }
        : {
            ...transition.state,
            phase: "aiming",
            activePlayerId: nextPlayerId,
            turnNumber: this.state.turnNumber + 1,
            weather: advanceWeather(transition.state.weather),
          };

    return {
      state: this.getState(),
      events: transition.events,
    };
  }

  private validateFireCommand(
    command: FireCommand,
  ): FireErrorReason | null {
    if (this.state.phase === "finished") {
      return "match-finished";
    }

    if (this.state.phase !== "aiming") {
      return "wrong-phase";
    }

    if (command.playerId !== this.state.activePlayerId) {
      return "not-active-player";
    }

    if (
      !isWithinRange(
        command.angleDeg,
        GAME_CONFIG.aiming.minAngleDeg,
        GAME_CONFIG.aiming.maxAngleDeg,
      )
    ) {
      return "invalid-angle";
    }

    if (
      !isWithinRange(
        command.power,
        GAME_CONFIG.aiming.minPower,
        GAME_CONFIG.aiming.maxPower,
      )
    ) {
      return "invalid-power";
    }

    if (!isProjectileType(command.projectileType)) {
      return "invalid-projectile";
    }

    const player = this.state.players[command.playerId];

    if (command.power > getPlayerMaximumPower(player)) {
      return "power-restricted";
    }

    if (command.projectileType !== player.selectedProjectileType) {
      return "projectile-not-selected";
    }

    if (player.ammunition[command.projectileType] === 0) {
      return "out-of-ammo";
    }

    return null;
  }
}
