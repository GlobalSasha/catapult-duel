import { describe, expect, it } from "vitest";

import { ARENAS, getTerrainHeightAt } from "../src/game/arena/arenaCatalog";
import { circleIntersectsRectangle } from "../src/game/core/collision";
import { createInitialBattleState } from "../src/game/core/createInitialBattleState";
import { GAME_CONFIG } from "../src/game/core/gameConfig";
import {
  getCatapultSlotX,
  getProtectionSlotCenterX,
} from "../src/game/core/placement";
import { getProtectionDefinition } from "../src/game/core/protection";
import { createShotEnvironment } from "../src/game/core/simulateShot";

function rectanglesOverlap(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

describe("arena collision schemes", () => {
  it("uses several authored colliders for every arena obstacle", () => {
    ARENAS.forEach((arena) => {
      const environment = createShotEnvironment(
        arena.id,
        "stone",
        createInitialBattleState(arena.id),
      );

      arena.obstacles.forEach((obstacle) => {
        const colliders = environment.obstacles.filter(
          ({ id }) => id === obstacle.id,
        );

        expect(colliders).toHaveLength(obstacle.collisionParts.length);
        expect(colliders.length).toBeGreaterThanOrEqual(3);
        colliders.forEach((collider) => {
          expect(collider.width).toBeGreaterThan(0);
          expect(collider.height).toBeGreaterThan(0);
        });
      });
    });
  });

  it("does not collide with the empty upper corners of rock silhouettes", () => {
    ARENAS.forEach((arena) => {
      const environment = createShotEnvironment(arena.id);

      arena.obstacles
        .filter(({ kind }) => kind === "rock")
        .forEach((rock) => {
          const colliders = environment.obstacles.filter(
            ({ id }) => id === rock.id,
          );
          const emptyCorner = {
            x: rock.x + 4,
            y: rock.y + 4,
            radius: 3,
          };
          const solidCenter = {
            x: rock.x + rock.width / 2,
            y: rock.y + 8,
            radius: 3,
          };

          expect(
            colliders.some((part) =>
              circleIntersectsRectangle(emptyCorner, part),
            ),
          ).toBe(false);
          expect(
            colliders.some((part) =>
              circleIntersectsRectangle(solidCenter, part),
            ),
          ).toBe(true);
        });
    });
  });

  it("keeps every catapult and protection slot on a flat safe plateau", () => {
    ARENAS.forEach((arena) => {
      (["left", "right"] as const).forEach((playerId) => {
        GAME_CONFIG.placement.catapultSlots[playerId].forEach(
          (_, slotIndex) => {
            const centerX = getCatapultSlotX(playerId, slotIndex);
            const halfWidth = GAME_CONFIG.catapult.colliderWidth / 2;
            const centerHeight = getTerrainHeightAt(arena.terrain, centerX);

            expect(
              getTerrainHeightAt(arena.terrain, centerX - halfWidth),
            ).toBe(centerHeight);
            expect(
              getTerrainHeightAt(arena.terrain, centerX + halfWidth),
            ).toBe(centerHeight);
          },
        );

        GAME_CONFIG.placement.protectionSlotCenters[playerId].forEach(
          (_, slotIndex) => {
            const centerX = getProtectionSlotCenterX(playerId, slotIndex);

            (["castle"] as const).forEach((type) => {
              const definition = getProtectionDefinition(type);
              const halfWidth = definition.width / 2;
              const centerHeight = getTerrainHeightAt(arena.terrain, centerX);

              expect(
                getTerrainHeightAt(arena.terrain, centerX - halfWidth),
              ).toBe(centerHeight);
              expect(
                getTerrainHeightAt(arena.terrain, centerX + halfWidth),
              ).toBe(centerHeight);
            });
          },
        );

      });
    });
  });

  it("keeps authored obstacle colliders outside both placement zones", () => {
    ARENAS.forEach((arena) => {
      const state = createInitialBattleState(arena.id);
      const obstacleColliders = createShotEnvironment(
        arena.id,
        "stone",
        state,
      ).obstacles.filter(({ targetKind }) => targetKind === "obstacle");

      (["left", "right"] as const).forEach((playerId) => {
        GAME_CONFIG.placement.catapultSlots[playerId].forEach((centerX) => {
          const catapult = {
            x: centerX - GAME_CONFIG.catapult.colliderWidth / 2,
            y:
              getTerrainHeightAt(arena.terrain, centerX) -
              GAME_CONFIG.catapult.colliderHeight,
            width: GAME_CONFIG.catapult.colliderWidth,
            height: GAME_CONFIG.catapult.colliderHeight,
          };

          expect(
            obstacleColliders.some((obstacle) =>
              rectanglesOverlap(catapult, obstacle),
            ),
          ).toBe(false);
        });

        GAME_CONFIG.placement.protectionSlotCenters[playerId].forEach(
          (centerX) => {
            (["castle"] as const).forEach((type) => {
              const definition = getProtectionDefinition(type);
              const protection = {
                x: centerX - definition.width / 2,
                y:
                  getTerrainHeightAt(arena.terrain, centerX) -
                  definition.height,
                width: definition.width,
                height: definition.height,
              };

              expect(
                obstacleColliders.some((obstacle) =>
                  rectanglesOverlap(protection, obstacle),
                ),
              ).toBe(false);
            });
          },
        );
      });
    });
  });
});
