FROM node:16-buster AS builder
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

COPY . .
COPY .env.build ./.env

RUN yarn build:deps
# RUN yarn typecheck # lol no
RUN yarn build:highmem
# previous-release is populated by CI from the last successfully published
# image. The merge is bounded by age/count and current assets always win.
RUN RELEASE_ID="$RELEASE_ID" node scripts/merge_release_assets.js && rm -rf previous-release
RUN yarn workspaces focus --production --all

FROM node:16-alpine
ARG RELEASE_ID=local
ENV RELEASE_ID="$RELEASE_ID"
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app .

EXPOSE 5000
CMD [ "yarn", "start:inject" ]
