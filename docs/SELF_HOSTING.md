# Self-hosting (local Docker)

Run the app on your machine with **no Convex Cloud, Polar, or Google OAuth**. Auth is email/password only, billing is disabled, and Convex is self-hosted using their wonderful [guide](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md).

This stack is meant for **LAN / local** hosting (one machine or a few devices on your network). It is **not** intended for hosting in the cloud for several remote users — ports are exposed directly, with no reverse proxy or TLS terminator sitting in front of it.

Clone-and-run and Portainer both use the same root [`docker-compose.yml`](../docker-compose.yml). Images for `web` and `deploy` are **built on the host**.

## Defaults

| Service             | URL                         |
| ------------------- | --------------------------- |
| App                 | http://`<PUBLIC_HOST>`:8088 |
| Convex API          | http://`<PUBLIC_HOST>`:3210 |
| Convex HTTP actions | http://`<PUBLIC_HOST>`:3211 |
| Convex dashboard    | http://`<PUBLIC_HOST>`:6791 |

Data persists in the Docker volume `convex-data`.

## `PUBLIC_HOST`

Hostname or LAN IP that **browsers** use to reach the server (not a Docker service name).

| Where you open the app    | `PUBLIC_HOST`       |
| ------------------------- | ------------------- |
| Same machine as Docker    | `localhost`         |
| Other devices on your LAN | e.g. `192.168.1.50` |

## Option A — Clone and run

Requires Docker Compose v2 and enough RAM to build (see below).

```bash
git clone <your-fork-or-repo-url>
cd <repo>
cp example.env .env   # set PUBLIC_HOST if needed
docker compose up -d --build
```

```bash
docker compose logs -f deploy
docker compose logs -f web
docker compose down             # stop (keeps volume)
docker compose down -v          # stop and wipe data
```

## Option B — Portainer

1. Stacks → **Add stack** → **Repository**
2. Repository URL: `https://github.com/mjf1406/vctr`
3. Repository Reference: `refs/heads/master`
4. Compose path: `docker-compose.yml`
5. Environment variables → **Load variables from .env file** → upload [`example.env`](../example.env) (edit `PUBLIC_HOST` first if needed)
6. Deploy and wait for the `web` **build** and `deploy` one-shot to finish
7. Open `http://<PUBLIC_HOST>:8088` and create an email/password account (the **first** account becomes the instance admin)

Default app port is **8088** (8080 is often used by qBittorrent and similar). Override with `WEB_PORT` if needed.

### Clean rebuild after compose/Dockerfile changes

Portainer often reuses old layers/images. If a deploy fails or you pulled new git commits:

1. Remove the stack (keep the volume if you want data).
2. Optionally prune unused build cache/images on the host:

   ```bash
   docker builder prune -f
   docker image prune -f
   ```

3. Redeploy the stack so `web` / `deploy` rebuild from the current Dockerfile.

Deleting unused images frees **disk** and forces a clean rebuild — do that after Dockerfile changes.

## Uninstall / wipe data

Wiping removes all classroom data (users, classes, uploads). A later deploy starts a fresh empty instance. Stopping without `-v` (or without deleting the volume) keeps data.

### Clone and run

```bash
cd <repo>
docker compose down             # stop (keeps volume)
docker compose down -v          # stop and wipe the convex-data volume
```

Optional: delete the host `.env`, and prune unused images/cache if you no longer need the build artifacts:

```bash
docker builder prune -f
docker image prune -f
```

### Portainer

1. Remove the stack.
2. To wipe data, also delete the Docker volume (typically `<stack-name>_convex-data`). Removing the stack alone keeps the volume.
3. Optionally prune unused build cache/images on the host (same commands as above).

## Upgrading

When a new GitHub Release is published, self-hosted instances show an in-app banner linking here if the running version is older than GitHub’s latest release tag.

The web image stamps its version at build time automatically — you do **not** need to set `APP_VERSION` in Portainer or Compose. Resolution order:

1. Explicit `APP_VERSION` / `VITE_APP_VERSION` (optional override)
2. Nearest git tag (`git describe`, after fetching tags — covers Portainer shallow clones)
3. Committed [`VERSION`](../VERSION) file (auto-updated by the Electron release workflow when you push a `v*` tag)

Optional: set `APP_VERSION` (semver **without** a leading `v`) only to override. The banner stays off only when no version can be resolved (build log will warn and show `VITE_APP_VERSION=0.0.0`).

Data lives in the `convex-data` volume — keep that volume when rebuilding.

The `deploy` service pushes Convex functions when the deploy marker changes. That marker includes a hash of `convex/` source, so backend code updates redeploy even when the app version is unchanged. If the SPA calls a function the backend does not know (e.g. `Could not find public function for 'presence:heartbeat'`), rebuild/redeploy so `deploy` runs again:

```bash
docker compose up -d --build deploy web
# or force one shot:
docker compose run --rm deploy
```

### Docker Compose

```bash
cd <repo>
git fetch --tags
git checkout v0.1.0   # or: git pull on the branch you track
docker compose up -d --build
```

Confirm the stack is healthy (`docker compose logs -f deploy` / `web`) and open the app. You should no longer see an update banner for that version. Check the `web` **build** log (not nginx access logs) for `Building with VITE_APP_VERSION=…` if the banner never appears.

### Portainer

1. Stacks → your stack → **Editor** (or recreate from **Repository**).
2. Pull the latest compose from the repo, or set **Repository Reference** to the release tag (e.g. `refs/tags/v0.1.0`).
3. Leave `APP_VERSION` unset — the image resolves version from git tags or the committed `VERSION` file.
4. **Update the stack** so `web` / `deploy` rebuild.

If Portainer reuses stale layers after a Dockerfile or dependency change, follow [Clean rebuild after compose/Dockerfile changes](#clean-rebuild-after-composedockerfile-changes) (remove stack keeping the volume, prune build cache/images, redeploy).

## Instance secret

`INSTANCE_NAME` and `INSTANCE_SECRET` identify the Convex instance. Changing them after the first start invalidates the admin key and can strand data. The compose default secret is for **local-only** use. For any shared or exposed host, set a fresh secret (`openssl rand -hex 32`) before the first start.

## What differs from cloud

|          | Cloud                      | Self-host                   |
| -------- | -------------------------- | --------------------------- |
| Backend  | Convex Cloud               | Convex in Docker            |
| Auth     | Google (optional password) | Password only               |
| Billing  | Polar + trial              | Always entitled / Polar off |
| SPA host | e.g. Cloudflare Pages      | nginx in Compose            |

## Instance admin (password resets)

The **first** email/password account created on a fresh instance is granted the global `app_admin` role. That user sees **Admin** in the nav and can set a temporary password for any user who forgot theirs (all of that user’s sessions are signed out).

Upgrading an existing instance that already has users (and no admin) — or recovering after losing the admin account — use the Convex CLI against the local deployment:

```bash
bunx convex run lib/admin:grantAppAdmin '{"userId":"<convex-user-id>"}'
```

(PowerShell: escape the JSON as `'{\"userId\":\"...\"}'`.)

## Dashboard admin key

Portainer names the project from the stack name (e.g. `classclarus`), so plain `docker compose exec` from your home directory often fails with “no configuration file provided”. Prefer the container name:

```bash
sudo docker exec classclarus-backend-1 cat /convex/data/admin_key
```

Or pass the Portainer project/stack name:

```bash
sudo docker compose -p classclarus exec backend cat /convex/data/admin_key
```

(If you used `docker compose` from a local clone, `docker compose exec backend cat /convex/data/admin_key` works inside that directory.)

Paste that key into http://`<PUBLIC_HOST>`:6791 when prompted.
