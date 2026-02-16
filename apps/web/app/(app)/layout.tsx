import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/app/shared/Sidebar";
import { RightSidebar } from "@/components/app/shared/RightSidebar";
import { MobileNav } from "@/components/app/shared/MobileNav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <>
      <div className="mx-auto flex h-screen w-full max-w-[1600px] border-x border-border">
        {/* Left sidebar — hidden below lg */}
        <aside className="hidden w-60 shrink-0 border-r border-border lg:flex lg:flex-col">
          <Sidebar username={profile?.username} />
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {children}
        </main>

        {/* Right sidebar — hidden below xl */}
        <aside className="hidden w-80 shrink-0 border-l border-border xl:flex xl:flex-col">
          <RightSidebar userId={user.id} />
        </aside>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav username={profile?.username} />
    </>
  );
}
