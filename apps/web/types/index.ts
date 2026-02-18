// ============================================
// Straude — Shared TypeScript Types
// ============================================

export interface User {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  country: string | null;
  region: string | null;
  link: string | null;
  github_username: string | null;
  is_public: boolean;
  timezone: string;
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
  comment_count?: number;
  has_kudosed?: boolean;
}

export interface Comment {
  id: string;
  user_id: string;
  post_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user?: User;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface Kudos {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
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

// API request/response types
export interface UsageSubmitRequest {
  entries: Array<{
    date: string;
    data: CcusageDailyEntry;
  }>;
  hash?: string;
  source: "cli" | "web";
}

export interface UsageSubmitResponse {
  results: Array<{
    date: string;
    usage_id: string;
    post_id: string;
    post_url: string;
  }>;
}

export interface FeedResponse {
  posts: Post[];
  next_cursor?: string;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  user_rank?: number;
  next_cursor?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string;
  type: "follow" | "kudos" | "comment";
  post_id: string | null;
  comment_id: string | null;
  read: boolean;
  created_at: string;
  actor?: Pick<User, "username" | "avatar_url">;
}

export interface WallOfLovePost {
  url: string;
  author_name: string;
  author_handle: string;
  author_avatar?: string;
  text: string;
  date: string;
}
