export default function OverviewPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome to Mongui</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        A lightweight, self-hosted UI for browsing and editing MongoDB.
      </p>
      <ul className="mt-6 list-inside list-disc space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
        <li>Pick a database in the sidebar to expand its collections.</li>
        <li>Select a collection to browse, query, and edit documents.</li>
        <li>
          Document values use Extended JSON, so <code>ObjectId</code>,{" "}
          <code>Date</code>, and <code>Decimal128</code> round-trip safely.
        </li>
      </ul>
    </div>
  );
}
