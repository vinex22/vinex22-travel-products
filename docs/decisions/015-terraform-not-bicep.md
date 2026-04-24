# ADR-015 — Terraform (not Bicep) for IaC

**Date**: 2026-04-24
**Status**: Accepted

## Context
The repo needs a single IaC tool. Candidates were Bicep (Azure-native, no extra install when using Cloud Shell) and Terraform (cross-cloud, larger community, richer module ecosystem).

## Decision
**Terraform** (`>= 1.7`, `azurerm ~> 4.14`, `azuread ~> 3.0`) with 10 modules under `infra/terraform/modules/`. Local state (ADR-016).

## Consequences
- **+** Reviewers from AWS/GCP backgrounds recognize the syntax immediately.
- **+** `terraform plan` produces a clearer diff than `az deployment what-if` for chaining 10 modules.
- **+** `azuread` provider lets us create the Postgres AAD principal and federation credential in the same apply, no shell-out to `az` mid-deploy.
- **+** Module pattern (`modules/aks`, `modules/postgres`, etc.) maps 1:1 to the architecture doc.
- **−** Reviewers must `winget install hashicorp.terraform` (or equivalent). Acceptable; `check-prereqs.sh` catches it.
- **−** Some 2026-era Azure features land in Bicep first. None of the resources used here are affected (PG Flex, AKS, SB, Redis, Storage, KV, ACR, LAW, App Insights are all stable in `azurerm`).
