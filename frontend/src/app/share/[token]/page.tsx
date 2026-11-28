import type { Metadata } from "next";
import { SharedView } from "@/features/share/SharedView";

// Private links: keep them out of search engines and out of Referer headers.
export const metadata: Metadata = {
  title: "Shared from Quill",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SharedView token={token} />;
}
