#!/usr/bin/env python
"""Validate a folder of training images and lay it out the way kohya expects.

The validation is the point. A LoRA trained on 30 pictures of the same model in
the same room learns the model and the room, and you only find out after paying
for the training run — so anything that would poison the result is reported here
instead, and refuses to proceed unless you insist.

    python training/prepare_dataset.py --src ./refs --out training/dataset --trigger mhprop
"""
import argparse, hashlib, os, shutil, sys
from collections import Counter

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow required:  pip install Pillow")

MIN_SHORT_EDGE = 1024
OK_EXT = {".jpg", ".jpeg", ".png", ".webp"}


def phash(path: str) -> str:
    """Cheap near-duplicate signature: 16x16 greyscale, above/below mean."""
    with Image.open(path) as im:
        px = list(im.convert("L").resize((16, 16), Image.LANCZOS).getdata())
    avg = sum(px) / len(px)
    return hashlib.md5(bytes(1 if p > avg else 0 for p in px)).hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, help="folder of source images")
    ap.add_argument("--out", required=True, help="dataset folder to create")
    ap.add_argument("--trigger", required=True, help="rare token the concept binds to")
    ap.add_argument("--repeats", type=int, default=10, help="kohya repeats per image")
    ap.add_argument("--force", action="store_true", help="write the dataset despite warnings")
    a = ap.parse_args()

    files = sorted(
        os.path.join(a.src, f) for f in os.listdir(a.src)
        if os.path.splitext(f)[1].lower() in OK_EXT
    )
    if not files:
        return err(f"no images in {a.src}")

    problems, seen, kept = [], {}, []
    for f in files:
        try:
            with Image.open(f) as im:
                w, h = im.size
        except Exception as e:
            problems.append(f"{os.path.basename(f)}: unreadable ({e})")
            continue
        if min(w, h) < MIN_SHORT_EDGE:
            problems.append(f"{os.path.basename(f)}: {w}x{h}, short edge under {MIN_SHORT_EDGE}")
            continue
        sig = phash(f)
        if sig in seen:
            problems.append(f"{os.path.basename(f)}: near-duplicate of {os.path.basename(seen[sig])}")
            continue
        seen[sig] = f
        kept.append((f, w, h))

    print(f"\n{len(kept)} usable / {len(files)} found")
    if problems:
        print("\nrejected:")
        for p in problems:
            print("  -", p)

    warn = []
    if len(kept) < 15:
        warn.append(f"only {len(kept)} images — under 15 the LoRA memorises rather than generalises")
    elif len(kept) < 25:
        warn.append(f"{len(kept)} images — works, but 25-40 is the range that generalises")

    # Identical framing across the set is the usual cause of a LoRA that can
    # only reproduce one composition.
    shapes = Counter("portrait" if h > w else "landscape" if w > h else "square" for _, w, h in kept)
    if len(kept) and max(shapes.values()) == len(kept):
        warn.append(f"every image is {next(iter(shapes))} — vary the framing or the crop gets baked in")

    if warn:
        print("\nwarnings:")
        for w_ in warn:
            print("  !", w_)
        print("\nThese cannot be checked automatically and matter more:")
        print("  - at least 5-8 DIFFERENT models, or the LoRA learns a face")
        print("  - poses, rooms and lighting all varied")
        print("  - no AI-generated images, no identifiable real people")
        if not a.force:
            print("\nnothing written. re-run with --force once you are satisfied.")
            return 1

    # kohya reads the repeat count from the folder name: "10_trigger".
    dest = os.path.join(a.out, f"{a.repeats}_{a.trigger}")
    os.makedirs(dest, exist_ok=True)
    for i, (f, _, _) in enumerate(kept):
        ext = os.path.splitext(f)[1].lower()
        base = f"{a.trigger}_{i:03d}"
        shutil.copy2(f, os.path.join(dest, base + ext))
        # Describe everything EXCEPT the concept being trained: whatever the
        # captions leave unsaid is what the trigger token absorbs.
        with open(os.path.join(dest, base + ".txt"), "w", encoding="utf-8") as fh:
            fh.write(f"{a.trigger}, a nude man, ")

    print(f"\nwrote {len(kept)} images to {dest}")
    print("Now edit each .txt: describe the pose, the room, the lighting and the")
    print("model's build — but never the proportion you are training. Leaving it")
    print("undescribed is what binds it to the trigger.")
    return 0


def err(msg: str) -> int:
    print("error:", msg, file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
