"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

interface Health {
  status: string;
  ping: boolean;
  serverVersion: string;
  readOnly: boolean;
}

export function TopBar({ user }: { user: string }) {
  const router = useRouter();
  const { data, isError } = useQuery({
    queryKey: ["health"],
    queryFn: () => apiFetch<Health>("/api/health"),
    refetchInterval: 30_000,
  });

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  const connected = data?.ping && !isError;

  return (
    <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-3 text-sm">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            connected ? "bg-green-500" : "bg-red-500"
          }`}
          title={connected ? "Connected" : "Disconnected"}
        />
        <span className="text-zinc-500">
          {connected
            ? `MongoDB ${data?.serverVersion ?? ""}`
            : "Not connected"}
        </span>
        {data?.readOnly && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            READ-ONLY
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-zinc-500">{user}</span>
        <button
          onClick={logout}
          className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
