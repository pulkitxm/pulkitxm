#!/usr/bin/env node
// @ts-check

/**
 * Download every `demo.mp4` from the claude-directory repo and upload each to
 * Cloudinary as a video resource, so the site can serve an optimized mp4
 * (f_auto,q_auto) from a CDN instead of raw mp4 off jsDelivr.
 *
 * The Cloudinary public_id is derived deterministically from each project's
 * repo path, so the site builds delivery URLs itself — no manifest needed.
 *
 * Usage:
 *   node index.js            upload everything (skips already-uploaded videos)
 *   node index.js --list     just print the discovered demo videos
 *   node index.js --dry-run  download + report, but do NOT upload
 *   node index.js --force    re-upload even if the asset already exists
 *
 * Required env (see .env.example):
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 * Optional env:
 *   GITHUB_TOKEN       raises the GitHub API rate limit (recommended)
 *   CLOUDINARY_FOLDER  target folder in Cloudinary (default: claude-directory-demos)
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- config ---------------------------------------------------------------

const REPO_OWNER = "pulkitxm";
const REPO_NAME = "claude-directory";
const BRANCH = "main";

const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || "claude-directory-demos";

// The site delivers a plain optimized mp4 with this transform.
const CLOUDINARY_DELIVERY_TRANSFORM = "f_auto,q_auto";

const DOWNLOAD_DIR = path.join(__dirname, "downloads");
const OUTPUT_FILE = path.join(__dirname, "uploads.json");

const args = new Set(process.argv.slice(2));
const FLAG_LIST = args.has("--list");
const FLAG_DRY_RUN = args.has("--dry-run");
const FLAG_FORCE = args.has("--force");

// ---- helpers --------------------------------------------------------------

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.CLAUDE_DIRECTORY_GITHUB_TOKEN;

function githubHeaders() {
  /** @type {Record<string,string>} */
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "video-demos-cloud-directory" };
  if (GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }
  return headers;
}

function encodePathSegments(p) {
  return p.split("/").map(encodeURIComponent).join("/");
}

/**
 * Build the Cloudinary public_id (sans folder) from the repo directory.
 *
 * IMPORTANT: the website must compute the EXACT same id from its own
 * `category` + `slug` for the "no future code changes" contract to hold.
 * The transform is: join repo path segments with "__", then sanitize to a
 * safe charset (lowercase alnum + "_" + "-"), collapsing anything else to "-".
 * This handles real-world folder names with spaces, e.g.
 *   "hero-sections/vanguard hero landing/demo.mp4"
 *     -> "hero-sections__vanguard-hero-landing"
 *
 * Site side (src/lib/claude-directory.ts) must mirror this:
 *   const raw = category ? `${category}/${slug}` : slug;
 *   const id  = raw.replace(/\//g, "__").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
 */
function publicIdFor(repoDir) {
  return repoDir
    .replace(/\//g, "__")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function log(...m) {
  console.log(...m);
}

function fail(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

// ---- step 1: discover demo videos via the GitHub git tree API -------------

async function discoverDemoVideos() {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${BRANCH}?recursive=1`;
  const res = await fetch(url, { headers: githubHeaders() });
  if (!res.ok) {
    if (res.status === 403) {
      fail(`GitHub API rate limited (403). Set GITHUB_TOKEN in your .env to raise the limit.`);
    }
    fail(`GitHub tree request failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  if (data.truncated) {
    log("⚠ GitHub tree response was truncated; some videos may be missing.");
  }

  /** @type {{repoDir:string, repoPath:string, rawUrl:string, size:number, publicId:string}[]} */
  const videos = [];
  for (const entry of data.tree) {
    if (entry.type !== "blob" || !entry.path.endsWith("/demo.mp4")) {
      continue;
    }
    const repoPath = entry.path;
    const repoDir = repoPath.slice(0, -"/demo.mp4".length);
    videos.push({
      repoDir,
      repoPath,
      rawUrl: `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${encodePathSegments(repoPath)}`,
      size: entry.size ?? 0,
      publicId: publicIdFor(repoDir),
    });
  }
  videos.sort((a, b) => a.repoPath.localeCompare(b.repoPath));
  return videos;
}

// ---- step 2: download an mp4 ----------------------------------------------

async function downloadVideo(video) {
  const dest = path.join(DOWNLOAD_DIR, `${video.publicId}.mp4`);
  const res = await fetch(video.rawUrl, { headers: githubHeaders() });
  if (!res.ok || !res.body) {
    fail(`Download failed for ${video.repoPath}: ${res.status} ${res.statusText}`);
  }
  await pipeline(res.body, createWriteStream(dest));
  return dest;
}

// ---- step 3: upload to Cloudinary + build the delivery URL ----------------

// Fetch every already-uploaded video public_id in the target folder in a single
// paginated pass (~100 per page). One bulk listing instead of one Admin API call
// per video — critical for staying under Cloudinary's ~500/hr API operation cap.
// Returns a Set of full public_ids ("<folder>/<id>").
async function fetchExistingPublicIds() {
  const existing = new Set();
  let nextCursor;
  do {
    const res = await cloudinary.api.resources({
      resource_type: "video",
      type: "upload",
      prefix: `${CLOUDINARY_FOLDER}/`,
      max_results: 500,
      next_cursor: nextCursor,
    });
    for (const r of res.resources ?? []) {
      existing.add(r.public_id);
    }
    nextCursor = res.next_cursor;
  } while (nextCursor);
  return existing;
}

async function uploadVideo(localPath, publicId) {
  // The site delivers a plain optimized mp4 (f_auto,q_auto) from this asset, so
  // we just upload the source video — no streaming rendition needed.
  return cloudinary.uploader.upload(localPath, {
    resource_type: "video",
    public_id: publicId,
    folder: CLOUDINARY_FOLDER,
    overwrite: true,
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Retry transient Cloudinary errors (timeouts, 5xx, and the occasional
// signature/"unsigned upload" hiccup). Permanent 4xx errors fail fast.
async function uploadWithRetry(localPath, publicId, attempts = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await uploadVideo(localPath, publicId);
    } catch (err) {
      lastErr = err;
      const code = err?.http_code ?? err?.error?.http_code;
      const retriable = !code || code >= 500 || code === 400 || code === 420 || code === 429;
      if (!retriable || attempt === attempts) {
        throw err;
      }
      await sleep(1000 * attempt);
    }
  }
  throw lastErr;
}

function mp4Url(publicId) {
  return cloudinary.url(`${CLOUDINARY_FOLDER}/${publicId}`, {
    resource_type: "video",
    transformation: [{ fetch_format: "auto", quality: "auto" }],
    format: "mp4",
    secure: true,
  });
}

// ---- main -----------------------------------------------------------------

async function main() {
  log(`\nclaude-directory → Cloudinary mp4\n${"=".repeat(40)}`);

  const videos = await discoverDemoVideos();
  log(`Found ${videos.length} demo video(s) in ${REPO_OWNER}/${REPO_NAME}.\n`);

  if (FLAG_LIST) {
    for (const v of videos) {
      log(`  ${v.repoPath}  (${(v.size / 1024 / 1024).toFixed(1)} MB)`);
    }
    return;
  }

  if (!FLAG_DRY_RUN) {
    for (const key of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]) {
      if (!process.env[key]) {
        fail(`Missing required env var: ${key}. See .env.example.`);
      }
    }
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }

  await mkdir(DOWNLOAD_DIR, { recursive: true });

  // Resume support: keep a record of what we've uploaded.
  /** @type {Record<string, any>} */
  let results = {};
  try {
    results = JSON.parse(await readFile(OUTPUT_FILE, "utf8"));
  } catch {
    results = {};
  }

  // One bulk listing of what's already uploaded, so we skip locally instead of
  // making an Admin API call per video (which blows the ~500/hr quota).
  /** @type {Set<string>} */
  let existingPublicIds = new Set();
  if (!FLAG_DRY_RUN && !FLAG_FORCE) {
    log("Fetching list of already-uploaded videos…");
    existingPublicIds = await fetchExistingPublicIds();
    log(`Found ${existingPublicIds.size} already on Cloudinary.\n`);
  }

  let uploaded = 0;
  let skipped = 0;
  /** @type {string[]} */
  const failures = [];

  for (const [i, video] of videos.entries()) {
    const prefix = `[${i + 1}/${videos.length}] ${video.repoDir}`;

    try {
      if (!FLAG_FORCE && !FLAG_DRY_RUN && existingPublicIds.has(`${CLOUDINARY_FOLDER}/${video.publicId}`)) {
        results[video.repoDir] = { ...results[video.repoDir], deliveryUrl: mp4Url(video.publicId), publicId: `${CLOUDINARY_FOLDER}/${video.publicId}` };
        skipped++;
        continue;
      }

      log(`${prefix} — downloading…`);
      const localPath = await downloadVideo(video);

      if (FLAG_DRY_RUN) {
        log(`${prefix} — dry-run, downloaded to ${path.relative(__dirname, localPath)} (not uploading).`);
        continue;
      }

      log(`${prefix} — uploading to Cloudinary…`);
      const res = await uploadWithRetry(localPath, video.publicId);
      const url = mp4Url(video.publicId);
      results[video.repoDir] = {
        repoPath: video.repoPath,
        publicId: res.public_id,
        deliveryUrl: url,
        sourceUrl: res.secure_url,
        bytes: res.bytes,
        duration: res.duration,
      };
      log(`${prefix} ✓ ${url}`);
      uploaded++;
    } catch (err) {
      // Don't let one bad asset abort the whole run — report and move on.
      const msg = err?.error?.message || err?.message || String(err);
      log(`${prefix} ✗ FAILED: ${msg}`);
      failures.push(`${video.repoDir} — ${msg}`);
    }
  }

  if (!FLAG_DRY_RUN) {
    await writeFile(OUTPUT_FILE, JSON.stringify(results, null, 2));
    log(`\n${"=".repeat(40)}`);
    log(`Done. Uploaded ${uploaded}, skipped ${skipped}, failed ${failures.length}.`);
    log(`Manifest written to ${path.relative(__dirname, OUTPUT_FILE)}`);
    if (failures.length > 0) {
      log(`\nFailed (re-run to retry these):`);
      for (const f of failures) {
        log(`  - ${f}`);
      }
      process.exitCode = 1;
    }
  } else {
    log(`\nDry run complete. Downloaded ${videos.length} file(s) to ${path.relative(__dirname, DOWNLOAD_DIR)}.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
