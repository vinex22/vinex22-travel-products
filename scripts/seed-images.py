#!/usr/bin/env python3
"""seed-images.py — Upload web/public/images/** into the Storage Account
`images` container, preserving relative paths. Auth via DefaultAzureCredential.

Skips files already present with matching size + md5 unless --force.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import mimetypes
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from azure.core.exceptions import ResourceNotFoundError
from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient, ContentSettings

from _seed_common import (
    REPO_ROOT,
    Timer,
    err as log_err,
    info,
    load_local_env,
    ok as log_ok,
    step,
    substep,
)

SOURCE_DIR = REPO_ROOT / "web" / "public" / "images"


def md5_b64(path: Path) -> bytes:
    h = hashlib.md5()  # noqa: S324 — Azure uses MD5 for blob integrity
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.digest()


def upload_one(container, rel: str, src: Path, force: bool) -> str:
    blob = container.get_blob_client(rel)
    digest = md5_b64(src)
    size = src.stat().st_size
    if not force:
        try:
            props = blob.get_blob_properties()
            if props.size == size and props.content_settings.content_md5 == digest:
                return f"skip {rel}"
        except ResourceNotFoundError:
            pass
    ctype, _ = mimetypes.guess_type(str(src))
    blob.upload_blob(
        src.read_bytes(),
        overwrite=True,
        content_settings=ContentSettings(
            content_type=ctype or "application/octet-stream",
            content_md5=digest,
            cache_control="public, max-age=31536000, immutable",
        ),
    )
    return f"up   {rel} ({size} B)"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="Re-upload even if blob matches")
    ap.add_argument("--workers", type=int, default=8)
    args = ap.parse_args()

    step("seed-images")
    load_local_env()
    if not SOURCE_DIR.exists():
        info(f"no source images at {SOURCE_DIR}, skipping")
        return 0

    account = os.environ["STORAGE_NAME"]
    container_name = "images"
    info(f"target: https://{account}.blob.core.windows.net/{container_name}")
    info(f"workers={args.workers}  force={args.force}")

    substep("acquire credential + open container client")
    cred = DefaultAzureCredential(exclude_interactive_browser_credential=True)
    svc = BlobServiceClient(f"https://{account}.blob.core.windows.net", credential=cred)
    container = svc.get_container_client(container_name)

    files = [p for p in SOURCE_DIR.rglob("*") if p.is_file()]
    info(f"discovered {len(files)} local files under {SOURCE_DIR}")
    rels = {p: str(p.relative_to(SOURCE_DIR)).replace(os.sep, "/") for p in files}

    n_ok = n_err = n_skip = n_up = 0
    with Timer(f"upload {len(files)} files"):
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            futs = {pool.submit(upload_one, container, rels[p], p, args.force): p for p in files}
            for fut in as_completed(futs):
                p = futs[fut]
                try:
                    msg = fut.result()
                    if msg.startswith("skip"):
                        n_skip += 1
                    else:
                        n_up += 1
                    print(f"  {msg}", flush=True)
                    n_ok += 1
                except Exception as e:  # noqa: BLE001
                    log_err(f"{rels[p]}: {e}")
                    n_err += 1
    log_ok(f"done: uploaded={n_up}  skipped={n_skip}  errors={n_err}  total_ok={n_ok}")
    return 1 if n_err else 0


if __name__ == "__main__":
    sys.exit(main())
