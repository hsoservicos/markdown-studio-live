---
description: The human's door to the provisioning contract — the stack every unit of a waves run works against (dependencies, its own environment file, a database of its own, services on their own ports). [D] DISCOVER this project's stack and write the recipe (a `scripts/waves-front.sh`, the `[scm] provision` / `teardown` keys, the `worktree_seed` list, and a consult skill the sessions read), [C] CHECK an existing recipe against the tree, [T] TRY it on a scratch worktree — asking the owner one numbered question at a time. Use when the user says "provision worktrees", "each story needs its own database", "the fronts collide on data", "set up the stack per worktree", or invokes waves-provisioning. Project-agnostic; invoked without an argument it shows the menu.
---

@skills/waves-provisioning
