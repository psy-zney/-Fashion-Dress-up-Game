import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tưng Tửng · Game phối đồ",
  description: "Phối từng lớp áo, quần, váy, đầm, áo khoác, tất và giày trên một model 2D cố định.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
