"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/toast";

const JsonEditor = dynamic(
  () => import("@/components/json-editor").then((m) => m.JsonEditor),
  { ssr: false, loading: () => <div className="h-[420px] animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" /> },
);

export type DialogMode = "view" | "edit" | "insert";

/** Encode an EJSON _id value for use in the docs/[id] URL (no server imports). */
function encodeId(id: unknown): string {
  return encodeURIComponent(JSON.stringify(id));
}

export function DocumentDialog({
  mode,
  db,
  collection,
  doc,
  onClose,
}: {
  mode: DialogMode;
  db: string;
  collection: string;
  doc: Record<string, unknown> | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { notify } = useToast();
  const initial = useMemo(
    () => (mode === "insert" ? "{\n  \n}" : JSON.stringify(doc, null, 2)),
    [mode, doc],
  );
  const [text, setText] = useState(initial);

  const clientError = useMemo(() => {
    try {
      JSON.parse(text);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Invalid JSON";
    }
  }, [text]);

  const base = `/api/databases/${encodeURIComponent(db)}/${encodeURIComponent(collection)}/docs`;

  const mutation = useMutation({
    mutationFn: () => {
      if (mode === "insert") {
        return apiFetch(base, { method: "POST", body: text });
      }
      const id = encodeId(doc?._id);
      return apiFetch(`${base}/${id}`, { method: "PUT", body: text });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["docs", db, collection] });
      notify(mode === "insert" ? "Document inserted" : "Document updated");
      onClose();
    },
  });

  const title =
    mode === "view"
      ? "View document"
      : mode === "edit"
        ? "Edit document"
        : "Insert document";

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-3">
        <JsonEditor
          value={text}
          onChange={mode === "view" ? undefined : setText}
          readOnly={mode === "view"}
        />
        {mode !== "view" && clientError && (
          <p className="text-sm text-amber-600">JSON error: {clientError}</p>
        )}
        {mutation.isError && (
          <p className="text-sm text-red-600">{(mutation.error as Error).message}</p>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">
            {mode === "view" ? "Close" : "Cancel"}
          </button>
          {mode !== "view" && (
            <button
              onClick={() => mutation.mutate()}
              disabled={!!clientError || mutation.isPending}
              className="btn-primary"
            >
              {mutation.isPending ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
