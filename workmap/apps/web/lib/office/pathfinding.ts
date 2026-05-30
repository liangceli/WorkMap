export type GridPathMap = {
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  blocked: boolean[];
};

export type PathPoint = {
  x: number;
  y: number;
};

type GridNode = {
  x: number;
  y: number;
};

export function findGridPath(map: GridPathMap, start: PathPoint, end: PathPoint): PathPoint[] | null {
  const startNode = toNode(map, start);
  const endNode = nearestWalkableNode(map, toNode(map, end));

  if (!endNode || isBlocked(map, startNode.x, startNode.y)) {
    return null;
  }

  const startKey = key(startNode);
  const endKey = key(endNode);
  const open = new Map<string, GridNode>([[startKey, startNode]]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[startKey, 0]]);
  const fScore = new Map<string, number>([[startKey, heuristic(startNode, endNode)]]);

  while (open.size > 0) {
    const current = lowestScore(open, fScore);
    const currentKey = key(current);

    if (currentKey === endKey) {
      return reconstructPath(map, cameFrom, currentKey);
    }

    open.delete(currentKey);

    for (const neighbor of neighbors(map, current)) {
      const neighborKey = key(neighbor);
      const tentativeScore = (gScore.get(currentKey) ?? Infinity) + 1;

      if (tentativeScore >= (gScore.get(neighborKey) ?? Infinity)) {
        continue;
      }

      cameFrom.set(neighborKey, currentKey);
      gScore.set(neighborKey, tentativeScore);
      fScore.set(neighborKey, tentativeScore + heuristic(neighbor, endNode));
      open.set(neighborKey, neighbor);
    }
  }

  return null;
}

function toNode(map: GridPathMap, point: PathPoint): GridNode {
  return {
    x: clamp(Math.floor(point.x / map.tileWidth), 0, map.width - 1),
    y: clamp(Math.floor(point.y / map.tileHeight), 0, map.height - 1),
  };
}

function nearestWalkableNode(map: GridPathMap, node: GridNode): GridNode | null {
  if (!isBlocked(map, node.x, node.y)) {
    return node;
  }

  for (let radius = 1; radius <= 8; radius += 1) {
    for (let y = node.y - radius; y <= node.y + radius; y += 1) {
      for (let x = node.x - radius; x <= node.x + radius; x += 1) {
        if (!isBlocked(map, x, y)) {
          return { x, y };
        }
      }
    }
  }

  return null;
}

function lowestScore(open: Map<string, GridNode>, scores: Map<string, number>) {
  let best = Array.from(open.values())[0];
  let bestScore = scores.get(key(best)) ?? Infinity;

  for (const node of open.values()) {
    const score = scores.get(key(node)) ?? Infinity;
    if (score < bestScore) {
      best = node;
      bestScore = score;
    }
  }

  return best;
}

function neighbors(map: GridPathMap, node: GridNode): GridNode[] {
  return [
    { x: node.x + 1, y: node.y },
    { x: node.x - 1, y: node.y },
    { x: node.x, y: node.y + 1 },
    { x: node.x, y: node.y - 1 },
  ].filter((candidate) => !isBlocked(map, candidate.x, candidate.y));
}

function reconstructPath(map: GridPathMap, cameFrom: Map<string, string>, currentKey: string) {
  const pathKeys = [currentKey];
  let keyCursor = currentKey;

  while (cameFrom.has(keyCursor)) {
    keyCursor = cameFrom.get(keyCursor) ?? keyCursor;
    pathKeys.unshift(keyCursor);
  }

  return pathKeys.slice(1).map((pathKey) => {
    const [x, y] = pathKey.split(":").map(Number);
    return {
      x: x * map.tileWidth + map.tileWidth / 2,
      y: y * map.tileHeight + map.tileHeight / 2,
    };
  });
}

function isBlocked(map: GridPathMap, x: number, y: number) {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
    return true;
  }

  return map.blocked[y * map.width + x];
}

function heuristic(left: GridNode, right: GridNode) {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function key(node: GridNode) {
  return `${node.x}:${node.y}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
