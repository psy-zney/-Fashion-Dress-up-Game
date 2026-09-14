import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-static";

export async function GET() {
  try {
    const destination = path.join(process.cwd(), "src", "lib", "studio-published-fits.json");
    const content = await readFile(destination, "utf8");
    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  } catch {
    return Response.json({ error: "Unable to read published fits." }, { status: 500 });
  }
}
