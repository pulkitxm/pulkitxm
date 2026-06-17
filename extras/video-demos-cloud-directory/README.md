# video-demos-cloud-directory

Tooling to pull every `demo.mp4` out of the
[`pulkitxm/claude-directory`](https://github.com/pulkitxm/claude-directory) repo
and push each one to Cloudinary, so the site serves an optimized mp4
(`f_auto,q_auto`) from a CDN instead of a raw mp4 off jsDelivr.

This folder isn't part of the published GitHub Pages site, but it is committed so
the GitHub Actions workflow (`.github/workflows/upload-video-demos.yml`) can run it.

## How it works

1. Lists the claude-directory git tree via the GitHub API and finds every
   `*/demo.mp4`.
2. Fetches the list of already-uploaded assets in **one** bulk Cloudinary call,
   so re-runs skip existing videos without burning the API quota.
3. Downloads each new mp4 to `downloads/`.
4. Uploads each to Cloudinary as a `video` resource with a **deterministic**
   `public_id` derived from the repo path:

   ```
   repo:  agents/ascii-art/demo.mp4
   id:    claude-directory-demos/agents__ascii-art

   repo:  hero-sections/vanguard hero landing/demo.mp4
   id:    claude-directory-demos/hero-sections__vanguard-hero-landing
   ```

   The id is: join the repo path segments with `__`, lowercase, then replace
   anything outside `[a-z0-9_-]` with `-` and collapse dashes. Flat projects
   with no category are just `<folder>/<slug>`. This sanitization matters
   because some folder names contain spaces.

Because the `public_id` is derived deterministically from the same
`category` + `slug` the site already has, the website builds the Cloudinary mp4
URL itself (`pulkitxm.com` `src/lib/claude-directory.ts` `getProjectDemoUrl`) —
no manifest needed. **Add a project → run this script → done**, no code change.

## Setup

```bash
cd extras/video-demos-cloud-directory
npm install
cp .env.example .env   # fill in your Cloudinary creds
```

### Required env vars

| Var                     | Required | Purpose                                      |
| ----------------------- | -------- | -------------------------------------------- |
| `CLOUDINARY_CLOUD_NAME` | yes      | Cloudinary cloud name                        |
| `CLOUDINARY_API_KEY`    | yes      | Cloudinary API key (needs upload permission) |
| `CLOUDINARY_API_SECRET` | yes      | Cloudinary API secret                        |
| `GITHUB_TOKEN`          | no\*     | Avoid GitHub's 60 req/hr unauth rate limit   |
| `CLOUDINARY_FOLDER`     | no       | Target folder (default `claude-directory-demos`) |

\* Optional but recommended; without it the GitHub tree listing may 403.

## Usage

```bash
npm run list       # just print the discovered demo videos
npm run dry-run    # download everything, but do not upload
npm start          # download + upload (skips assets already on Cloudinary)
node index.js --force   # re-upload even if the asset already exists
```

One failed upload no longer aborts the run — failures are retried (transient
errors) and then reported at the end, with a non-zero exit so you know to re-run.

After a real run, `uploads.json` holds a `repoPath → { publicId, deliveryUrl, … }`
map for reference. The site does **not** need this file — it derives URLs itself.

## GitHub Actions

`.github/workflows/upload-video-demos.yml` runs this on demand
(`workflow_dispatch`) with two inputs:

- **dry_run** — download but don't upload (preview what's new).
- **force** — re-upload even if the asset already exists.

It reads the Cloudinary creds and `CLAUDE_DIRECTORY_GITHUB_TOKEN` from repo
secrets. Trigger it from the Actions tab.
