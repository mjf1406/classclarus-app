# Electron classroom app

Downloadable desktop build for teachers. It runs the **same self-host mode** as [SELF_HOSTING.md](./SELF_HOSTING.md) (password auth, Polar off, local Convex), without Docker. The installer / Task Manager name comes from [`APP_CONFIG.name`](../convex/appConfig.ts).

Students join from a normal browser on the **same Wi‑Fi**. They do not install Electron.

`post-clone` rewrites `APP_CONFIG` (artifact names, GitHub URLs, userData paths). This file does not need a separate rewrite.

## Downloads

Billing Free card → **Download** dropdown (Windows / Mac / Ubuntu) → direct GitHub **latest** assets via [`src/lib/desktopDownloads.ts`](../src/lib/desktopDownloads.ts) (derived from `APP_CONFIG.github` + `APP_CONFIG.name`).

Release landing page (docs / [`CLONE_CHECKLIST.md`](../CLONE_CHECKLIST.md)): [`APP_CONFIG.downloadUrl`](../convex/appConfig.ts) → `…/releases/latest`.

CI (`.github/workflows/electron-release.yml`) builds Windows, macOS (Apple Silicon), and Linux on version tags `v*` and publishes installers. Artifact names are `${APP_CONFIG.name}-…` via [`electron-builder.config.mjs`](../electron-builder.config.mjs):

| Menu label | Artifact                                                        |
| ---------- | --------------------------------------------------------------- |
| Windows    | `${APP_CONFIG.name}-Setup-Windows.exe`                          |
| Mac        | `${APP_CONFIG.name}-macOS.dmg` / `${APP_CONFIG.name}-macOS.zip` |
| Ubuntu     | `${APP_CONFIG.name}-Linux.AppImage`                             |

Each release also attaches electron-updater feed files (`latest.yml`, `latest-mac.yml`, `latest-linux.yml`) and `.blockmap` files so installed apps can check for updates.

Direct latest asset URL shape:

`{APP_CONFIG.github}/releases/latest/download/<artifact-name>`

## Auto-updates

Packaged builds use `electron-updater` against GitHub Releases:

1. Shortly after the classroom server is running, the app checks for a newer release.
2. If found, it downloads in the background.
3. When ready, teachers get a restart dialog (also **Settings → Updates**).

Dev (`electron:dev`) does not check the network for updates.

**macOS:** auto-update requires a **code-signed** build (`CSC_*` secrets). Unsigned mac builds still install from the DMG, but in-app updates will fail until signing is configured. Windows (NSIS) and Linux (AppImage) update from the public release feed without signing.

## Teacher flow

1. Install and open the app (allows Windows Firewall prompts for the app / ports). A splash window appears while the local Convex backend starts and deploys (first launch can take a minute).
2. Wait until the classroom banner shows **running** and a LAN URL.
3. Create an account (email/password). The **first** account becomes the instance admin and can use **Admin** to set temporary passwords for users who forget theirs (see [SELF_HOSTING.md](./SELF_HOSTING.md#instance-admin-password-resets)).
4. Create a class and a join code; open the projector display or share the QR (uses the LAN URL).
5. Students on the same Wi‑Fi open that URL, create accounts, and redeem the code.

## Network notes

- Guest Wi‑Fi / client isolation blocks student join.
- If DHCP changes the teacher IP, refresh the join link / QR from the banner.
- Use only trusted school or home networks.

## Data & uninstall

Classroom data (local Convex DB, file storage, instance secret) lives under Electron’s `userData` folder in a `classroom/` subdirectory (see [`electron/paths.ts`](../electron/paths.ts)). Folder name follows `APP_CONFIG.name`:

| OS      | Path                                    |
| ------- | --------------------------------------- |
| Windows | `%APPDATA%\<APP_CONFIG.name>\`          |
| macOS   | `~/Library/Application Support/<name>/` |
| Linux   | `~/.config/<name>/`                     |

- **Windows:** the NSIS uninstaller can remove this data. Leave the checkbox unchecked to keep accounts/classes after uninstall; check it for a full wipe. Requires an installer built with `deleteAppDataOnUninstall` (see [`electron-builder.config.mjs`](../electron-builder.config.mjs)).
- **macOS / Linux:** removing the app does **not** delete data. Delete the folder above manually for a full wipe.
- Reinstalling without wiping keeps existing accounts and classes.

## Local development

```bash
bun scripts/download-convex-backend.mjs
bun run electron:dev
```

`electron:dev` starts Vite on **`0.0.0.0:8088`** (LAN-reachable) and the Electron shell. The shell spawns `convex-local-backend` on **3210/3211**, runs the shared bootstrap (`scripts/self-host-bootstrap.mjs`), and exposes `window.classroom` IPC for LAN join URLs.

Allow Windows Firewall prompts for Bun/Node on ports **8088**, **3210**, and **3211** (or add inbound rules). Guest Wi‑Fi / client isolation will still block phones.

## Release

The first downloadable build requires creating a GitHub Release via CI (there are no pre-built binaries until you do this once). Tag the commit that contains the release workflow (current `master`), not an older SHA:

```bash
git checkout master
git pull
git tag -f v0.1.0
git push origin v0.1.0 --force
```

Or Actions → **Electron Release** → Run workflow → version `0.1.0` (no leading `v`). That builds Windows, macOS (Apple Silicon), and Linux, then attaches the installers to the release.

After a successful release, CI commits an updated [`VERSION`](../VERSION) on the default branch so Docker/Portainer self-host builds stamp the new semver without a manual bump.

macOS builds are unsigned unless you add Apple notarization secrets (`CSC_*`); users may need to bypass Gatekeeper once. Auto-update on macOS also requires those signing secrets.
