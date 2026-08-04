FROM node:24-bookworm-slim AS builder
ARG RELEASE_ID=local
ENV NODE_OPTIONS="--max_old_space_size=12288"
WORKDIR /usr/src/app

# Install dependencies from manifests only, so this (slowest) layer is reused
# from cache unless the lockfile/manifests change. The portal packages
# (external/components, external/revolt.js) only need their package.json at
# install time — neither defines install lifecycle scripts.
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn .yarn
COPY external/components/package.json external/components/
COPY external/revolt.js/package.json external/revolt.js/
RUN yarn install --frozen-lockfile

# Build the submodules in their own layer keyed only on submodule sources.
# App-code (src/) changes no longer invalidate this ~3min step — only a real
# change under external/* does. The built outputs (esm/dist) are kept out of
# the later `COPY . .` via .dockerignore so they survive that copy.
COPY external/components external/components
COPY external/revolt.js external/revolt.js
RUN NODE_OPTIONS='--max-old-space-size=12288' yarn build:deps

COPY . .
COPY .env.build ./.env

# RUN yarn typecheck # lol no
# vite build only — build:ci skips the redundant yarn install + build:deps.
RUN NODE_OPTIONS='--max-old-space-size=12288' yarn build:ci
# previous-release is populated by CI from the last successfully published
# image. The merge is bounded by age/count and current assets always win.
RUN RELEASE_ID="$RELEASE_ID" node scripts/merge_release_assets.js && rm -rf previous-release
RUN yarn workspaces focus --production --all

FROM node:24-alpine
ARG RELEASE_ID=local
ENV RELEASE_ID="$RELEASE_ID"
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app .

EXPOSE 5000
CMD [ "yarn", "start:inject" ]
