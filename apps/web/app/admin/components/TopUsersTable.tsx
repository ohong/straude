"use client";

import { formatTokens } from "@/lib/utils/format";
import { useAdminTheme } from "./AdminShell";

interface TopUser {
  user_id: string;
  username: string;
  avatar_url: string | null;
  total_spend: number;
  total_tokens: number;
  usage_days: number;
  last_active: string;
  signed_up: string;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function TopUsersTable({ users }: { users: TopUser[] }) {
  const { theme } = useAdminTheme();

  return (
    <div className="admin-card">
      <div className="px-5 pt-4 pb-2">
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--admin-fg)" }}
        >
          Top Users
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr
              style={{
                borderBottom: "1px solid var(--admin-border)",
                color: "var(--admin-fg-muted)",
              }}
            >
              <th className="px-5 py-2.5 text-xs font-medium uppercase tracking-wider">
                #
              </th>
              <th className="px-5 py-2.5 text-xs font-medium uppercase tracking-wider">
                User
              </th>
              <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wider">
                Spend
              </th>
              <th className="hidden px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wider sm:table-cell">
                Tokens
              </th>
              <th className="hidden px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wider md:table-cell">
                Days
              </th>
              <th className="hidden px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wider md:table-cell">
                Last Active
              </th>
              <th className="hidden px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wider lg:table-cell">
                Joined
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, i) => (
              <tr
                key={user.user_id}
                style={{ borderBottom: "1px solid var(--admin-border)" }}
                className="transition-colors duration-75"
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor =
                    "var(--admin-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
              >
                <td
                  className="px-5 py-3 font-mono text-xs"
                  style={{ color: "var(--admin-fg-muted)" }}
                >
                  {i + 1}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt=""
                        width={24}
                        height={24}
                        className="rounded-full"
                      />
                    ) : (
                      <div
                        className="h-6 w-6 rounded-full"
                        style={{ backgroundColor: "var(--admin-bar-track)" }}
                      />
                    )}
                    <span
                      className="text-sm font-medium"
                      style={{ color: "var(--admin-fg)" }}
                    >
                      {user.username}
                    </span>
                  </div>
                </td>
                <td
                  className="px-5 py-3 text-right font-mono text-sm font-medium tabular-nums"
                  style={{ color: "var(--admin-accent)" }}
                >
                  ${user.total_spend.toFixed(2)}
                </td>
                <td
                  className="hidden px-5 py-3 text-right font-mono text-sm tabular-nums sm:table-cell"
                  style={{ color: "var(--admin-fg-secondary)" }}
                >
                  {formatTokens(user.total_tokens)}
                </td>
                <td
                  className="hidden px-5 py-3 text-right font-mono text-sm tabular-nums md:table-cell"
                  style={{ color: "var(--admin-fg-secondary)" }}
                >
                  {user.usage_days}
                </td>
                <td
                  className="hidden px-5 py-3 text-right text-xs md:table-cell"
                  style={{ color: "var(--admin-fg-muted)" }}
                >
                  {formatDate(user.last_active)}
                </td>
                <td
                  className="hidden px-5 py-3 text-right text-xs lg:table-cell"
                  style={{ color: "var(--admin-fg-muted)" }}
                >
                  {formatDate(user.signed_up)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
