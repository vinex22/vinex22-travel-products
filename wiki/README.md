# SRE Demo Wiki

Tracking doc for the Azure SRE Agent customer demo. Source of truth for **what we planned** vs **what's actually delivered**.

## Index

| # | Page | Purpose |
|---|---|---|
| 00 | [Overview](00-overview.md) | Vision, goals, success criteria |
| 01 | [Architecture](01-architecture.md) | Target architecture diagram + components |
| 02 | [Services](02-services.md) | Per-microservice planned vs delivered |
| 03 | [Infrastructure](03-infrastructure.md) | Azure resources planned vs delivered |
| 04 | [Agent Config](04-agent-config.md) | Subagents, response plans, hooks, knowledge |
| 05 | [Demo Acts](05-demo-acts.md) | The 4-act demo flow, fault injection status |
| 06 | [Decisions](06-decisions.md) | ADR-style decision log |
| 07 | [Changelog](07-changelog.md) | Date-ordered delivery log |
| 08 | [Backlog](08-backlog.md) | Open questions, TODO, risks |

## Status legend

| Status | Meaning |
|---|---|
| Planned | Agreed in scope, not started |
| In Progress | Work has started |
| Delivered | Built, tested, demo-ready |
| Blocked | Waiting on a decision or dependency |
| Deferred | Out of scope for v1 |

## Quick status

| Area | Status | Notes |
|---|---|---|
| Project scope | In Progress | Awaiting app name + service breakdown confirmation |
| Web frontend | Planned | Starting first |
| Backend services | Planned | Polyglot (TS, Python, Go, .NET) |
| Azure infra (Bicep) | Planned | AKS Automatic + observability + deps |
| SRE Agent config | Planned | 3 subagents, response plan, hooks |
| Image generation | Planned | Azure Foundry gpt-image-2 |
| Demo scripts | Planned | chaos.sh + reset-demo.sh |
| Talk track | Planned | Per-act runbook |
