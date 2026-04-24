"""Append color variants + lineup entries to image-gen/catalog.json.

For each of the 30 existing products, generates:
  - 4 per-color shot prompts (bucket: product-color)
  - 1 lineup shot prompt with all 4 colors arranged Apple-iPhone-gallery style
    (bucket: product-lineup)

Idempotent — skips entries that already exist.
"""
from __future__ import annotations

import json
from pathlib import Path

CATALOG = Path(__file__).resolve().parent / "catalog.json"

# Per-category 4-color palette. Tuple = (slug, display, hex)
PALETTE: dict[str, list[tuple[str, str, str]]] = {
    "carry": [
        ("graphite", "Graphite", "#3a3a3c"),
        ("silver",   "Silver",   "#c5c7c9"),
        ("sand",     "Sand",     "#c8b89a"),
        ("midnight", "Midnight", "#1a2540"),
    ],
    "rest": [
        ("cream",    "Cream",    "#efe7d7"),
        ("charcoal", "Charcoal", "#2a2a2c"),
        ("oat",      "Oat",      "#c9bfa8"),
        ("navy",     "Navy",     "#1c2a3e"),
    ],
    "pack": [
        ("graphite", "Graphite", "#2a2a2c"),
        ("sand",     "Sand",     "#c8b89a"),
        ("olive",    "Olive",    "#5a6044"),
        ("crimson",  "Crimson",  "#6e2a2c"),
    ],
    "care": [
        ("cream",      "Cream",      "#efe7d7"),
        ("black",      "Black",      "#1a1a1a"),
        ("sage",       "Sage",       "#7d8a73"),
        ("terracotta", "Terracotta", "#a35a3e"),
    ],
    "tech": [
        ("black",  "Black",  "#1a1a1a"),
        ("silver", "Silver", "#c5c7c9"),
        ("sand",   "Sand",   "#c8b89a"),
        ("navy",   "Navy",   "#1c2a3e"),
    ],
}

# Image-prompt-friendly color descriptors
DESCR: dict[str, str] = {
    "graphite":   "deep matte graphite charcoal",
    "silver":     "polished brushed silver aluminum",
    "sand":       "warm sand-beige",
    "midnight":   "deep midnight navy blue",
    "cream":      "soft cream off-white",
    "charcoal":   "dark charcoal grey",
    "oat":        "natural oat-beige",
    "navy":       "deep navy blue",
    "olive":      "muted olive green",
    "crimson":    "deep crimson red",
    "black":      "matte black",
    "sage":       "soft muted sage green",
    "terracotta": "warm terracotta orange-clay",
}

# Per-product silhouette (color-agnostic). Keyed by `<cat>-<NN>` matching the
# existing product image ids in catalog.json.
SIL: dict[str, str] = {
    "carry-01": "hard-shell aluminum-frame carry-on suitcase, four spinner wheels, telescoping handle extended halfway, three-quarter front view",
    "carry-02": "large hard-shell aluminum-frame check-in suitcase, four spinner wheels, telescoping handle retracted, three-quarter front view",
    "carry-03": "waxed-canvas weekender duffel bag with leather handles and brass hardware, three-quarter view",
    "carry-04": "structured leather day-tote bag with reinforced base and slim shoulder straps, three-quarter view",
    "carry-05": "minimalist roll-top backpack in technical fabric with leather details, three-quarter view",
    "carry-06": "slim leather briefcase with brass clasps and structured silhouette, three-quarter view",
    "rest-01":  "soft cashmere travel throw blanket, neatly folded into a square stack",
    "rest-02":  "memory-foam U-shaped neck pillow with knit fabric cover, three-quarter view",
    "rest-03":  "contoured silk sleep eye mask with adjustable strap, lying flat",
    "rest-04":  "compressible suede travel slipper, single shoe at three-quarter angle",
    "rest-05":  "wool-blend hooded pullover, neatly folded square showing knit texture",
    "rest-06":  "small cylindrical brass pill case containing reusable silicone earplugs, lid open beside it",
    "pack-01":  "single rectangular ripstop-nylon compression packing cube with mesh top panel and zipper, three-quarter view",
    "pack-02":  "flat fabric garment folio with snap closures, lying closed, three-quarter view",
    "pack-03":  "pair of felt-lined fabric shoe sleeves, stacked",
    "pack-04":  "leather travel document wallet, closed, three-quarter view",
    "pack-05":  "drawstring antibacterial mesh laundry pouch, slightly cinched",
    "pack-06":  "rolled suede jewelry roll with brass snap closures, three-quarter view",
    "care-01":  "hangable canvas dopp kit toiletry bag with hook detail and zipper closure, three-quarter view",
    "care-02":  "compact rectangular canvas toiletry pouch, zipped closed, three-quarter view",
    "care-03":  "set of four refillable silicone travel bottles with brushed aluminum caps, arranged in a tight row",
    "care-04":  "leather sleeve case for a metal safety razor, lying flat",
    "care-05":  "small brass refillable fragrance atomizer bottle, vertical",
    "care-06":  "neatly folded stonewashed linen hand towel, square fold",
    "tech-01":  "rolled-up cable organizer roll with elastic loops, partially unfurled",
    "tech-02":  "compact universal travel power adapter, cube shape with retractable plugs visible",
    "tech-03":  "compact 4-port GaN charger brick with USB-C ports visible on one side, three-quarter view",
    "tech-04":  "hard-shell case for over-ear headphones, oval form, zippered, three-quarter view",
    "tech-05":  "slim laptop and tablet folio sleeve, lying flat closed, three-quarter view",
    "tech-06":  "rectangular slim power bank with brushed-aluminum shell, USB-C port visible at one end",
}


def color_prompt(sil: str, color_descr: str) -> str:
    return (
        f"A single {color_descr} {sil}. Pure white seamless studio background, "
        f"soft even lighting, minimal contact shadow. Apple-style product "
        f"photography. No people, no text, no logos."
    )


def lineup_prompt(sil: str, color_descrs: list[str]) -> str:
    color_list = ", then a ".join(color_descrs)
    return (
        f"Four identical {sil}, lined up in a row from left to right at slight "
        f"angles, slightly overlapping like an Apple iPhone color-lineup gallery "
        f"shot. Left to right: a {color_list}. All four are exactly the same "
        f"product, same size, same orientation, only the color differs. Pure "
        f"white seamless studio background, soft even lighting, minimal contact "
        f"shadow. Wide cinematic composition with negative space. Apple-style "
        f"product photography. No people, no text, no logos."
    )


def main() -> int:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))

    # Register new buckets if not present
    catalog["buckets"].setdefault(
        "product-color",
        {"size": "1024x1024", "purpose": "Per-color product variants for the color picker on PDP"},
    )
    catalog["buckets"].setdefault(
        "product-lineup",
        {"size": "1792x1024", "purpose": "All-color lineup hero shot per product, Apple gallery style"},
    )

    # Mark them as branded so the wordmark clause is appended
    branded = set(catalog["brand"].get("branded_buckets", []))
    branded.update({"product-color", "product-lineup"})
    catalog["brand"]["branded_buckets"] = sorted(branded)

    existing_ids = {img["id"] for img in catalog["images"]}
    new_entries: list[dict] = []

    for prod_key, sil in SIL.items():
        cat, idx = prod_key.split("-")
        palette = PALETTE[cat]
        descrs = [DESCR[slug] for slug, _, _ in palette]

        for slug, _, _ in palette:
            img_id = f"product-{cat}-{idx}-{slug}"
            if img_id in existing_ids:
                continue
            new_entries.append(
                {"id": img_id, "bucket": "product-color", "prompt": color_prompt(sil, DESCR[slug])}
            )

        lineup_id = f"product-{cat}-{idx}-lineup"
        if lineup_id not in existing_ids:
            new_entries.append(
                {"id": lineup_id, "bucket": "product-lineup", "prompt": lineup_prompt(sil, descrs)}
            )

    if not new_entries:
        print("Nothing to add; catalog already has color + lineup entries.")
        return 0

    catalog["images"].extend(new_entries)
    CATALOG.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print(f"Added {len(new_entries)} entries; catalog total now {len(catalog['images'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
