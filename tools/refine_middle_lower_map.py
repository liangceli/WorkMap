from __future__ import annotations

import math
import re
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
TMX_PATH = ROOT / "workmap2_big_outdoor.tmx"
TILESET_DIR = ROOT / "workmap" / "apps" / "web" / "public" / "maps" / "tilesets"
SOURCE_TILESET = TILESET_DIR / "complete_tileset_32x32.png"
CUSTOM_TILESET_IMAGE = TILESET_DIR / "clean_dirt_path_32x32.png"
CUSTOM_TILESET_TSX = TILESET_DIR / "clean_dirt_path_32x32.tsx"
CUSTOM_TILESET_SOURCE = "workmap/apps/web/public/maps/tilesets/clean_dirt_path_32x32.tsx"
PATCH_TILESET_IMAGE = TILESET_DIR / "middle_lower_ground_patch_32x32.png"
PATCH_TILESET_TSX = TILESET_DIR / "middle_lower_ground_patch_32x32.tsx"
PATCH_TILESET_SOURCE = "workmap/apps/web/public/maps/tilesets/middle_lower_ground_patch_32x32.tsx"
PREVIEW_DIR = ROOT / ".codex_previews"

COMPLETE_FIRSTGID = 4065
COMPLETE_COLUMNS = 32
TILE = 32
MAP_W = 100
MAP_H = 80


def gid(col: int, row: int) -> int:
    return COMPLETE_FIRSTGID + row * COMPLETE_COLUMNS + col


GRASS_VARIANTS = [gid(3, 3), gid(11, 3), gid(3, 11), gid(11, 11)]
OLD_DIRT_GIDS = {
    gid(9, 2),
    gid(4, 3),
}
SAND_BASE_GID = gid(11, 7)
PATCH_COLUMNS = 49
LEFT_PATCH_W = 25
LEFT_PATCH_H = 42
RIGHT_PATCH_W = 24
RIGHT_PATCH_H = 41
PATCH_H = 42


def read_layer(root: ET.Element, name: str) -> list[int]:
    data = root.find(f"./layer[@name='{name}']/data")
    if data is None or data.text is None:
        raise RuntimeError(f"Missing layer data: {name}")
    values = [int(x) for x in re.split(r"[,\s]+", data.text.strip()) if x]
    if len(values) != MAP_W * MAP_H:
        raise RuntimeError(f"Layer {name} has {len(values)} tiles, expected {MAP_W * MAP_H}")
    return values


def write_layer(root: ET.Element, name: str, values: list[int]) -> None:
    if len(values) != MAP_W * MAP_H:
        raise RuntimeError(f"Layer {name} has {len(values)} tiles, expected {MAP_W * MAP_H}")
    data = root.find(f"./layer[@name='{name}']/data")
    if data is None:
        raise RuntimeError(f"Missing layer data: {name}")
    rows = []
    for y in range(MAP_H):
        row = values[y * MAP_W : (y + 1) * MAP_W]
        rows.append(",".join(str(v) for v in row))
    data.text = "\n" + ",\n".join(rows) + "\n"


def idx(x: int, y: int) -> int:
    return y * MAP_W + x


def deterministic_noise(x: int, y: int) -> float:
    v = math.sin(x * 12.9898 + y * 78.233) * 43758.5453
    return v - math.floor(v)


def tile_crop(sheet: Image.Image, col: int, row: int) -> Image.Image:
    return sheet.crop((col * TILE, row * TILE, (col + 1) * TILE, (row + 1) * TILE)).convert("RGBA")


def make_clean_path_tileset() -> None:
    sheet = Image.open(SOURCE_TILESET).convert("RGBA")
    grass = tile_crop(sheet, 0, 5)
    dirt = tile_crop(sheet, 4, 3)

    atlas = Image.new("RGBA", (4 * TILE, 4 * TILE), (0, 0, 0, 0))
    top = [8 + ((i * 7 + 3) % 5) - 2 for i in range(TILE)]
    bottom = [23 + ((i * 5 + 1) % 5) - 2 for i in range(TILE)]
    left = [8 + ((i * 3 + 4) % 5) - 2 for i in range(TILE)]
    right = [23 + ((i * 11 + 2) % 5) - 2 for i in range(TILE)]

    for mask in range(16):
        out = Image.new("RGBA", (TILE, TILE))
        pix = out.load()
        gp = grass.load()
        dp = dirt.load()
        for y in range(TILE):
            for x in range(TILE):
                is_dirt = True
                if mask & 1 and y < top[x]:
                    is_dirt = False
                if mask & 2 and x > right[y]:
                    is_dirt = False
                if mask & 4 and y > bottom[x]:
                    is_dirt = False
                if mask & 8 and x < left[y]:
                    is_dirt = False
                pix[x, y] = dp[x, y] if is_dirt else gp[x, y]

        # Add a restrained grass fringe only outside the path, so the road body stays clean.
        pixels = out.load()
        for y in range(1, TILE - 1):
            for x in range(1, TILE - 1):
                here = pixels[x, y]
                if here == gp[x, y]:
                    neighbors = [
                        pixels[x + 1, y],
                        pixels[x - 1, y],
                        pixels[x, y + 1],
                        pixels[x, y - 1],
                    ]
                    if any(n != gp[x, y] for n in neighbors) and deterministic_noise(x + mask * 17, y) > 0.62:
                        r, g, b, a = here
                        pixels[x, y] = (max(0, r - 24), min(255, g + 10), max(0, b - 18), a)

        atlas.paste(out, ((mask % 4) * TILE, (mask // 4) * TILE))

    CUSTOM_TILESET_IMAGE.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(CUSTOM_TILESET_IMAGE)
    CUSTOM_TILESET_TSX.write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<tileset version="1.10" tiledversion="1.12.1" name="clean_dirt_path_32x32" '
        'tilewidth="32" tileheight="32" tilecount="16" columns="4">\n'
        ' <image source="clean_dirt_path_32x32.png" width="128" height="128"/>\n'
        "</tileset>\n",
        encoding="utf-8",
    )


def make_mosaic(sheet: Image.Image, width_tiles: int, height_tiles: int, choices: list[tuple[int, int]]) -> Image.Image:
    image = Image.new("RGBA", (width_tiles * TILE, height_tiles * TILE), (0, 0, 0, 0))
    crops = [tile_crop(sheet, col, row) for col, row in choices]
    for y in range(height_tiles):
        for x in range(width_tiles):
            crop = crops[(x * 7 + y * 11 + int(deterministic_noise(x, y) * 10)) % len(crops)]
            image.alpha_composite(crop, (x * TILE, y * TILE))
    return image


def draw_path_mask(
    width_tiles: int,
    height_tiles: int,
    lines: list[tuple[list[tuple[float, float]], float]],
    blobs: list[tuple[float, float, float, float]],
) -> Image.Image:
    scale = 4
    mask = Image.new("L", (width_tiles * TILE * scale, height_tiles * TILE * scale), 0)
    draw = ImageDraw.Draw(mask)
    for points, width_tiles_float in lines:
        pixel_points = [
            (int((x * TILE + TILE / 2) * scale), int((y * TILE + TILE / 2) * scale))
            for x, y in points
        ]
        draw.line(pixel_points, fill=255, width=int(width_tiles_float * TILE * scale), joint="curve")
        radius = int(width_tiles_float * TILE * scale / 2)
        for px, py in pixel_points:
            draw.ellipse((px - radius, py - radius, px + radius, py + radius), fill=255)
    for cx, cy, rx, ry in blobs:
        px = int((cx * TILE + TILE / 2) * scale)
        py = int((cy * TILE + TILE / 2) * scale)
        rw = int(rx * TILE * scale)
        rh = int(ry * TILE * scale)
        draw.ellipse((px - rw, py - rh, px + rw, py + rh), fill=255)

    # Small edge variation keeps the outline from reading like a hard geometry primitive.
    low = mask.resize((width_tiles * TILE, height_tiles * TILE), Image.Resampling.LANCZOS)
    edge = ImageChops.difference(low.filter(ImageFilter.MaxFilter(7)), low.filter(ImageFilter.MinFilter(7)))
    edge_px = edge.load()
    mask_px = low.load()
    for y in range(low.height):
        for x in range(low.width):
            if edge_px[x, y] > 0:
                n = deterministic_noise(x // 2, y // 2)
                if n > 0.82:
                    mask_px[x, y] = max(0, mask_px[x, y] - 90)
                elif n < 0.12:
                    mask_px[x, y] = min(255, mask_px[x, y] + 55)
    return low.filter(ImageFilter.GaussianBlur(0.45))


def paste_texture_with_mask(base: Image.Image, texture: Image.Image, mask: Image.Image) -> Image.Image:
    composed = Image.composite(texture, base, mask)
    expanded = mask.filter(ImageFilter.MaxFilter(9))
    outside_edge = ImageChops.subtract(expanded, mask)
    inside_edge = ImageChops.subtract(mask, mask.filter(ImageFilter.MinFilter(7)))

    grass_shadow = Image.new("RGBA", base.size, (34, 96, 45, 70))
    dirt_shadow = Image.new("RGBA", base.size, (96, 58, 35, 38))
    composed = Image.composite(grass_shadow, composed, outside_edge.point(lambda p: min(140, p)))
    composed = Image.composite(dirt_shadow, composed, inside_edge.point(lambda p: min(95, p)))
    return composed


def rounded_field_mask(width: int, height: int, box: tuple[int, int, int, int]) -> Image.Image:
    mask = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle(box, radius=18, fill=255)
    edge = mask.filter(ImageFilter.MaxFilter(9))
    px = mask.load()
    for y in range(height):
        for x in range(width):
            if edge.getpixel((x, y)) and deterministic_noise(x + 101, y + 307) > 0.87:
                px[x, y] = 0
    return mask.filter(ImageFilter.GaussianBlur(0.35))


def make_region_patch(
    sheet: Image.Image,
    width_tiles: int,
    height_tiles: int,
    lines: list[tuple[list[tuple[float, float]], float]],
    blobs: list[tuple[float, float, float, float]],
    fields: list[tuple[int, int, int, int]] | None = None,
) -> Image.Image:
    grass = make_mosaic(sheet, width_tiles, height_tiles, [(3, 3), (11, 3), (3, 11), (11, 11)])
    dirt = make_mosaic(sheet, width_tiles, height_tiles, [(4, 3), (5, 3), (1, 2)])
    region = grass

    if fields:
        soil = make_mosaic(sheet, width_tiles, height_tiles, [(0, 14), (1, 14), (0, 15), (1, 15)])
        field_mask = Image.new("L", region.size, 0)
        for x0, y0, x1, y1 in fields:
            box = (x0 * TILE, y0 * TILE, (x1 + 1) * TILE, (y1 + 1) * TILE)
            field_mask = ImageChops.lighter(field_mask, rounded_field_mask(region.width, region.height, box))
        region = paste_texture_with_mask(region, soil, field_mask)

    path_mask = draw_path_mask(width_tiles, height_tiles, lines, blobs)
    return paste_texture_with_mask(region, dirt, path_mask)


def make_ground_patch_tileset() -> None:
    sheet = Image.open(SOURCE_TILESET).convert("RGBA")
    atlas = Image.new("RGBA", (PATCH_COLUMNS * TILE, PATCH_H * TILE), (0, 0, 0, 0))

    left = make_region_patch(
        sheet,
        LEFT_PATCH_W,
        LEFT_PATCH_H,
        [
            ([(8, 41), (8, 34), (11, 28), (15, 23), (20, 19), (24, 17)], 4.7),
            ([(13, 0), (14, 6), (18, 11), (24, 16)], 4.1),
        ],
        [(7.5, 39.5, 2.3, 1.7), (23.0, 17.0, 2.2, 1.7)],
    )
    right = make_region_patch(
        sheet,
        RIGHT_PATCH_W,
        RIGHT_PATCH_H,
        [
            ([(4, 0), (5, 7), (4, 13), (7, 19), (10, 24), (10, 31), (7, 40)], 4.5),
            ([(0, 13), (6, 14), (11, 19), (17, 20), (23, 19)], 4.0),
            ([(10, 24), (15, 26), (21, 31)], 3.7),
        ],
        [(14.0, 24.5, 4.5, 2.6), (6.0, 39.0, 2.0, 1.5)],
        fields=[(2, 1, 8, 11), (17, 4, 22, 10)],
    )

    atlas.alpha_composite(left, (0, 0))
    atlas.alpha_composite(right, (LEFT_PATCH_W * TILE, 0))
    PATCH_TILESET_IMAGE.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(PATCH_TILESET_IMAGE)
    PATCH_TILESET_TSX.write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<tileset version="1.10" tiledversion="1.12.1" name="middle_lower_ground_patch_32x32" '
        f'tilewidth="32" tileheight="32" tilecount="{PATCH_COLUMNS * PATCH_H}" columns="{PATCH_COLUMNS}">\n'
        ' <image source="middle_lower_ground_patch_32x32.png" '
        f'width="{PATCH_COLUMNS * TILE}" height="{PATCH_H * TILE}"/>\n'
        "</tileset>\n",
        encoding="utf-8",
    )


def tsx_tilecount(tmx_tileset: ET.Element) -> int:
    source = tmx_tileset.attrib.get("source")
    if not source:
        return int(tmx_tileset.attrib.get("tilecount", "0"))
    tsx_path = ROOT / source
    tsx_root = ET.parse(tsx_path).getroot()
    return int(tsx_root.attrib["tilecount"])


def ensure_custom_tileset(root: ET.Element) -> int:
    for tileset in root.findall("tileset"):
        if tileset.attrib.get("source") == CUSTOM_TILESET_SOURCE:
            return int(tileset.attrib["firstgid"])

    max_next = 1
    for tileset in root.findall("tileset"):
        firstgid = int(tileset.attrib["firstgid"])
        max_next = max(max_next, firstgid + tsx_tilecount(tileset))

    custom = ET.Element("tileset", {"firstgid": str(max_next), "source": CUSTOM_TILESET_SOURCE})
    tilesets = root.findall("tileset")
    insert_at = list(root).index(tilesets[-1]) + 1
    root.insert(insert_at, custom)
    return max_next


def ensure_tileset(root: ET.Element, source: str) -> int:
    for tileset in root.findall("tileset"):
        if tileset.attrib.get("source") == source:
            return int(tileset.attrib["firstgid"])

    max_next = 1
    for tileset in root.findall("tileset"):
        firstgid = int(tileset.attrib["firstgid"])
        max_next = max(max_next, firstgid + tsx_tilecount(tileset))

    custom = ET.Element("tileset", {"firstgid": str(max_next), "source": source})
    tilesets = root.findall("tileset")
    insert_at = list(root).index(tilesets[-1]) + 1
    root.insert(insert_at, custom)
    return max_next


def point_to_segment_distance(px: float, py: float, ax: float, ay: float, bx: float, by: float) -> float:
    vx = bx - ax
    vy = by - ay
    wx = px - ax
    wy = py - ay
    length_sq = vx * vx + vy * vy
    if length_sq == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, (wx * vx + wy * vy) / length_sq))
    cx = ax + t * vx
    cy = ay + t * vy
    return math.hypot(px - cx, py - cy)


def add_polyline(mask: set[tuple[int, int]], points: list[tuple[float, float]], radius: float, bounds: tuple[int, int, int, int]) -> None:
    x0, x1, y0, y1 = bounds
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            jitter = (deterministic_noise(x, y) - 0.5) * 0.45
            d = min(
                point_to_segment_distance(x + 0.5, y + 0.5, ax, ay, bx, by)
                for (ax, ay), (bx, by) in zip(points, points[1:])
            )
            if d <= radius + jitter:
                mask.add((x, y))


def add_blob(mask: set[tuple[int, int]], cx: float, cy: float, rx: float, ry: float, bounds: tuple[int, int, int, int]) -> None:
    x0, x1, y0, y1 = bounds
    for y in range(max(y0, int(cy - ry - 2)), min(y1, int(cy + ry + 2)) + 1):
        for x in range(max(x0, int(cx - rx - 2)), min(x1, int(cx + rx + 2)) + 1):
            n = (deterministic_noise(x * 3 + 7, y * 5 + 11) - 0.5) * 0.22
            if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1.0 + n:
                mask.add((x, y))


def expanded(mask: set[tuple[int, int]], amount: int) -> set[tuple[int, int]]:
    out: set[tuple[int, int]] = set()
    for x, y in mask:
        for yy in range(y - amount, y + amount + 1):
            for xx in range(x - amount, x + amount + 1):
                if 0 <= xx < MAP_W and 0 <= yy < MAP_H:
                    out.add((xx, yy))
    return out


def draw_path(ground: list[int], water: list[int], path_mask: set[tuple[int, int]], firstgid: int) -> None:
    for x, y in sorted(path_mask):
        if not (0 <= x < MAP_W and 0 <= y < MAP_H):
            continue
        if water[idx(x, y)]:
            continue
        missing = 0
        if (x, y - 1) not in path_mask:
            missing |= 1
        if (x + 1, y) not in path_mask:
            missing |= 2
        if (x, y + 1) not in path_mask:
            missing |= 4
        if (x - 1, y) not in path_mask:
            missing |= 8
        ground[idx(x, y)] = firstgid + missing


def sprite_cells(col: int, row: int, w: int, h: int) -> list[tuple[int, int, int]]:
    cells = []
    for yy in range(h):
        for xx in range(w):
            cells.append((xx, yy, gid(col + xx, row + yy)))
    return cells


def can_place_sprite(
    cells: list[tuple[int, int, int]],
    x: int,
    y: int,
    blocked: set[tuple[int, int]],
    bounds: tuple[int, int, int, int],
) -> bool:
    x0, x1, y0, y1 = bounds
    for dx, dy, tile_gid in cells:
        if tile_gid == 0:
            continue
        tx = x + dx
        ty = y + dy
        if not (x0 <= tx <= x1 and y0 <= ty <= y1):
            return False
        if (tx, ty) in blocked:
            return False
    return True


def place_sprite(layer: list[int], col: int, row: int, w: int, h: int, x: int, y: int) -> None:
    for dy in range(h):
        for dx in range(w):
            tx = x + dx
            ty = y + dy
            if 0 <= tx < MAP_W and 0 <= ty < MAP_H:
                layer[idx(tx, ty)] = gid(col + dx, row + dy)


def clear_sprite_layers(layers: list[list[int]], regions: list[tuple[int, int, int, int]]) -> None:
    for layer in layers:
        for x0, x1, y0, y1 in regions:
            for y in range(y0, y1 + 1):
                for x in range(x0, x1 + 1):
                    layer[idx(x, y)] = 0


def add_decoration(layer: list[int], x: int, y: int, tile_gid: int) -> None:
    if 0 <= x < MAP_W and 0 <= y < MAP_H:
        layer[idx(x, y)] = tile_gid


def refine_map() -> None:
    make_clean_path_tileset()
    make_ground_patch_tileset()
    tree = ET.parse(TMX_PATH)
    root = tree.getroot()
    custom_firstgid = ensure_custom_tileset(root)
    patch_firstgid = ensure_tileset(root, PATCH_TILESET_SOURCE)

    ground = read_layer(root, "Outdoor_Ground")
    water = read_layer(root, "Outdoor_Water")
    path_layer = read_layer(root, "Outdoor_Path")
    forest_back = read_layer(root, "Outdoor_Forest_Back")
    forest_mid = read_layer(root, "Outdoor_Forest_Mid")
    forest_front = read_layer(root, "Outdoor_Forest_Front")
    details = read_layer(root, "Outdoor_Details")

    left_bounds = (0, 24, 22, 63)
    right_bounds = (76, 99, 23, 63)
    regions = [left_bounds, right_bounds]

    # Remove the previous one-tile dirt scatter and any old path-only paint in and below the target areas.
    custom_range = range(custom_firstgid, custom_firstgid + 16)
    patch_range = range(patch_firstgid, patch_firstgid + PATCH_COLUMNS * PATCH_H)
    cleanup_regions = [(0, 24, 22, 66), (76, 99, 23, 66)]
    for x0, x1, y0, y1 in cleanup_regions:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                i = idx(x, y)
                if ground[i] in OLD_DIRT_GIDS or ground[i] in custom_range or ground[i] in patch_range:
                    ground[i] = SAND_BASE_GID if y >= 64 else GRASS_VARIANTS[(x * 3 + y * 5) % len(GRASS_VARIANTS)]
                path_layer[i] = 0

    # Remove isolated inland water leftovers from older beach/path passes, far above the actual coastline.
    for x0, x1, y0, y1 in [(0, 24, 63, 66), (76, 99, 63, 66)]:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                water[idx(x, y)] = 0
                if ground[idx(x, y)] in OLD_DIRT_GIDS or ground[idx(x, y)] in custom_range or ground[idx(x, y)] in patch_range:
                    ground[idx(x, y)] = SAND_BASE_GID

    # Clear only generated outdoor sprites in these middle/lower zones so the new composition reads cleanly.
    clear_sprite_layers([forest_back, forest_mid, forest_front, details], regions)

    for y in range(left_bounds[2], left_bounds[3] + 1):
        for x in range(left_bounds[0], left_bounds[1] + 1):
            local_x = x - left_bounds[0]
            local_y = y - left_bounds[2]
            ground[idx(x, y)] = patch_firstgid + local_y * PATCH_COLUMNS + local_x

    for y in range(right_bounds[2], right_bounds[3] + 1):
        for x in range(right_bounds[0], right_bounds[1] + 1):
            local_x = x - right_bounds[0]
            local_y = y - right_bounds[2]
            ground[idx(x, y)] = patch_firstgid + local_y * PATCH_COLUMNS + LEFT_PATCH_W + local_x

    # Dense mixed forest around the west side of the office, with the path left open.
    left_trees = [
        (16, 264, 6, 8, 0, 22),
        (8, 265, 5, 7, 6, 23),
        (20, 282, 4, 5, 16, 23),
        (0, 267, 4, 5, 1, 32),
        (28, 281, 4, 6, 4, 28),
        (4, 266, 5, 6, 6, 34),
        (16, 272, 6, 7, 13, 31),
        (24, 281, 4, 6, 20, 34),
        (24, 281, 4, 6, 0, 43),
        (4, 280, 5, 8, 5, 41),
        (8, 274, 5, 5, 11, 43),
        (16, 283, 3, 4, 17, 39),
        (16, 264, 6, 8, 17, 47),
        (0, 275, 4, 4, 2, 53),
        (4, 292, 4, 6, 6, 54),
        (8, 293, 5, 6, 12, 55),
        (28, 280, 4, 7, 16, 55),
        (0, 299, 4, 5, 20, 57),
    ]
    for col, row, w, h, x, y in left_trees:
        place_sprite(forest_front, col, row, w, h, x, y)

    # Right area: blue barn stays, with farm/market details and palms near the beach, no characters or animals.
    place_sprite(details, 16, 172, 13, 8, 84, 39)
    right_sprites = [
        (4, 102, 4, 10, 77, 52, "front"),
        (8, 102, 4, 10, 82, 53, "front"),
        (0, 104, 3, 4, 93, 58, "front"),
        (20, 104, 3, 3, 96, 25, "details"),
        (20, 121, 2, 3, 96, 32, "details"),
        (24, 117, 4, 2, 78, 48, "details"),
        (28, 117, 4, 2, 78, 52, "details"),
        (24, 121, 2, 3, 95, 49, "details"),
        (28, 121, 2, 3, 97, 49, "details"),
        (16, 287, 2, 2, 81, 25, "details"),
        (24, 287, 2, 2, 95, 55, "details"),
    ]
    for col, row, w, h, x, y, target in right_sprites:
        layer = details if target == "details" else forest_front
        place_sprite(layer, col, row, w, h, x, y)

    # Small natural marks, stumps, rocks, and flowers outside the walkable dirt.
    for x, y, tile_gid in [
        (3, 28, gid(16, 287)),
        (20, 30, gid(20, 116)),
        (5, 39, gid(24, 113)),
        (2, 49, gid(20, 115)),
        (15, 52, gid(16, 113)),
        (22, 55, gid(20, 287)),
        (79, 25, gid(16, 113)),
        (91, 32, gid(20, 113)),
        (78, 43, gid(24, 116)),
        (94, 58, gid(16, 116)),
        (97, 62, gid(16, 113)),
        (79, 27, gid(16, 114)),
        (81, 29, gid(17, 114)),
        (83, 31, gid(18, 114)),
        (94, 28, gid(16, 114)),
        (96, 30, gid(17, 114)),
        (98, 32, gid(18, 114)),
    ]:
        add_decoration(details, x, y, tile_gid)

    for name, values in [
        ("Outdoor_Ground", ground),
        ("Outdoor_Water", water),
        ("Outdoor_Path", path_layer),
        ("Outdoor_Forest_Back", forest_back),
        ("Outdoor_Forest_Mid", forest_mid),
        ("Outdoor_Forest_Front", forest_front),
        ("Outdoor_Details", details),
    ]:
        write_layer(root, name, values)

    ET.indent(root, space=" ")
    tree.write(TMX_PATH, encoding="UTF-8", xml_declaration=True)


def tileset_info(root: ET.Element) -> list[dict[str, object]]:
    infos = []
    for tileset in root.findall("tileset"):
        firstgid = int(tileset.attrib["firstgid"])
        source = tileset.attrib["source"]
        tsx_path = ROOT / source
        tsx_root = ET.parse(tsx_path).getroot()
        image_el = tsx_root.find("image")
        if image_el is None:
            raise RuntimeError(f"Missing image in {tsx_path}")
        image_path = tsx_path.parent / image_el.attrib["source"]
        image = Image.open(image_path).convert("RGBA")
        infos.append(
            {
                "firstgid": firstgid,
                "tilecount": int(tsx_root.attrib["tilecount"]),
                "columns": int(tsx_root.attrib["columns"]),
                "image": image,
            }
        )
    infos.sort(key=lambda item: int(item["firstgid"]))
    return infos


def find_tileset(infos: list[dict[str, object]], tile_gid: int) -> dict[str, object] | None:
    found = None
    for info in infos:
        if tile_gid >= int(info["firstgid"]):
            found = info
        else:
            break
    if found and tile_gid < int(found["firstgid"]) + int(found["tilecount"]):
        return found
    return None


def render_preview() -> None:
    PREVIEW_DIR.mkdir(exist_ok=True)
    root = ET.parse(TMX_PATH).getroot()
    infos = tileset_info(root)
    canvas = Image.new("RGBA", (MAP_W * TILE, MAP_H * TILE), (0, 0, 0, 0))

    for layer in root.findall("layer"):
        visible = layer.attrib.get("visible", "1") != "0"
        if not visible:
            continue
        values = read_layer(root, layer.attrib["name"])
        for y in range(MAP_H):
            for x in range(MAP_W):
                tile_gid = values[idx(x, y)]
                if tile_gid == 0:
                    continue
                info = find_tileset(infos, tile_gid)
                if not info:
                    continue
                local = tile_gid - int(info["firstgid"])
                columns = int(info["columns"])
                sx = (local % columns) * TILE
                sy = (local // columns) * TILE
                tile = info["image"].crop((sx, sy, sx + TILE, sy + TILE))
                canvas.alpha_composite(tile, (x * TILE, y * TILE))

    full = PREVIEW_DIR / "workmap2_big_outdoor_middle_lower_final.png"
    left = PREVIEW_DIR / "left_forest_final.png"
    right = PREVIEW_DIR / "right_farm_final.png"
    middle = PREVIEW_DIR / "middle_lower_final.png"
    path_tiles = PREVIEW_DIR / "clean_dirt_path_tiles.png"
    canvas.save(full)
    canvas.crop((0, 20 * TILE, 28 * TILE, 66 * TILE)).save(left)
    canvas.crop((74 * TILE, 21 * TILE, 100 * TILE, 68 * TILE)).save(right)
    canvas.crop((0, 18 * TILE, 100 * TILE, 76 * TILE)).save(middle)
    Image.open(CUSTOM_TILESET_IMAGE).resize((512, 512), Image.Resampling.NEAREST).save(path_tiles)


def validate_csv() -> None:
    root = ET.parse(TMX_PATH).getroot()
    bad = []
    for layer in root.findall("layer"):
        data = layer.find("data")
        text = data.text if data is not None and data.text is not None else ""
        values = [x for x in re.split(r"[,\s]+", text.strip()) if x]
        if len(values) != MAP_W * MAP_H:
            bad.append((layer.attrib["name"], len(values)))
    if bad:
        raise RuntimeError(f"Bad CSV layer lengths: {bad}")


if __name__ == "__main__":
    refine_map()
    validate_csv()
    render_preview()
    print("middle/lower refinement complete")
