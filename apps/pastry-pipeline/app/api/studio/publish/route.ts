import { NextRequest, NextResponse } from "next/server";
import { getCampaignDetail, schedulePost, updatePost } from "@/lib/studio-store";
import type { Platform, ScheduledPost } from "@/lib/studio-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stage a publish action. In demo mode this records the post intent and
 * marks it "scheduled" / "posted" instantly. In prod, this is where the
 * Instagram Graph API + TikTok Content Posting API + ayrshare adapters live.
 */
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  const {
    videoId,
    campaignId,
    platforms = ["instagram_reel"] as Platform[],
    scheduledFor,
    captionOverride,
    autoPost = false, // when true, simulate an immediate post
  } = body ?? {};

  if (!videoId || !campaignId) {
    return NextResponse.json({ error: "missing videoId or campaignId" }, { status: 400 });
  }

  const detail = await getCampaignDetail(campaignId);
  if (!detail) return NextResponse.json({ error: "campaign not found" }, { status: 404 });

  const video = detail.videos.find((v) => v.id === videoId);
  if (!video) return NextResponse.json({ error: "video not found in campaign" }, { status: 404 });

  const caption = captionOverride || video.prompt.caption;
  const created: ScheduledPost[] = [];

  for (const platform of platforms as Platform[]) {
    const post: ScheduledPost = {
      id: `post_${videoId}_${platform}_${Date.now().toString(36)}`,
      videoId,
      campaignId,
      platform,
      status: scheduledFor ? "scheduled" : autoPost ? "posted" : "draft",
      scheduledFor,
      postedAt: autoPost ? new Date().toISOString() : undefined,
      externalPostId: autoPost ? `mock_${platform}_${Math.random().toString(36).slice(2, 10)}` : undefined,
      externalPostUrl: autoPost
        ? mockPlatformUrl(platform)
        : undefined,
      caption,
      hashtags: video.prompt.hashtags,
    };
    await schedulePost(post);
    created.push(post);
  }

  return NextResponse.json({ posts: created });
}

export async function PATCH(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const { id, ...patch } = body ?? {};
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const updated = await updatePost(id, patch);
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ post: updated });
}

function mockPlatformUrl(platform: Platform): string {
  switch (platform) {
    case "instagram_reel": return "https://www.instagram.com/p/Cmock0Reel/";
    case "tiktok": return "https://www.tiktok.com/@lafayetteny/video/0000000000";
    case "instagram_story": return "https://www.instagram.com/stories/lafayetteny/";
    case "google_post": return "https://posts.google.com/lafayette";
  }
}
