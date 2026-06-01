"use client";

import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/toast";
import { DocumentDialog, type DialogMode } from "@/components/document-dialog";

type Doc = Record<string, unknown>;

interface DocsResponse {
  docs: Doc[];
  total: number;
  limit: number;
  skip: number;
  filtered: boolean;
}

interface Applied {
  filter: string;
  sort: string;
  projection: string;
  limit: number;
  skip: number;
}

function formatCell(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "";
  if (typeof value === "object") {
    const s = JSON.stringify(value);
    return s.length > 120 ? s.slice(0, 117) + "…" : s;
  }
  return String(value);
}

function useReadOnly() {
  const { data } = useQuery({
    queryKey: ["health"],
    queryFn: () => apiFetch<{ readOnly: boolean }>("/api/health"),
  });
  return data?.readOnly ?? false;
}

export function DocumentBrowser({
  db,
  collection,
}: {
  db: string;
  collection: string;
}) {
  const qc = useQueryClient();
  const readOnly = useReadOnly();

  const [filterText, setFilterText] = useState("");
  const [sortText, setSortText] = useState("");
  const [projectionText, setProjectionText] = useState("");
  const [limit, setLimit] = useState(50);
  const [applied, setApplied] = useState<Applied>({
    filter: "",
    sort: "",
    projection: "",
    limit: 50,
    skip: 0,
  });
  const [view, setView] = useState<"table" | "json">("table");
  const [dialog, setDialog] = useState<{ mode: DialogMode; doc: Doc | null } | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<Doc | null>(null);

  const docsQuery = useQuery({
    queryKey: ["docs", db, collection, applied],
    queryFn: () => {
      const sp = new URLSearchParams();
      if (applied.filter.trim()) sp.set("filter", applied.filter);
      if (applied.sort.trim()) sp.set("sort", applied.sort);
      if (applied.projection.trim()) sp.set("projection", applied.projection);
      sp.set("limit", String(applied.limit));
      sp.set("skip", String(applied.skip));
      return apiFetch<DocsResponse>(
        `/api/databases/${encodeURIComponent(db)}/${encodeURIComponent(collection)}/docs?${sp}`,
      );
    },
    placeholderData: (prev) => prev,
  });

  function runQuery(skip = 0) {
    setApplied({
      filter: filterText,
      sort: sortText,
      projection: projectionText,
      limit,
      skip,
    });
  }

  const docs = useMemo(() => docsQuery.data?.docs ?? [], [docsQuery.data]);
  const total = docsQuery.data?.total ?? 0;

  // Build columns from the union of keys across the page, _id first.
  const columns = useMemo<ColumnDef<Doc>[]>(() => {
    const keys: string[] = [];
    const seen = new Set<string>();
    for (const d of docs) {
      for (const k of Object.keys(d)) {
        if (!seen.has(k)) {
          seen.add(k);
          keys.push(k);
        }
      }
    }
    keys.sort((a, b) => (a === "_id" ? -1 : b === "_id" ? 1 : 0));
    return keys.map((key) => ({
      id: key,
      header: key,
      accessorFn: (row) => row[key],
      cell: (info) => (
        <span className="font-mono text-xs" title={formatCell(info.getValue())}>
          {formatCell(info.getValue())}
        </span>
      ),
    }));
  }, [docs]);

  // TanStack Table intentionally returns non-memoizable functions; this is a
  // known false positive for the react-hooks compiler check.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: docs,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const start = total === 0 ? 0 : applied.skip + 1;
  const end = applied.skip + docs.length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h1 className="font-mono text-sm font-semibold">
            {db} <span className="text-zinc-400">/</span> {collection}
          </h1>
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-md border border-zinc-300 text-xs dark:border-zinc-700">
              <button
                onClick={() => setView("table")}
                className={`px-2 py-1 ${view === "table" ? "bg-zinc-200 dark:bg-zinc-700" : ""}`}
              >
                Table
              </button>
              <button
                onClick={() => setView("json")}
                className={`px-2 py-1 ${view === "json" ? "bg-zinc-200 dark:bg-zinc-700" : ""}`}
              >
                JSON
              </button>
            </div>
            {!readOnly && (
              <button
                onClick={() => setDialog({ mode: "insert", doc: null })}
                className="btn-primary"
              >
                Insert
              </button>
            )}
          </div>
        </div>

        {/* Query bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runQuery(0);
          }}
          className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-[2fr_1fr_1fr_auto_auto]"
        >
          <input
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder='filter: { "field": "value" }'
            className="rounded-md border border-zinc-300 px-2 py-1.5 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            value={sortText}
            onChange={(e) => setSortText(e.target.value)}
            placeholder='sort: { "field": -1 }'
            className="rounded-md border border-zinc-300 px-2 py-1.5 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            value={projectionText}
            onChange={(e) => setProjectionText(e.target.value)}
            placeholder='projection: { "field": 1 }'
            className="rounded-md border border-zinc-300 px-2 py-1.5 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            type="number"
            min={1}
            max={200}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            title="limit (max 200)"
            className="w-20 rounded-md border border-zinc-300 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button type="submit" className="btn-secondary">
            Run
          </button>
        </form>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {docsQuery.isError && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {(docsQuery.error as Error).message}
          </p>
        )}
        {docsQuery.isLoading && <p className="text-sm text-zinc-400">Loading…</p>}

        {!docsQuery.isLoading && docs.length === 0 && !docsQuery.isError && (
          <p className="text-sm text-zinc-400">No documents match this query.</p>
        )}

        {docs.length > 0 && view === "table" && (
          <div className="overflow-auto rounded-md border border-zinc-200 dark:border-zinc-800">
            <table className="w-full border-collapse text-left">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((h) => (
                      <th
                        key={h.id}
                        className="whitespace-nowrap border-b border-zinc-200 px-3 py-2 font-mono text-xs font-semibold dark:border-zinc-800"
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    ))}
                    <th className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-800" />
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="max-w-xs truncate border-b border-zinc-100 px-3 py-1.5 dark:border-zinc-800"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                    <td className="whitespace-nowrap border-b border-zinc-100 px-3 py-1.5 text-right dark:border-zinc-800">
                      <RowActions
                        readOnly={readOnly}
                        onView={() => setDialog({ mode: "view", doc: row.original })}
                        onEdit={() => setDialog({ mode: "edit", doc: row.original })}
                        onDelete={() => setDeleteTarget(row.original)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {docs.length > 0 && view === "json" && (
          <pre className="overflow-auto rounded-md border border-zinc-200 bg-white p-3 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-900">
            {JSON.stringify(docs, null, 2)}
          </pre>
        )}
      </div>

      {/* Pagination footer */}
      <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-800">
        <span>
          {start}–{end} of {total}
          {docsQuery.data?.filtered ? " (filtered)" : ""}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => runQuery(Math.max(0, applied.skip - applied.limit))}
            disabled={applied.skip === 0}
            className="btn-secondary px-2 py-1"
          >
            Prev
          </button>
          <button
            onClick={() => runQuery(applied.skip + applied.limit)}
            disabled={end >= total}
            className="btn-secondary px-2 py-1"
          >
            Next
          </button>
        </div>
      </div>

      {dialog && (
        <DocumentDialog
          mode={dialog.mode}
          db={db}
          collection={collection}
          doc={dialog.doc}
          onClose={() => setDialog(null)}
        />
      )}
      {deleteTarget && (
        <DeleteDialog
          db={db}
          collection={collection}
          doc={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() =>
            qc.invalidateQueries({ queryKey: ["docs", db, collection] })
          }
        />
      )}
    </div>
  );
}

function RowActions({
  readOnly,
  onView,
  onEdit,
  onDelete,
}: {
  readOnly: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <span className="flex justify-end gap-2 text-xs">
      <button onClick={onView} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
        View
      </button>
      {!readOnly && (
        <>
          <button onClick={onEdit} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            Edit
          </button>
          <button onClick={onDelete} className="text-red-500 hover:text-red-700">
            Delete
          </button>
        </>
      )}
    </span>
  );
}

function DeleteDialog({
  db,
  collection,
  doc,
  onClose,
  onDeleted,
}: {
  db: string;
  collection: string;
  doc: Record<string, unknown>;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { notify } = useToast();
  const mutation = useMutation({
    mutationFn: () => {
      const id = encodeURIComponent(JSON.stringify(doc._id));
      return apiFetch(
        `/api/databases/${encodeURIComponent(db)}/${encodeURIComponent(collection)}/docs/${id}`,
        { method: "DELETE" },
      );
    },
    onSuccess: () => {
      onDeleted();
      notify("Document deleted");
      onClose();
    },
  });

  return (
    <Modal title="Delete document" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Permanently delete this document?
        </p>
        <pre className="max-h-40 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-2 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-950">
          {JSON.stringify(doc._id)}
        </pre>
        {mutation.isError && (
          <p className="text-sm text-red-600">{(mutation.error as Error).message}</p>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="btn-danger"
          >
            {mutation.isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
