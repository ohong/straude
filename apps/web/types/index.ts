// ============================================
// Straude — Shared TypeScript Types
// ============================================

export interface User {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  heard_about: string | null;
  avatar_url: string | null;
  country: string | null;
  region: string | null;
  link: string | null;
  github_username: string | null;
  is_public: boolean;
  timezone: string;
  email_notifications: boolean;
  email_mention_notifications: boolean;
  email_dm_notifications?: boolean;
  streak_freezes: number;
  referred_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyUsage {
  id: string;
  user_id: string;
  date: string;
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  total_tokens: number;
  models: string[];
  model_breakdown: ModelBreakdownEntry[] | null;
  session_count: number;
  is_verified: boolean;
  raw_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  user_id: string;
  daily_usage_id: string;
  title: string | null;
  description: string | null;
  images: string[];
  created_at: string;
  updated_at: string;
  // Joined fields
  user?: User;
  daily_usage?: DailyUsage;
  kudos_count?: number;
  kudos_users?: Array<Pick<User, "avatar_url" | "username">>;
  comment_count?: number;
  recent_comments?: Array<Comment>;
  has_kudosed?: boolean;
}

export interface Comment {
  id: string;
  user_id: string;
  post_id: string;
  parent_comment_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  user?: User;
  reaction_count?: number;
  has_reacted?: boolean;
  reply_count?: number;
  replies?: Comment[];
}

export interface LeaderboardEntry {
  user_id: string;
  username: string;
  avatar_url: string | null;
  country: string | null;
  region: string | null;
  total_cost: number;
  total_output_tokens: number;
  streak: number;
  rank: number;
}

export interface ContributionDay {
  date: string;
  cost_usd: number;
  has_post: boolean;
}

// Model breakdown for multi-source usage (Claude + Codex)
export interface ModelBreakdownEntry {
  model: string;
  cost_usd: number;
}

// ccusage integration types
export interface CcusageDailyEntry {
  date: string;
  models: string[];
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  costUSD: number;
  modelBreakdown?: ModelBreakdownEntry[];
}

export interface CcusageOutput {
  type: "daily";
  data: CcusageDailyEntry[];
  summary: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCacheCreationTokens: number;
    totalCacheReadTokens: number;
    totalTokens: number;
    totalCostUSD: number;
  };
}

export interface DeviceUsage {
  id: string;
  user_id: string;
  device_id: string;
  device_name: string | null;
  date: string;
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  total_tokens: number;
  models: string[];
  model_breakdown: ModelBreakdownEntry[] | null;
  session_count: number;
  raw_hash: string | null;
  created_at: string;
  updated_at: string;
}

// API request/response types
export interface UsageSubmitRequest {
  entries: Array<{
    date: string;
    data: CcusageDailyEntry;
  }>;
  hash?: string;
  source: "cli" | "web";
  device_id?: string;
  device_name?: string;
}

export interface UsageSubmitResponse {
  results: Array<{
    date: string;
    usage_id: string;
    post_id: string;
    post_url: string;
    action: "created" | "updated";
  }>;
}

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string;
  type: "follow" | "kudos" | "comment" | "mention" | "message" | "referral";
  post_id: string | null;
  comment_id: string | null;
  read: boolean;
  created_at: string;
  actor?: Pick<User, "username" | "avatar_url">;
}

export interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
  sender?: Pick<User, "id" | "username" | "avatar_url" | "display_name">;
  recipient?: Pick<User, "id" | "username" | "avatar_url" | "display_name">;
}

export interface DirectMessageThread {
  counterpart_id: string;
  counterpart_username: string | null;
  counterpart_avatar_url: string | null;
  counterpart_display_name: string | null;
  last_message_id: string;
  last_message_content: string;
  last_message_created_at: string;
  last_message_sender_id: string;
  last_message_is_from_me: boolean;
  unread_count: number;
}

export type PromptSubmissionStatus =
  | "new"
  | "accepted"
  | "in_progress"
  | "rejected"
  | "shipped";

export interface PromptSubmission {
  id: string;
  user_id: string;
  prompt: string;
  is_anonymous: boolean;
  status: PromptSubmissionStatus;
  is_public: boolean;
  is_hidden: boolean;
  admin_notes: string | null;
  pr_url: string | null;
  shipped_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  user?: Pick<User, "username" | "display_name" | "avatar_url">;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_slug: string;
  earned_at: string;
}

export interface WallOfLovePost {
  url: string;
  author_name: string;
  author_handle: string;
  author_avatar?: string;
  text: string;
  date: string;
}
