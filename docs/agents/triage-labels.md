# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the right-hand column to match whatever vocabulary you actually use.

## Provisioning status

All five labels exist on `Arnutt-N/huangua-works`. Four were created as part of this setup:

| Label             | Color     | Origin                        |
| ----------------- | --------- | ----------------------------- |
| `needs-triage`    | `#fbca04` | created 2026-08-09            |
| `needs-info`      | `#d876e3` | created 2026-08-09            |
| `ready-for-agent` | `#0e8a16` | created 2026-08-09            |
| `ready-for-human` | `#1d76db` | created 2026-08-09            |
| `wontfix`         | `#ffffff` | pre-existing — GitHub default |

`wontfix` ships with every new GitHub repo and already meant exactly what the canonical role means, so it was left untouched rather than recreated.

### The other GitHub defaults are orthogonal

A new GitHub repo also ships with `bug`, `documentation`, `duplicate`, `enhancement`, `good first issue`, `help wanted`, `invalid`, and `question`. These are **not** part of the triage vocabulary — `/triage` neither reads nor writes them, and their presence on an issue says nothing about its triage state.

They describe *what an issue is about*; the five labels above describe *what happens to it next*. Both can sit on the same issue without conflict.
