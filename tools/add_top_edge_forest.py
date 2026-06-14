from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
TMX_PATH = ROOT / "workmap2_big_outdoor.tmx"
PREVIEW_DIR = ROOT / ".codex_previews"
TILE = 32
W = 100
H = 80
COMPLETE_FIRSTGID = 4065
COMPLETE_COLUMNS = 32


def gid(col: int, row: int) -> int:
    return COMPLETE_FIRSTGID + row * COMPLETE_COLUMNS + col


def read_layer(root: ET.Element, name: str) -> list[int]:
    data = root.find(f"./layer[@name='{name}']/data")
    if data is None or data.text is None:
        raise RuntimeError(f"Missing layer data: {name}")
    values = [int(x) for x in re.split(r"[,\s]+", data.text.strip()) if x]
    if len(values) != W * H:
        raise RuntimeError(f"{name} has {len(values)} tiles, expected {W * H}")
    return values


def write_layer(root: ET.Element, name: str, values: list[int]) -> None:
    data = root.find(f"./layer[@name='{name}']/data")
    if data is None:
        raise RuntimeError(f"Missing layer data: {name}")
    rows = []
    for y in range(H):
        rows.append(",".join(str(v) for v in values[y * W : (y + 1) * W]))
    data.text = "\n" + ",\n".join(rows) + "\n"


def place_sprite(layer: list[int], col: int, row: int, sprite_w: int, sprite_h: int, x: int, y: int) -> None:
    for dy in range(sprite_h):
        for dx in range(sprite_w):
            tx = x + dx
            ty = y + dy
            if 0 <= tx < W and 0 <= ty < H:
                layer[ty * W + tx] = gid(col + dx, row + dy)


def clear_region(layer: list[int], x0: int, x1: int, y0: int, y1: int) -> None:
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            layer[y * W + x] = 0


def add_forest() -> None:
    tree = ET.parse(TMX_PATH)
    root = tree.getroot()
    back = read_layer(root, "trees-back")
    front = read_layer(root, "trees-front")

    # Only rework the top-edge extension area. The exact cottage scene at x=0..25 remains untouched.
    clear_region(back, 22, 56, 0, 15)
    clear_region(front, 22, 56, 0, 15)

    # Same small round-canopy forest family as the top-left scene. Negative y clips the canopy at the map edge,
    # making the forest feel like it continues beyond the visible map.
    back_plan = [
        (0, 256, 23, -1, 4, 4),
        (4, 255, 26, -2, 4, 5),
        (0, 267, 29, -1, 4, 4),
        (4, 266, 32, -2, 4, 5),
        (0, 256, 35, -1, 4, 4),
        (4, 255, 38, -2, 4, 5),
        (0, 267, 41, -1, 4, 4),
        (4, 266, 44, -2, 4, 5),
        (0, 256, 47, -1, 4, 4),
        (4, 255, 50, -2, 4, 5),
        (8, 254, 24, 1, 5, 6),
        (0, 256, 28, 2, 4, 4),
        (8, 265, 31, 1, 5, 6),
        (4, 255, 35, 2, 4, 5),
        (8, 254, 38, 1, 5, 6),
        (0, 267, 42, 2, 4, 4),
        (8, 265, 45, 1, 5, 6),
        (4, 266, 49, 2, 4, 5),
        (0, 267, 53, 2, 4, 4),
    ]
    front_plan = [
        (4, 255, 23, 5, 4, 5),
        (8, 254, 27, 5, 5, 6),
        (0, 256, 31, 7, 4, 4),
        (4, 266, 34, 5, 4, 5),
        (8, 265, 38, 5, 5, 6),
        (0, 267, 42, 7, 4, 4),
        (4, 255, 45, 6, 4, 5),
        (0, 256, 49, 8, 4, 4),
        (0, 267, 27, 10, 4, 4),
        (4, 266, 34, 10, 4, 5),
        (0, 256, 41, 10, 4, 4),
        (0, 267, 49, 11, 4, 4),
    ]

    for col, row, x, y, sprite_w, sprite_h in back_plan:
        place_sprite(back, col, row, sprite_w, sprite_h, x, y)
    for col, row, x, y, sprite_w, sprite_h in front_plan:
        place_sprite(front, col, row, sprite_w, sprite_h, x, y)

    write_layer(root, "trees-back", back)
    write_layer(root, "trees-front", front)
    ET.indent(root, space=" ")
    tree.write(TMX_PATH, encoding="UTF-8", xml_declaration=True)


def tileset_infos(root: ET.Element) -> list[dict[str, object]]:
    infos = []
    for tileset in root.findall("tileset"):
        firstgid = int(tileset.attrib["firstgid"])
        source = tileset.attrib["source"]
        tsx_path = ROOT / source
        tsx_root = ET.parse(tsx_path).getroot()
        image_el = tsx_root.find("image")
        if image_el is None:
            continue
        image_path = tsx_path.parent / image_el.attrib["source"]
        if not image_path.exists() and "0_Complete_Tileset_32x32.png" in str(image_path):
            image_path = ROOT / "workmap/apps/web/public/maps/tilesets/complete_tileset_32x32.png"
        if not image_path.exists():
            continue
        infos.append(
            {
                "firstgid": firstgid,
                "tilecount": int(tsx_root.attrib["tilecount"]),
                "columns": int(tsx_root.attrib["columns"]),
                "image": Image.open(image_path).convert("RGBA"),
            }
        )
    return sorted(infos, key=lambda item: int(item["firstgid"]))


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


def render_top_preview() -> None:
    PREVIEW_DIR.mkdir(exist_ok=True)
    root = ET.parse(TMX_PATH).getroot()
    infos = tileset_infos(root)
    canvas = Image.new("RGBA", (W * TILE, H * TILE), (0, 0, 0, 0))
    for layer in root.findall("layer"):
        values = read_layer(root, layer.attrib["name"])
        for y in range(H):
            for x in range(W):
                tile_gid = values[y * W + x]
                if not tile_gid:
                    continue
                info = find_tileset(infos, tile_gid)
                if info is None:
                    continue
                local = tile_gid - int(info["firstgid"])
                cols = int(info["columns"])
                sx = (local % cols) * TILE
                sy = (local // cols) * TILE
                tile = info["image"].crop((sx, sy, sx + TILE, sy + TILE))
                canvas.alpha_composite(tile, (x * TILE, y * TILE))

    canvas.crop((0, 0, 60 * TILE, 24 * TILE)).save(PREVIEW_DIR / "top_edge_forest_extension.png")
    canvas.crop((20 * TILE, 0, 58 * TILE, 18 * TILE)).save(PREVIEW_DIR / "top_edge_forest_extension_detail.png")


def validate() -> None:
    root = ET.parse(TMX_PATH).getroot()
    bad = []
    for layer in root.findall("layer"):
        data = layer.find("data")
        text = data.text if data is not None and data.text is not None else ""
        values = [x for x in re.split(r"[,\s]+", text.strip()) if x]
        if len(values) != W * H or text.strip().endswith(","):
            bad.append((layer.attrib["name"], len(values), text.strip().endswith(",")))
    if bad:
        raise RuntimeError(f"Bad layer CSV: {bad}")


if __name__ == "__main__":
    add_forest()
    validate()
    render_top_preview()
    print("top edge forest extension complete")
