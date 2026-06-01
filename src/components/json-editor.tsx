"use client";

import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { EditorView } from "@codemirror/view";

/**
 * CodeMirror 6 JSON editor (FR-READ-2). Used read-only for viewing a document
 * and editable for insert/edit. Content is Extended JSON text.
 */
export function JsonEditor({
  value,
  onChange,
  readOnly = false,
}: {
  value: string;
  onChange?: (next: string) => void;
  readOnly?: boolean;
}) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      editable={!readOnly}
      readOnly={readOnly}
      height="420px"
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: !readOnly,
      }}
      extensions={[json(), EditorView.lineWrapping]}
      className="overflow-hidden rounded-md border border-zinc-300 text-sm dark:border-zinc-700"
    />
  );
}
