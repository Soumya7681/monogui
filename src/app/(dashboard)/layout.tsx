import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // FR-AUTH-1: unauthenticated users never see dashboard routes.
  const session = await getSession();
  if (!session.isLoggedIn) redirect("/login");

  return (
    <div className="flex min-h-0 flex-1">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar user={session.user ?? ""} />
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
