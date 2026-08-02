export interface Circle {
  x: number;
  y: number;
  radius: number;
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function circleIntersectsRectangle(
  circle: Circle,
  rectangle: Rectangle,
): boolean {
  const closestX = clamp(
    circle.x,
    rectangle.x,
    rectangle.x + rectangle.width,
  );
  const closestY = clamp(
    circle.y,
    rectangle.y,
    rectangle.y + rectangle.height,
  );
  const distanceX = circle.x - closestX;
  const distanceY = circle.y - closestY;

  return (
    distanceX * distanceX + distanceY * distanceY <=
    circle.radius * circle.radius
  );
}

export function circleIntersectsTerrain(
  circle: Circle,
  terrain: readonly TerrainPoint[],
): boolean {
  const firstPoint = terrain[0];
  const lastPoint = terrain.at(-1);

  if (
    !firstPoint ||
    !lastPoint ||
    circle.x < firstPoint.x ||
    circle.x > lastPoint.x
  ) {
    return false;
  }

  for (let index = 1; index < terrain.length; index += 1) {
    const leftPoint = terrain[index - 1];
    const rightPoint = terrain[index];

    if (!leftPoint || !rightPoint || circle.x > rightPoint.x) {
      continue;
    }

    const segmentWidth = rightPoint.x - leftPoint.x;
    const progress =
      segmentWidth === 0
        ? 0
        : (circle.x - leftPoint.x) / segmentWidth;
    const terrainY =
      leftPoint.y + (rightPoint.y - leftPoint.y) * progress;

    return circle.y + circle.radius >= terrainY;
  }

  return false;
}
import type { TerrainPoint } from "../arena/arenaCatalog";
