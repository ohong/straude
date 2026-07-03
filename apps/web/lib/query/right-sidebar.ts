export interface RightSidebarSuggestedUser {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
}

export interface RightSidebarTopUser {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  total_cost: number | string | null;
}

export interface RightSidebarResponse {
  suggested: RightSidebarSuggestedUser[];
  topUsers: RightSidebarTopUser[];
  totalOutputTokens: number;
}

export async function fetchRightSidebar(): Promise<RightSidebarResponse> {
  const response = await fetch("/api/app/right-sidebar");

  if (!response.ok) {
    throw new Error("Failed to load right sidebar.");
  }

  return response.json();
}
