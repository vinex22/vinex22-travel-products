# ADR-006 — Generate product imagery via Azure Foundry gpt-image-2

**Date**: 2026-04-24
**Status**: Accepted

## Context
Need original product imagery for the Apple-inspired storefront without Apple IP and without Unsplash dependency.

## Decision
Use the user's `gpt-image-2` deployment in Foundry project `vinex22-sandbox`. Auth via `DefaultAzureCredential` (no keys).

## Consequences
Bespoke, on-brand visuals. One-time generation step in build pipeline; images committed to repo for demo reliability.
