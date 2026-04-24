# Image Generation Pipeline — vinex22-travels

Generates the 50-image catalog for the demo storefront via Azure Foundry `gpt-image-2`.

## Prerequisites

- Python 3.10+
- Logged into Azure CLI: `az login`
- Access to the Foundry project `vinex22-sandbox`
- The `gpt-image-2` deployment exists on `foundry-multimodel`

## Setup

```powershell
cd image-gen
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Run

```powershell
# Generate everything
python generate.py

# Generate a single bucket
python generate.py --bucket hero
python generate.py --bucket products

# Generate one image by id (useful for re-rolls)
python generate.py --id carry-hero
python generate.py --id carry-product-01

# Force regenerate (skip cache)
python generate.py --force
```

Outputs land in `..\web\public\images\<bucket>\<id>.png` and are committed to the repo.

## Auth

Uses `DefaultAzureCredential` — no keys, per environment policy. Make sure your CLI session has `Cognitive Services User` on the Foundry account.

## Catalog

See [`catalog.json`](catalog.json) — 50 image specs (id, bucket, prompt, size).
