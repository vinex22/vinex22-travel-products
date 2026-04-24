# vinex22-travels — cloud variant

This is the **cloud-deployable** copy of the storefront. It is functionally
identical to [`../web/`](../web/) except that **all image URLs come from an
external base** (typically an Azure Storage Blob container) configured by
`NEXT_PUBLIC_IMAGE_BASE`.

## Workflow

1. **Develop in `../web/`** — fast local iteration, images served from
   `public/images/`.
2. **Mirror changes here** — code changes to pages, components, or catalog
   should be ported to `web-cloud/src/` once verified locally.
3. **Build & deploy `web-cloud/`** — produces a smaller container image (no
   ~110 MB of bundled images), pulls media from blob storage at runtime.

## Local preview of the cloud build

```powershell
cp .env.example .env.local
# leave NEXT_PUBLIC_IMAGE_BASE blank to use local /images, OR set it to your blob URL
npm install
npm run dev
```

## Production

```powershell
$env:NEXT_PUBLIC_IMAGE_BASE = "https://stvinex22travels.blob.core.windows.net/images"
npm run build
npm start
```

## Storage layout

The blob container should mirror `web/public/images/`:

```
images/
  hero/hero-carry.png
  category/category-carry.png
  product/product-carry-01.png
  ...
  backdrop-wide/backdrop-hero-mountains.png
  backdrop-tall/backdrop-campaign-cabin.png
```

Upload script lives at [`../infra/upload-images.ps1`](../infra/upload-images.ps1)
(to be added with the IaC step).
