import Link from "next/link";

export default function NotFound() {
  return <main className="not-found"><h1>This look is missing.</h1><p>Choose a fresh start.</p><Link href="/">Back to the game</Link></main>;
}
