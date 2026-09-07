import Link from "next/link";
import { existsSync } from "node:fs";
import path from "node:path";
import { DressUpStudio } from "@/components/dress-up-studio";
import "../studio/studio.css";

export const metadata = {
  title: "Dress-Up Studio · Fashion Dress-Up",
  description: "Style outfits on the model with layered RGBA sprites and instant fitting.",
};

export default function PlayPage() {
  const readyFile = path.join(process.cwd(), "public/game/studio/layers/ready.json");

  if (!existsSync(readyFile)) {
    return (
      <main className="studio-pending" lang="en">
        <p>FASHION DRESS-UP · PLAY</p>
        <h1>Your outfit wardrobe is being prepared.</h1>
        <p>Run <code>npm run prepare:studio</code> to set up the doll model and garment layers.</p>
        <Link href="/">Back to Home ↗</Link>
      </main>
    );
  }

  return <DressUpStudio />;
}
