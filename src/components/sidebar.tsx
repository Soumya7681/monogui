"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/toast";

interface DbInfo {
  name: string;
  sizeOnDisk: number | null;
  empty: boolean;
}
interface CollInfo {
  name: string;
  type: string;
  count: number | null;
}

function useReadOnly() {
  const { data } = useQuery({
    queryKey: ["health"],
    queryFn: () => apiFetch<{ readOnly: boolean }>("/api/health"),
  });
  return data?.readOnly ?? false;
}

export function Sidebar() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [createIn, setCreateIn] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ db: string; coll: string } | null>(
    null,
  );
  const readOnly = useReadOnly();

  const dbs = useQuery({
    queryKey: ["databases"],
    queryFn: () =>
      apiFetch<{ databases: DbInfo[] }>("/api/databases").then((d) => d.databases),
  });

  function toggle(db: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(db)) next.delete(db);
      else next.add(db);
      return next;
    });
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Mongui
        </Link>
        <button
          onClick={() => dbs.refetch()}
          title="Refresh"
          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
        >
          ⟳
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-auto px-2 pb-4 text-sm">
        {dbs.isLoading && <p className="px-2 text-zinc-400">Loading databases…</p>}
        {dbs.isError && (
          <p className="px-2 text-red-600">{(dbs.error as Error).message}</p>
        )}
        {dbs.data?.map((db) => (
          <DbItem
            key={db.name}
            db={db}
            open={expanded.has(db.name)}
            onToggle={() => toggle(db.name)}
            readOnly={readOnly}
            onCreate={() => setCreateIn(db.name)}
            onDrop={(coll) => setDropTarget({ db: db.name, coll })}
          />
        ))}
        {dbs.data && dbs.data.length === 0 && (
          <p className="px-2 text-zinc-400">No databases.</p>
        )}
      </nav>

      {createIn && (
        <CreateCollectionModal db={createIn} onClose={() => setCreateIn(null)} />
      )}
      {dropTarget && (
        <DropCollectionModal
          db={dropTarget.db}
          coll={dropTarget.coll}
          onClose={() => setDropTarget(null)}
        />
      )}
    </aside>
  );
}

function DbItem({
  db,
  open,
  onToggle,
  readOnly,
  onCreate,
  onDrop,
}: {
  db: DbInfo;
  open: boolean;
  onToggle: () => void;
  readOnly: boolean;
  onCreate: () => void;
  onDrop: (coll: string) => void;
}) {
  const pathname = usePathname();
  const colls = useQuery({
    queryKey: ["collections", db.name],
    queryFn: () =>
      apiFetch<{ collections: CollInfo[] }>(
        `/api/databases/${encodeURIComponent(db.name)}/collections`,
      ).then((d) => d.collections),
    enabled: open,
  });

  return (
    <div className="mb-0.5">
      <div className="group flex items-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">
        <button
          onClick={onToggle}
          className="flex flex-1 items-center gap-1 px-2 py-1.5 text-left"
        >
          <span className="w-3 text-zinc-400">{open ? "▾" : "▸"}</span>
          <span className="truncate font-medium">{db.name}</span>
        </button>
        {!readOnly && (
          <button
            onClick={onCreate}
            title="New collection"
            className="px-2 text-zinc-400 opacity-0 hover:text-zinc-700 group-hover:opacity-100 dark:hover:text-zinc-200"
          >
            +
          </button>
        )}
      </div>

      {open && (
        <div className="ml-3 border-l border-zinc-200 pl-1 dark:border-zinc-800">
          {colls.isLoading && (
            <p className="px-2 py-1 text-xs text-zinc-400">Loading…</p>
          )}
          {colls.isError && (
            <p className="px-2 py-1 text-xs text-red-600">
              {(colls.error as Error).message}
            </p>
          )}
          {colls.data?.map((c) => {
            const href = `/${encodeURIComponent(db.name)}/${encodeURIComponent(c.name)}`;
            const active = pathname === href;
            return (
              <div
                key={c.name}
                className={`group flex items-center rounded ${
                  active
                    ? "bg-zinc-200 dark:bg-zinc-700"
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                <Link
                  href={href}
                  className="flex flex-1 items-center justify-between gap-2 px-2 py-1"
                >
                  <span className="truncate">{c.name}</span>
                  <span className="shrink-0 text-xs text-zinc-400">
                    {c.count ?? "—"}
                  </span>
                </Link>
                {!readOnly && (
                  <button
                    onClick={() => onDrop(c.name)}
                    title="Drop collection"
                    className="px-1.5 text-zinc-400 opacity-0 hover:text-red-600 group-hover:opacity-100"
                  >
                    🗑
                  </button>
                )}
              </div>
            );
          })}
          {colls.data && colls.data.length === 0 && (
            <p className="px-2 py-1 text-xs text-zinc-400">No collections.</p>
          )}
        </div>
      )}
    </div>
  );
}

function CreateCollectionModal({ db, onClose }: { db: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { notify } = useToast();
  const [name, setName] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/databases/${encodeURIComponent(db)}/collections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections", db] });
      notify(`Created collection "${name}"`);
      onClose();
    },
  });

  return (
    <Modal title={`New collection in ${db}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="space-y-3"
      >
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="collection name"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        {mutation.isError && (
          <p className="text-sm text-red-600">{(mutation.error as Error).message}</p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || mutation.isPending}
            className="btn-primary"
          >
            {mutation.isPending ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DropCollectionModal({
  db,
  coll,
  onClose,
}: {
  db: string;
  coll: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { notify } = useToast();
  const [confirm, setConfirm] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      apiFetch(
        `/api/databases/${encodeURIComponent(db)}/collections?name=${encodeURIComponent(coll)}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections", db] });
      notify(`Dropped collection "${coll}"`);
      onClose();
    },
  });

  return (
    <Modal title={`Drop "${coll}"`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          This permanently deletes the collection and all its documents. Type{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">{coll}</code>{" "}
          to confirm.
        </p>
        <input
          autoFocus
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        {mutation.isError && (
          <p className="text-sm text-red-600">{(mutation.error as Error).message}</p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={confirm !== coll || mutation.isPending}
            className="btn-danger"
          >
            {mutation.isPending ? "Dropping…" : "Drop collection"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
