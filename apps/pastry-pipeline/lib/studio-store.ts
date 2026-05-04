/**
 * Campaign Studio storage. JSON-on-disk for the demo — swap to Postgres at
 * production by replacing readDb/writeDb. Atomic writes via tmp file + rename.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import type {
  CampaignBrief,
  CampaignDetail,
  GeneratedVideo,
  ScheduledPost,
  VeoPrompt,
  VideoJob,
} from "./studio-types";

const DB_DIR = path.join(process.cwd(), "data", "campaigns");
const DB_FILE = path.join(DB_DIR, "studio.json");

type Db = {
  campaigns: CampaignBrief[];
  prompts: VeoPrompt[];
  jobs: VideoJob[];
  videos: GeneratedVideo[];
  posts: ScheduledPost[];
};

function emptyDb(): Db {
  return { campaigns: [], prompts: [], jobs: [], videos: [], posts: [] };
}

function readDb(): Db {
  if (!fs.existsSync(DB_FILE)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(emptyDb(), null, 2));
    return emptyDb();
  }
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Db;
    return {
      campaigns: parsed.campaigns ?? [],
      prompts: parsed.prompts ?? [],
      jobs: parsed.jobs ?? [],
      videos: parsed.videos ?? [],
      posts: parsed.posts ?? [],
    };
  } catch {
    return emptyDb();
  }
}

function writeDb(db: Db) {
  fs.mkdirSync(DB_DIR, { recursive: true });
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

// Coarse mutex via a module-scope queue so concurrent route handlers don't
// stomp on each other when both rewrite the same JSON.
let mutex: Promise<unknown> = Promise.resolve();
function withDb<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  const next = mutex.then(async () => {
    const db = readDb();
    const out = await fn(db);
    writeDb(db);
    return out;
  });
  mutex = next.catch(() => undefined);
  return next as Promise<T>;
}

export async function listCampaigns(): Promise<CampaignBrief[]> {
  return withDb((db) => db.campaigns.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

export async function getCampaignDetail(id: string): Promise<CampaignDetail | null> {
  return withDb((db) => {
    const brief = db.campaigns.find((c) => c.id === id);
    if (!brief) return null;
    const prompts = db.prompts.filter((p) => p.campaignId === id).sort((a, b) => a.index - b.index);
    const jobs = db.jobs.filter((j) => j.campaignId === id);
    const videos = db.videos.filter((v) => v.campaignId === id);
    const posts = db.posts.filter((p) => p.campaignId === id);
    return {
      brief,
      prompts,
      jobs,
      videos,
      scheduledPosts: posts,
      stats: {
        totalPrompts: prompts.length,
        totalJobs: jobs.length,
        completedJobs: jobs.filter((j) => j.status === "succeeded").length,
        failedJobs: jobs.filter((j) => j.status === "failed").length,
        runningJobs: jobs.filter((j) => j.status === "running").length,
        queuedJobs: jobs.filter((j) => j.status === "queued").length,
        videosReady: videos.length,
        videosApproved: videos.filter((v) => v.verdict === "approved").length,
        videosRejected: videos.filter((v) => v.verdict === "rejected").length,
        videosStarred: videos.filter((v) => v.verdict === "starred").length,
        postsScheduled: posts.filter((p) => p.status === "scheduled").length,
        postsPublished: posts.filter((p) => p.status === "posted").length,
      },
    };
  });
}

export async function createCampaign(brief: CampaignBrief, prompts: VeoPrompt[]): Promise<void> {
  await withDb((db) => {
    db.campaigns.push(brief);
    db.prompts.push(...prompts);
  });
}

export async function updateCampaign(
  id: string,
  patch: Partial<CampaignBrief>,
): Promise<CampaignBrief | null> {
  return withDb((db) => {
    const idx = db.campaigns.findIndex((c) => c.id === id);
    if (idx < 0) return null;
    db.campaigns[idx] = { ...db.campaigns[idx], ...patch };
    return db.campaigns[idx];
  });
}

export async function addJobs(jobs: VideoJob[]): Promise<void> {
  await withDb((db) => { db.jobs.push(...jobs); });
}

export async function updateJob(id: string, patch: Partial<VideoJob>): Promise<VideoJob | null> {
  return withDb((db) => {
    const idx = db.jobs.findIndex((j) => j.id === id);
    if (idx < 0) return null;
    db.jobs[idx] = { ...db.jobs[idx], ...patch };
    return db.jobs[idx];
  });
}

export async function addVideo(video: GeneratedVideo): Promise<void> {
  await withDb((db) => { db.videos.push(video); });
}

export async function setVerdict(
  videoId: string,
  verdict: GeneratedVideo["verdict"],
  note?: string,
): Promise<GeneratedVideo | null> {
  return withDb((db) => {
    const idx = db.videos.findIndex((v) => v.id === videoId);
    if (idx < 0) return null;
    db.videos[idx] = {
      ...db.videos[idx],
      verdict,
      reviewedAt: new Date().toISOString(),
      reviewerNote: note ?? db.videos[idx].reviewerNote,
    };
    return db.videos[idx];
  });
}

export async function listPendingJobs(): Promise<VideoJob[]> {
  return withDb((db) => db.jobs.filter((j) => j.status === "queued" || j.status === "running"));
}

export async function schedulePost(post: ScheduledPost): Promise<void> {
  await withDb((db) => { db.posts.push(post); });
}

export async function updatePost(id: string, patch: Partial<ScheduledPost>): Promise<ScheduledPost | null> {
  return withDb((db) => {
    const idx = db.posts.findIndex((p) => p.id === id);
    if (idx < 0) return null;
    db.posts[idx] = { ...db.posts[idx], ...patch };
    return db.posts[idx];
  });
}
