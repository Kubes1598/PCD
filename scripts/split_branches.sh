#!/usr/bin/env bash
set -euo pipefail

# Split monorepo content into focused branches:
# - frontend: React-native/
# - backend: backend-rust/
# - webapp: web-app/

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CURRENT_BRANCH="$(git branch --show-current)"
BASE_REF="${1:-$CURRENT_BRANCH}"

if ! git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
  echo "Base ref '$BASE_REF' does not exist."
  exit 1
fi

# temp worktree for safe branch shaping
TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

keep_only() {
  local branch="$1"
  shift
  local keep_paths=("$@")

  echo "==> Preparing branch '$branch' from '$BASE_REF'"
  git worktree add -B "$branch" "$TMP_DIR/$branch" "$BASE_REF" >/dev/null

  pushd "$TMP_DIR/$branch" >/dev/null

  # Remove tracked files except selected paths
  while IFS= read -r tracked; do
    keep=false
    for prefix in "${keep_paths[@]}"; do
      if [[ "$tracked" == "$prefix" || "$tracked" == "$prefix"/* ]]; then
        keep=true
        break
      fi
    done
    if [[ "$keep" == false ]]; then
      git rm -q -f -- "$tracked"
    fi
  done < <(git ls-files)

  # Remove untracked leftovers
  git clean -fdq

  # Stage retained directories (if any changes due to cleanups)
  git add -A

  if git diff --cached --quiet; then
    echo "No content changes required for '$branch'."
  else
    git commit -m "chore(branch): keep only ${keep_paths[*]} on $branch"
    echo "Committed branch shaping for '$branch'."
  fi

  popd >/dev/null
  git worktree remove "$TMP_DIR/$branch" --force >/dev/null
}

keep_only frontend React-native
keep_only backend backend-rust
keep_only webapp web-app

echo
echo "Done. Branches updated: frontend, backend, webapp"
echo "Current branch remains: $(git branch --show-current)"
