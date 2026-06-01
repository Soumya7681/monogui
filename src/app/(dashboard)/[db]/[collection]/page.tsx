import { DocumentBrowser } from "@/components/document-browser";

export const dynamic = "force-dynamic";

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ db: string; collection: string }>;
}) {
  const { db, collection } = await params;
  return (
    <DocumentBrowser
      db={decodeURIComponent(db)}
      collection={decodeURIComponent(collection)}
    />
  );
}
