import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();
  if (session.isLoggedIn) redirect("/");

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Mongui</h1>
          <p className="mt-1 text-sm text-zinc-500">Sign in to manage MongoDB</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
