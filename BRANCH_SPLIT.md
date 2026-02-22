# Branch layout guide

This repo can be split into dedicated branches using:

```bash
./scripts/split_branches.sh
```

Optional base ref:

```bash
./scripts/split_branches.sh <base-ref>
```

## Resulting branches

- `frontend` contains only `React-native/`
- `backend` contains only `backend-rust/`
- `webapp` contains only `web-app/`

## Notes

- The script uses `git worktree` to safely shape each branch.
- If a branch already exists, it is reset to the provided base ref before filtering.
- Run from a clean working tree.
