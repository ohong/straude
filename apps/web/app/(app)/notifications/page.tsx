import { NotificationsList } from "@/components/app/notifications/NotificationsList";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <>
      <header className="sticky top-0 z-10 flex h-16 items-center border-b border-border bg-background px-6">
        <h3 className="text-lg font-medium">Notifications</h3>
      </header>

      <NotificationsList />
    </>
  );
}
