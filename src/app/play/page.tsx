import Link from "next/link";
import { existsSync } from "node:fs";
import path from "node:path";
import { DressUpStudio } from "@/components/dress-up-studio";
import "../studio/studio.css";

export const metadata = {
  title: "Phòng phối đồ · Tưng Tửng",
  description: "Phối trang phục trên model đứng thẳng với bộ sprite RGBA đồng nhất.",
};

export default function PlayPage() {
  const readyFile = path.join(process.cwd(), "public/game/studio/layers/ready.json");

  if (!existsSync(readyFile)) {
    return (
      <main className="studio-pending" lang="vi">
        <p>TƯNG TỬNG · DRESS-UP PLAY</p>
        <h1>Bộ trang phục mới đang được chuẩn bị.</h1>
        <p>Chạy <code>npm run prepare:studio</code> để hoàn thiện model đứng thẳng và 14 lớp trang phục.</p>
        <Link href="/">Về màn hình mở đầu ↗</Link>
      </main>
    );
  }

  return <DressUpStudio />;
}
