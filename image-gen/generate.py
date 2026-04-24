"""Generate vinex22-travels image catalog via Azure Foundry gpt-image-2.

Auth: DefaultAzureCredential (no keys, per env policy).
Reads catalog.json -> writes PNGs to ../web/public/images/<bucket>/<id>.png.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from openai import AzureOpenAI

SCRIPT_DIR = Path(__file__).resolve().parent
CATALOG_PATH = SCRIPT_DIR / "catalog.json"
OUTPUT_ROOT = SCRIPT_DIR.parent / "web" / "public" / "images"

ENDPOINT = os.getenv(
    "AZURE_AI_SERVICES_ENDPOINT",
    "https://foundry-multimodel.services.ai.azure.com",
).rstrip("/")
DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-image-2")
API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2025-04-01-preview")
SCOPE = "https://cognitiveservices.azure.com/.default"


def make_client() -> AzureOpenAI:
    credential = DefaultAzureCredential()
    token_provider = get_bearer_token_provider(credential, SCOPE)
    return AzureOpenAI(
        azure_endpoint=ENDPOINT,
        azure_ad_token_provider=token_provider,
        api_version=API_VERSION,
    )


def load_catalog() -> dict[str, Any]:
    with CATALOG_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def output_path(bucket: str, image_id: str) -> Path:
    return OUTPUT_ROOT / bucket / f"{image_id}.png"


def generate_one(
    client: AzureOpenAI,
    image_id: str,
    bucket: str,
    prompt: str,
    size: str,
    style_preamble: str,
    branding_suffix: str,
) -> Path:
    out = output_path(bucket, image_id)
    out.parent.mkdir(parents=True, exist_ok=True)
    full_prompt = f"{style_preamble}\n\n{prompt}\n\n{branding_suffix}"
    result = client.images.generate(
        model=DEPLOYMENT,
        prompt=full_prompt,
        size=size,
        n=1,
    )
    item = result.data[0]
    if getattr(item, "b64_json", None):
        out.write_bytes(base64.b64decode(item.b64_json))
    elif getattr(item, "url", None):
        # Fallback if API returns URL instead of b64
        import urllib.request

        with urllib.request.urlopen(item.url) as r:  # noqa: S310
            out.write_bytes(r.read())
    else:
        raise RuntimeError(f"No image data returned for {image_id}")
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate vinex22-travels imagery")
    parser.add_argument("--bucket", help="Only generate this bucket")
    parser.add_argument("--id", help="Only generate this image id")
    parser.add_argument("--force", action="store_true", help="Regenerate even if file exists")
    parser.add_argument("--dry-run", action="store_true", help="List what would be generated")
    parser.add_argument(
        "--workers",
        type=int,
        default=5,
        help="Concurrent generation workers (default 5; lower if you hit rate limits)",
    )
    parser.add_argument(
        "--max-retries",
        type=int,
        default=3,
        help="Retry attempts on transient errors (500 / timeout / 429). Default 3.",
    )
    parser.add_argument(
        "--retry-backoff",
        type=float,
        default=10.0,
        help="Base seconds for exponential backoff between retries (default 10).",
    )
    args = parser.parse_args()

    catalog = load_catalog()
    brand = catalog["brand"]
    style_preamble = brand["style"]
    branding_clause = brand.get("branding_clause", "")
    no_branding_clause = brand.get("no_branding_clause", "")
    branded_buckets = set(brand.get("branded_buckets", []))
    bucket_meta = catalog["buckets"]
    images = catalog["images"]

    if args.id:
        images = [img for img in images if img["id"] == args.id]
    if args.bucket:
        images = [img for img in images if img["bucket"] == args.bucket]

    if not images:
        print("No images match the filter.", file=sys.stderr)
        return 1

    print(f"Plan: {len(images)} images, {args.workers} workers")
    if args.dry_run:
        for img in images:
            size = bucket_meta[img["bucket"]]["size"]
            tag = "branded" if img["bucket"] in branded_buckets else "clean"
            print(f"  - {img['id']} ({img['bucket']}, {size}, {tag})")
        return 0

    client = make_client()
    succeeded: list[str] = []
    skipped: list[str] = []
    failed: list[tuple[str, str]] = []
    lock = threading.Lock()
    total = len(images)
    counter = {"done": 0, "started": 0, "in_flight": 0}

    def _ts() -> str:
        return time.strftime("%H:%M:%S")

    def work(idx: int, img: dict) -> None:
        image_id = img["id"]
        bucket = img["bucket"]
        size = bucket_meta[bucket]["size"]
        out = output_path(bucket, image_id)
        branding_suffix = branding_clause if bucket in branded_buckets else no_branding_clause

        if out.exists() and not args.force:
            with lock:
                counter["done"] += 1
                skipped.append(image_id)
                print(
                    f"[{_ts()}] [{counter['done']:>3}/{total}] SKIP   {image_id} ({size}) (exists)",
                    flush=True,
                )
            return

        with lock:
            counter["started"] += 1
            counter["in_flight"] += 1
            print(
                f"[{_ts()}] [{counter['started']:>3}/{total}] START  {image_id} ({size})  in_flight={counter['in_flight']}",
                flush=True,
            )

        last_err = None
        t0 = time.monotonic()
        for attempt in range(1, args.max_retries + 1):
            try:
                generate_one(
                    client=client,
                    image_id=image_id,
                    bucket=bucket,
                    prompt=img["prompt"],
                    size=size,
                    style_preamble=style_preamble,
                    branding_suffix=branding_suffix,
                )
                last_err = None
                break
            except Exception as e:  # noqa: BLE001
                last_err = e
                etype = type(e).__name__
                # Only retry transient classes
                transient = (
                    "InternalServerError",
                    "APITimeoutError",
                    "APIConnectionError",
                    "RateLimitError",
                )
                if etype not in transient or attempt == args.max_retries:
                    break
                backoff = args.retry_backoff * (2 ** (attempt - 1))
                with lock:
                    print(
                        f"[{_ts()}]              RETRY  {image_id} attempt {attempt}/{args.max_retries} after {backoff:.0f}s ({etype})",
                        flush=True,
                    )
                time.sleep(backoff)

        dt = time.monotonic() - t0
        with lock:
            counter["in_flight"] -= 1
            counter["done"] += 1
            if last_err is None:
                succeeded.append(image_id)
                print(
                    f"[{_ts()}] [{counter['done']:>3}/{total}] OK     {image_id} ({size}) ({dt:.1f}s)  in_flight={counter['in_flight']}",
                    flush=True,
                )
            else:
                msg = f"{type(last_err).__name__}: {last_err}"
                failed.append((image_id, msg))
                print(
                    f"[{_ts()}] [{counter['done']:>3}/{total}] FAIL   {image_id} ({size}) ({dt:.1f}s) {msg}",
                    file=sys.stderr,
                    flush=True,
                )

    t_start = time.monotonic()
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = [pool.submit(work, i, img) for i, img in enumerate(images, start=1)]
        for _ in as_completed(futures):
            pass
    elapsed = time.monotonic() - t_start

    print()
    print(
        f"Done in {elapsed:.1f}s. ok={len(succeeded)} skip={len(skipped)} fail={len(failed)}"
    )
    if failed:
        print("Failures:", file=sys.stderr)
        for image_id, msg in failed:
            print(f"  - {image_id}: {msg}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
