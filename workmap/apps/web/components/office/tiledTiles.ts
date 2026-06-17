export type TiledTileFlags = {
  flippedHorizontally: boolean;
  flippedVertically: boolean;
  flippedDiagonally: boolean;
};

const TILED_FLIPPED_HORIZONTALLY_FLAG = 0x80000000;
const TILED_FLIPPED_VERTICALLY_FLAG = 0x40000000;
const TILED_FLIPPED_DIAGONALLY_FLAG = 0x20000000;
// Clear Tiled's four high GID flags, including the hexagonal rotation bit that can remain after orientation changes.
const TILED_TILE_ID_MASK = 0x0fffffff;

export function getTiledTileGid(rawGid: number) {
  return {
    gid: rawGid & TILED_TILE_ID_MASK,
    flags: {
      flippedHorizontally: (rawGid & TILED_FLIPPED_HORIZONTALLY_FLAG) !== 0,
      flippedVertically: (rawGid & TILED_FLIPPED_VERTICALLY_FLAG) !== 0,
      flippedDiagonally: (rawGid & TILED_FLIPPED_DIAGONALLY_FLAG) !== 0,
    },
  };
}

export function drawTiledTile(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number,
  targetX: number,
  targetY: number,
  targetWidth: number,
  targetHeight: number,
  flags: TiledTileFlags,
) {
  if (!flags.flippedHorizontally && !flags.flippedVertically && !flags.flippedDiagonally) {
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      targetX,
      targetY,
      targetWidth,
      targetHeight,
    );
    return;
  }

  const scaleX = flags.flippedHorizontally ? -1 : 1;
  const scaleY = flags.flippedVertically ? -1 : 1;

  context.save();
  context.translate(targetX + targetWidth / 2, targetY + targetHeight / 2);
  if (flags.flippedDiagonally) {
    context.transform(0, scaleY, scaleX, 0, 0, 0);
  } else {
    context.scale(scaleX, scaleY);
  }
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    -targetWidth / 2,
    -targetHeight / 2,
    targetWidth,
    targetHeight,
  );
  context.restore();
}
