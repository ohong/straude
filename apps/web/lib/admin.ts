const adminIds = (process.env.ADMIN_USER_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

export const isAdmin = (userId: string) => adminIds.includes(userId);
