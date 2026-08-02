#!/bin/bash

# Read the JSON input from stdin
input=$(cat)

# Check if stop hook is already active (recursion prevention)
stop_hook_active=$(echo "$input" | jq -r '.stop_hook_active')
if [[ "$stop_hook_active" = "true" ]]; then
  exit 0
fi

# Check if we're in a git repository - bail if not
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  exit 0
fi

# Bail if there's no remote to push to. Every error path below asks the user
# to "push to the remote branch" — meaningless without a remote, and
# unsatisfiable if signing also requires a source. This case arises when CCR
# was launched against a local repo with no github remote (sources=[]) and
# the container's cwd has a leftover .git from a cached resume.
if [[ -z "$(git remote)" ]]; then
  exit 0
fi

# Check for uncommitted changes (both staged and unstaged)
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "There are uncommitted changes in the repository. Please commit and push these changes to the remote branch." >&2
  exit 2
fi

# Check for untracked files that might be important
untracked_files=$(git ls-files --others --exclude-standard)
if [[ -n "$untracked_files" ]]; then
  echo "There are untracked files in the repository. Please commit and push these changes to the remote branch." >&2
  exit 2
fi

current_branch=$(git branch --show-current)
if [[ -n "$current_branch" ]]; then
  if git rev-parse "origin/$current_branch" >/dev/null 2>&1; then
    upstream="origin/$current_branch"
  else
    upstream="origin/HEAD"
  fi

  # Resolve the remote default branch (origin/main, origin/master, ...).
  # Commits reachable from it are already published: they cannot be rewritten
  # and do not need pushing, so they must never be reported below.
  default_ref=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null)
  if [[ -z "$default_ref" ]]; then
    for candidate in origin/main origin/master; do
      if git rev-parse --verify --quiet "$candidate" >/dev/null 2>&1; then
        default_ref="$candidate"
        break
      fi
    done
  fi

  # Commits that are genuinely ours to fix or push: reachable from HEAD, but
  # from neither the branch's own upstream nor the default branch.
  #
  # Excluding the default branch matters because the branch ref goes stale the
  # moment its PR is squash-merged, and again whenever the branch is brought up
  # to date with main before the push happens. "$upstream..HEAD" then resolves
  # to every commit main has gained since -- other people's merged PRs
  # included. Those carry 'committer=GitHub <noreply@github.com>' from the
  # squash-merge, or the repo owner's own address, and tripped the signature
  # check below into advising a rebase that would have rewritten published
  # history and reassigned its authorship.
  exclusions=("$upstream")
  if [[ -n "$default_ref" && "$default_ref" != "$upstream" ]]; then
    exclusions+=("$default_ref")
  fi
  mapfile -t own_commits < <(git rev-list HEAD --not "${exclusions[@]}" 2>/dev/null)

  if [[ ${#own_commits[@]} -gt 0 ]]; then
    # Check for local commits that GitHub will show as "Unverified": either no
    # signature at all (%G? == N), or signed with a committer email other than
    # noreply@anthropic.com (the identity CCR's signing key is registered to).
    # Only run when commit signing is configured. Note: %G? is N for unsigned
    # commits; signed-but-locally-unverifiable commits report B/U/E, so this is
    # a reliable presence check even though CCR doesn't configure local verification.
    #
    # GitHub signs the commits it creates itself (squash/merge from the web UI),
    # so they show as Verified despite the committer email -- skip them. This is
    # a backstop for merge commits that reached the branch without being on the
    # default branch yet; the exclusions above handle the common case.
    if [[ "$(git config --type=bool commit.gpgsign 2>/dev/null)" == "true" ]]; then
      unverifiable=$(git log --no-walk --format='%h %G? %ce' "${own_commits[@]}" 2>/dev/null |
        awk '$3 == "noreply@github.com" { next } $2 == "N" || $3 != "noreply@anthropic.com"')
      if [[ -n "$unverifiable" ]]; then
        echo "There are commit(s) on branch '$current_branch' that GitHub will show as Unverified (missing signature, or committer email is not noreply@anthropic.com):" >&2
        echo "$unverifiable" >&2
        echo "Please run 'git config user.email noreply@anthropic.com && git config user.name Claude', then 'git commit --amend --no-edit --reset-author' for the tip commit, or 'git rebase --exec \"git commit --amend --no-edit --reset-author\" $upstream' for earlier commits, then push." >&2
        exit 2
      fi
    fi

    unpushed=${#own_commits[@]}
    if [[ "$upstream" == "origin/$current_branch" ]]; then
      echo "There are $unpushed unpushed commit(s) on branch '$current_branch'. Please push these changes to the remote repository." >&2
    else
      echo "Branch '$current_branch' has $unpushed unpushed commit(s) and no remote branch. Please push these changes to the remote repository." >&2
    fi
    exit 2
  fi
fi

exit 0
