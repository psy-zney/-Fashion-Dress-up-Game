import { notFound, redirect } from "next/navigation";
import { isScreen } from "@/lib/outfits";

export function generateStaticParams() {
  return [1, 2, 3, 4, 5].map((screen) => ({ screen: String(screen) }));
}

export default async function DesktopPage({ params }: { params: Promise<{ screen: string }> }) {
  const { screen: value } = await params;
  const screen = Number(value);
  if (!isScreen(screen) || String(screen) !== value) notFound();
  // The Figma sample models stay in the repository as visual references, but
  // are temporarily removed from the playable flow while the straight-pose
  // wardrobe is active.
  redirect("/play");
}
