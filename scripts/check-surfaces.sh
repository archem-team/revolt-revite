#!/bin/bash
# Surface-token guardrail: the purple navigation family must not leak into
# content components, and content code must not paint raw nav hexes.
# Run from repo root; exits non-zero on violations.
FAIL=0

# nav tokens outside navigation-owned files
HITS=$(grep -rln -- "var(--nav-" src \
  --include="*.tsx" --include="*.ts" --include="*.scss" 2>/dev/null \
  | grep -v -E "src/components/navigation/|src/pages/channels/Channel.tsx|src/pages/settings/Settings.module.scss|src/context/")
if [ -n "$HITS" ]; then
  echo "nav-* tokens used outside navigation surfaces:"; echo "$HITS"; FAIL=1
fi

# raw nav-family hexes anywhere in src (should use tokens)
HITS=$(grep -rln -iE "#100518|#1C1720|#23172B" src \
  --include="*.tsx" --include="*.scss" 2>/dev/null | grep -v "src/context/")
if [ -n "$HITS" ]; then
  echo "raw nav-family hex outside theme definitions:"; echo "$HITS"; FAIL=1
fi

[ $FAIL -eq 0 ] && echo "surfaces OK"
exit $FAIL
