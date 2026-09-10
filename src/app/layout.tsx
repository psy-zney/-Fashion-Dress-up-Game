import type { Metadata, Viewport } from "next";
import { DeployVersionGuard } from "@/components/deploy-version-guard";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tung Tung · Fashion Dress-Up Game",
  description: "Mix and match tops, bottoms, and shoes on a 2D model with real-time fitting.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><DeployVersionGuard />{children}</body></html>;
}
