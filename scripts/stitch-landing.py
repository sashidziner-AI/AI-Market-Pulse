import json, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SLICES_DIR = os.path.join(ROOT, "outputs", "screenshots", "_landing-slices")
MANIFEST = os.path.join(SLICES_DIR, "slices.json")

with open(MANIFEST) as f:
    data = json.load(f)

total_h = data["totalHeight"]
vp_w = data["viewport"]["width"]
vp_h = data["viewport"]["height"]
header_h = data["headerHeight"]
out_path = data["outPath"]

canvas = Image.new("RGB", (vp_w, total_h), (0, 0, 0))

for entry in data["slicePaths"]:
    im = Image.open(entry["path"])
    y = entry["y"]
    if entry["isFirst"]:
        canvas.paste(im, (0, y))
    else:
        # Crop off the sticky header repeated at the top of every later
        # slice, and paste starting just below where the previous slice's
        # content ended (y + header_h, matching the scroll offset used
        # when capturing this slice).
        cropped = im.crop((0, header_h, vp_w, vp_h))
        canvas.paste(cropped, (0, y + header_h))

canvas.save(out_path)
print(f"Stitched {len(data['slicePaths'])} slices -> {out_path} ({canvas.size})")
