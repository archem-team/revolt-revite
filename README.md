# PepChat Web

PepChat is the web client for the peptide community at
[peptide.chat](https://peptide.chat). It is built with Preact, Vite, MobX, and
styled-components.

## Quick start

This repository uses Git submodules. Clone it recursively, or initialize the
submodules after cloning.

```bash
git clone --recursive git@github.com:archem-team/revolt-revite.git web-pepchat
cd web-pepchat
yarn
yarn build:deps
yarn dev
```

The development server runs on port 3000.

## Commands

| Command              | Description                                            |
| -------------------- | ------------------------------------------------------ |
| `yarn dev`           | Start the development client.                          |
| `yarn build:deps`    | Build the external UI and API-client dependencies.     |
| `yarn build`         | Create a production build.                             |
| `yarn preview`       | Preview the production build.                          |
| `yarn lint`          | Run ESLint.                                            |
| `yarn lint:branding` | Check production surfaces for upstream branding leaks. |
| `yarn typecheck`     | Run TypeScript type checking.                          |

## Project lineage

PepChat is derived from the open-source Revite client for Revolt. Internal
dependency names and protocol types retain their upstream names for
compatibility. PepChat product copy, support links, and public destinations are
maintained by the Archem team.

## License

This project retains the original copyright notices and is distributed under
the terms in [LICENSE](LICENSE).
