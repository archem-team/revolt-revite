FROM node:24-bookworm-slim AS builder
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

COPY . .
COPY .env.build ./.env

# RUN yarn typecheck # lol no
# Build submodules once, then vite build directly. build:ci avoids re-running
# `yarn install` and `build:deps` (which yarn build/build:highmem would repeat).
RUN NODE_OPTIONS='--max-old-space-size=12288' yarn build:deps
RUN NODE_OPTIONS='--max-old-space-size=12288' yarn build:ci
RUN yarn workspaces focus --production --all

FROM node:24-alpine
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app .

EXPOSE 5000
CMD [ "yarn", "start:inject" ]
