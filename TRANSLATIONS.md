# Translation Workflow Guide

This guide explains how to add new translations or modify existing ones in the Revite project.

## Overview

Translations are stored in the `external/lang` submodule, which points to the `archem-team/translations` repository on the `revite-backports` branch.

## Prerequisites

1. Ensure you have access to the `archem-team/translations` repository
2. Make sure your submodules are initialized and up to date:
   ```bash
   git submodule update --init --recursive
   ```

## Step-by-Step Instructions

### 1. Navigate to the Translations Submodule

```bash
cd external/lang
```

### 2. Ensure You're on the Correct Branch

The submodule should be on the `revite-backports` branch:

```bash
git checkout revite-backports
git pull origin revite-backports
```

### 3. Verify the Remote URL

Make sure the remote is pointing to the correct repository:

```bash
git remote -v
```

It should show:
```
origin  https://github.com/archem-team/translations (fetch)
origin  https://github.com/archem-team/translations (push)
```

If it's incorrect, update it:
```bash
git remote set-url origin https://github.com/archem-team/translations
```

### 4. Make Your Translation Changes

Edit the appropriate language file(s). Translation files are JSON files named by language code (e.g., `en.json`, `es.json`, `fr.json`).

**Example:** To update English translations, edit `en.json`:
```bash
# Use your preferred editor
code en.json
# or
vim en.json
```

**Important Notes:**
- Keep the JSON structure intact
- Ensure valid JSON syntax (commas, quotes, etc.)
- Follow the existing translation key structure
- For new keys, add them to all language files or at least to `en.json` as a base

### 5. Review Your Changes

```bash
git status
git diff
```

### 6. Commit Changes to the Translations Repository

```bash
git add <modified-files>
git commit -m "feat: add/update translations for [language/feature]"
```

**Good commit message examples:**
- `feat: add Spanish translations for new settings`
- `fix: correct typo in French login messages`
- `update: sync English translations with latest changes`

### 7. Push to the Translations Repository

```bash
git push origin revite-backports
```

**Important:** Always push to the `revite-backports` branch, not `master` or other branches.

### 8. Update the Parent Repository

After pushing translation changes, you need to update the parent repository to reference the new commit:

```bash
# Go back to the parent repository root
cd ../..

# Check the status - you should see external/lang as modified
git status

# Stage the submodule update
git add external/lang

# Commit the submodule reference update
git commit -m "chore: bump lang submodule to [commit-hash or brief description]"

# Push to the parent repository
git push origin master
```

**Example commit message:**
```bash
git commit -m "chore: bump lang submodule to include new Spanish translations"
```

## Complete Workflow Example

Here's a complete example of adding a new translation:

```bash
# 1. Navigate to submodule
cd external/lang

# 2. Ensure on correct branch
git checkout revite-backports
git pull origin revite-backports

# 3. Make changes
# Edit en.json, es.json, etc. with your editor

# 4. Commit and push to translations repo
git add en.json es.json
git commit -m "feat: add translations for new feature X"
git push origin revite-backports

# 5. Update parent repository
cd ../..
git add external/lang
git commit -m "chore: bump lang submodule for new feature translations"
git push origin master
```

## Troubleshooting

### Submodule is Detached HEAD

If you see "HEAD detached" when checking out:
```bash
cd external/lang
git checkout revite-backports
```

### Remote URL is Wrong

If the remote points to the wrong repository:
```bash
cd external/lang
git remote set-url origin https://github.com/archem-team/translations
git fetch origin
```

### Submodule is Out of Sync

If the submodule reference is outdated:
```bash
# From the parent repository root
git submodule update --init --recursive
cd external/lang
git checkout revite-backports
git pull origin revite-backports
```

### Can't Push to Translations Repository

If you get permission errors:
- Verify you have write access to `archem-team/translations`
- Check that you're authenticated with GitHub
- Ensure you're pushing to the correct branch (`revite-backports`)

## Best Practices

1. **Always work on the `revite-backports` branch** - Never commit directly to `master` in the submodule
2. **Test your JSON syntax** - Invalid JSON will break the application
3. **Keep translations in sync** - When adding new keys, add them to all language files or at least document which languages need updates
4. **Use descriptive commit messages** - Help others understand what changed
5. **Update the parent repo immediately** - Don't leave submodule updates uncommitted
6. **Pull before pushing** - Always pull latest changes before making edits to avoid conflicts

## Quick Reference

| Task | Command |
|------|---------|
| Navigate to translations | `cd external/lang` |
| Check current branch | `git branch` |
| Switch to correct branch | `git checkout revite-backports` |
| Pull latest changes | `git pull origin revite-backports` |
| Check status | `git status` |
| View changes | `git diff` |
| Commit changes | `git add <files>` then `git commit -m "message"` |
| Push to translations repo | `git push origin revite-backports` |
| Update parent repo | `cd ../..` then `git add external/lang` then `git commit -m "message"` then `git push` |

## Additional Resources

- Translation files are located in: `external/lang/`
- Main English file: `external/lang/en.json`
- Submodule repository: https://github.com/archem-team/translations
- Working branch: `revite-backports`
