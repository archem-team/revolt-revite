#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
    echo "usage: $0 <previous-translation-commit> <next-translation-commit>" >&2
    exit 2
fi

previous_commit="$1"
next_commit="$2"
translations_url="${TRANSLATIONS_REPO_URL:-https://github.com/archem-team/translations.git}"

for commit in "$previous_commit" "$next_commit"; do
    if [[ ! "$commit" =~ ^[0-9a-f]{40}$ ]]; then
        echo "invalid translation commit: $commit" >&2
        exit 2
    fi
done

if [[ "$previous_commit" == "$next_commit" ]]; then
    echo "translation submodule pointer is unchanged"
    exit 0
fi

check_dir="$(mktemp -d)"
cleanup() {
    rm -rf -- "$check_dir"
}
trap cleanup EXIT

git init --bare --quiet "$check_dir"
git -C "$check_dir" remote add origin "$translations_url"
git -C "$check_dir" fetch --quiet --no-tags origin \
    "+refs/heads/master:refs/remotes/origin/master"

for commit in "$previous_commit" "$next_commit"; do
    if ! git -C "$check_dir" cat-file -e "$commit^{commit}" 2>/dev/null; then
        echo "translation commit is not reachable from translations master: $commit" >&2
        exit 1
    fi
done

if ! git -C "$check_dir" merge-base --is-ancestor \
    "$next_commit" refs/remotes/origin/master; then
    echo "new translation pointer is not contained in translations master: $next_commit" >&2
    exit 1
fi

if ! git -C "$check_dir" merge-base --is-ancestor \
    "$previous_commit" "$next_commit"; then
    echo "translation pointer must fast-forward: $previous_commit -> $next_commit" >&2
    exit 1
fi

echo "translation pointer fast-forwards on master: $previous_commit -> $next_commit"
