import type { TerrainPoint } from "../arena/arenaCatalog";

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

export interface SweepPoint {
  x: number;
  y: number;
}

export interface SweptCollision {
  time: number;
  centerX: number;
  centerY: number;
  contactX: number;
  contactY: number;
  normalX: number;
  normalY: number;
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

  if (!firstPoint || !lastPoint) {
    return false;
  }

  for (let index = 1; index < terrain.length; index += 1) {
    const leftPoint = terrain[index - 1];
    const rightPoint = terrain[index];

    if (!leftPoint || !rightPoint) {
      continue;
    }

    const minimumSegmentX = Math.min(leftPoint.x, rightPoint.x);
    const maximumSegmentX = Math.max(leftPoint.x, rightPoint.x);

    if (maximumSegmentX < circle.x - circle.radius) {
      continue;
    }

    if (minimumSegmentX > circle.x + circle.radius) {
      break;
    }

    const segmentX = rightPoint.x - leftPoint.x;
    const segmentY = rightPoint.y - leftPoint.y;
    const segmentLengthSquared =
      segmentX * segmentX + segmentY * segmentY;
    const projection =
      segmentLengthSquared === 0
        ? 0
        : clamp(
            ((circle.x - leftPoint.x) * segmentX +
              (circle.y - leftPoint.y) * segmentY) /
              segmentLengthSquared,
            0,
            1,
          );
    const closestX = leftPoint.x + segmentX * projection;
    const closestY = leftPoint.y + segmentY * projection;
    const distanceX = circle.x - closestX;
    const distanceY = circle.y - closestY;

    if (
      distanceX * distanceX + distanceY * distanceY <=
      circle.radius * circle.radius
    ) {
      return true;
    }

    if (
      segmentX !== 0 &&
      circle.x >= minimumSegmentX &&
      circle.x <= maximumSegmentX
    ) {
      const progress = (circle.x - leftPoint.x) / segmentX;
      const terrainY = leftPoint.y + segmentY * progress;

      if (circle.y + circle.radius >= terrainY) {
        return true;
      }
    }
  }

  return false;
}

function addCandidate(
  candidates: SweptCollision[],
  start: SweepPoint,
  end: SweepPoint,
  rectangle: Rectangle,
  radius: number,
  time: number,
): void {
  if (time < 0 || time > 1 || !Number.isFinite(time)) {
    return;
  }

  const centerX = start.x + (end.x - start.x) * time;
  const centerY = start.y + (end.y - start.y) * time;
  const closestX = clamp(
    centerX,
    rectangle.x,
    rectangle.x + rectangle.width,
  );
  const closestY = clamp(
    centerY,
    rectangle.y,
    rectangle.y + rectangle.height,
  );
  const offsetX = centerX - closestX;
  const offsetY = centerY - closestY;
  const distance = Math.hypot(offsetX, offsetY);

  if (distance > radius + 1e-6) {
    return;
  }

  if (distance > 1e-6) {
    candidates.push({
      time,
      centerX,
      centerY,
      contactX: closestX,
      contactY: closestY,
      normalX: offsetX / distance,
      normalY: offsetY / distance,
    });
    return;
  }

  const faces = [
    {
      distance: Math.abs(centerX - rectangle.x),
      contactX: rectangle.x,
      contactY: centerY,
      normalX: -1,
      normalY: 0,
    },
    {
      distance: Math.abs(centerX - (rectangle.x + rectangle.width)),
      contactX: rectangle.x + rectangle.width,
      contactY: centerY,
      normalX: 1,
      normalY: 0,
    },
    {
      distance: Math.abs(centerY - rectangle.y),
      contactX: centerX,
      contactY: rectangle.y,
      normalX: 0,
      normalY: -1,
    },
    {
      distance: Math.abs(centerY - (rectangle.y + rectangle.height)),
      contactX: centerX,
      contactY: rectangle.y + rectangle.height,
      normalX: 0,
      normalY: 1,
    },
  ];
  const nearestFace = faces.reduce((nearest, face) =>
    face.distance < nearest.distance ? face : nearest,
  );

  candidates.push({
    time,
    centerX,
    centerY,
    contactX: nearestFace.contactX,
    contactY: nearestFace.contactY,
    normalX: nearestFace.normalX,
    normalY: nearestFace.normalY,
  });
}

export function sweepCircleAgainstRectangle(
  start: SweepPoint,
  end: SweepPoint,
  radius: number,
  rectangle: Rectangle,
): SweptCollision | null {
  if (
    Math.max(start.x, end.x) < rectangle.x - radius ||
    Math.min(start.x, end.x) > rectangle.x + rectangle.width + radius ||
    Math.max(start.y, end.y) < rectangle.y - radius ||
    Math.min(start.y, end.y) > rectangle.y + rectangle.height + radius
  ) {
    return null;
  }

  const candidates: SweptCollision[] = [];
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;

  if (
    circleIntersectsRectangle(
      { x: start.x, y: start.y, radius },
      rectangle,
    )
  ) {
    addCandidate(candidates, start, end, rectangle, radius, 0);
  }

  if (deltaX !== 0) {
    addCandidate(
      candidates,
      start,
      end,
      rectangle,
      radius,
      (rectangle.x - radius - start.x) / deltaX,
    );
    addCandidate(
      candidates,
      start,
      end,
      rectangle,
      radius,
      (rectangle.x + rectangle.width + radius - start.x) / deltaX,
    );
  }

  if (deltaY !== 0) {
    addCandidate(
      candidates,
      start,
      end,
      rectangle,
      radius,
      (rectangle.y - radius - start.y) / deltaY,
    );
    addCandidate(
      candidates,
      start,
      end,
      rectangle,
      radius,
      (rectangle.y + rectangle.height + radius - start.y) / deltaY,
    );
  }

  const corners = [
    { x: rectangle.x, y: rectangle.y },
    { x: rectangle.x + rectangle.width, y: rectangle.y },
    { x: rectangle.x, y: rectangle.y + rectangle.height },
    {
      x: rectangle.x + rectangle.width,
      y: rectangle.y + rectangle.height,
    },
  ];
  const movementSquared = deltaX * deltaX + deltaY * deltaY;

  if (movementSquared > 0) {
    corners.forEach((corner) => {
      const fromCornerX = start.x - corner.x;
      const fromCornerY = start.y - corner.y;
      const b = 2 * (fromCornerX * deltaX + fromCornerY * deltaY);
      const c =
        fromCornerX * fromCornerX +
        fromCornerY * fromCornerY -
        radius * radius;
      const discriminant = b * b - 4 * movementSquared * c;

      if (discriminant < 0) {
        return;
      }

      const time =
        (-b - Math.sqrt(discriminant)) / (2 * movementSquared);
      addCandidate(
        candidates,
        start,
        end,
        rectangle,
        radius,
        time,
      );
    });
  }

  return candidates.reduce<SweptCollision | null>(
    (earliest, candidate) =>
      !earliest || candidate.time < earliest.time ? candidate : earliest,
    null,
  );
}

export function sweepCircleAgainstTerrain(
  start: SweepPoint,
  end: SweepPoint,
  radius: number,
  terrain: readonly TerrainPoint[],
): SweptCollision | null {
  const intersectsAt = (time: number): boolean => {
    const circle = {
      x: start.x + (end.x - start.x) * time,
      y: start.y + (end.y - start.y) * time,
      radius,
    };

    return circleIntersectsTerrain(circle, terrain);
  };

  if (intersectsAt(0)) {
    return {
      time: 0,
      centerX: start.x,
      centerY: start.y,
      contactX: start.x,
      contactY: start.y + radius,
      normalX: 0,
      normalY: -1,
    };
  }

  if (intersectsAt(1)) {
    let lower = 0;
    let upper = 1;
    for (let iteration = 0; iteration < 10; iteration += 1) {
      const middle = (lower + upper) / 2;
      if (intersectsAt(middle)) {
        upper = middle;
      } else {
        lower = middle;
      }
    }

    const centerX = start.x + (end.x - start.x) * upper;
    const centerY = start.y + (end.y - start.y) * upper;
    return {
      time: upper,
      centerX,
      centerY,
      contactX: centerX,
      contactY: centerY + radius,
      normalX: 0,
      normalY: -1,
    };
  }

  return null;
}
