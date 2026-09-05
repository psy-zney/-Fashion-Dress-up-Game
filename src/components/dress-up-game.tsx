"use client";

import Link from "next/link";
import { useRef, useState, type CSSProperties } from "react";
import { looks, wardrobeCards, type LookScreen, type Screen } from "@/lib/outfits";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const asset = (name: string) => `${basePath}/game/ui/${name}`;
const unit = (pixels: number) => `${pixels / 14.4}cqw`;

function Help() {
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button className="glass-button help-button" aria-label="How to play" onClick={() => dialog.current?.showModal()}>?</button>
    <dialog ref={dialog} className="help-dialog" aria-labelledby="help-title" onClick={(event) => {
      if (event.target === event.currentTarget) dialog.current?.close();
    }}>
      <div className="help-content">
        <span className="help-eyebrow">TƯNG TỬNG MINIGAME</span>
        <h1 id="help-title">A new look. A new mood.</h1>
        <p>Press PLAY, then choose an outfit to dress your character. Scroll the wardrobe to browse. Use the back arrow to return to the start.</p>
        <form method="dialog"><button className="help-close">Got it, let’s play</button></form>
      </div>
    </dialog>
  </>;
}

function Wardrobe({ screen }: { screen: LookScreen }) {
  const scrollArea = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(0);

  return <section className="wardrobe" aria-labelledby="wardrobe-title" data-node-id="2:179">
    <h1 id="wardrobe-title">Pick an outfit</h1>
    <div className="wardrobe-scroll" ref={scrollArea} tabIndex={0} aria-label="Outfit collection" onScroll={(event) => {
      const element = event.currentTarget;
      const max = element.scrollHeight - element.clientHeight;
      setPosition(max > 0 ? element.scrollTop / max : 0);
    }}>
      <div className="outfit-grid">
        {wardrobeCards.map((card, index) => <Link
          href={`/desktop/${card.screen}`}
          scroll={false}
          key={`${card.screen}-${index}`}
          className="outfit-card"
          aria-label={`Wear ${looks[card.screen].name}${index > 3 ? " (alternate card)" : ""}`}
          aria-current={card.screen === screen ? "true" : undefined}
        >
          <img src={asset(card.asset)} alt="" draggable={false} style={card.crop} />
        </Link>)}
      </div>
    </div>
    <div className="scroll-control" style={{ "--scroll-progress": position } as CSSProperties}>
      <div className="scroll-thumb" />
      <input type="range" min="0" max="100" step="1" value={Math.round(position * 100)} aria-label="Scroll wardrobe" aria-orientation="vertical" onChange={(event) => {
        const element = scrollArea.current;
        if (element) element.scrollTop = Number(event.target.value) / 100 * (element.scrollHeight - element.clientHeight);
      }} />
    </div>
  </section>;
}

function DressingRoom({ screen }: { screen: LookScreen }) {
  const look = looks[screen];
  return <>
    <img className="character-shadow" src={asset("shadow.svg")} alt="" />
    <div className="character" key={screen} style={{ left: unit(look.x), top: unit(look.y), width: unit(look.width), height: unit(look.height) }}>
      <img src={asset(look.asset)} alt={`Character wearing ${look.name}`} draggable={false} style={look.crop} />
    </div>
    <Wardrobe screen={screen} />
    <Link className="back-button" href="/" aria-label="Back to start"><img src={asset("back.svg")} alt="" /></Link>
    <p className="sr-only" role="status" aria-live="polite">Selected outfit: {look.name}</p>
  </>;
}

export function DressUpGame({ screen }: { screen: Screen }) {
  return <main
    className={`game-shell ${screen === 1 ? "landing-shell" : ""}`}
    style={{ "--landing-bg": `url('${asset("landing-background.png")}')` } as CSSProperties}
  >
    <div className={`game-canvas ${screen === 1 ? "landing" : "dressing-room"}`} data-screen={screen} data-node-id={screen === 1 ? "1:2" : looks[screen].nodeId} aria-label={screen === 1 ? "Tưng Tửng minigame" : "Dress up game"}>
      {screen === 1 ? <>
        <img className="landing-art" src={asset("landing-background.png")} alt="Tưng Tửng Minigame — a colorful fashion collage in the city" fetchPriority="high" draggable={false} />
        <img className="landing-art landing-overlay" src={asset("landing-overlay.png")} alt="" draggable={false} />
        <Link className="glass-button play-button" href="/play">PLAY</Link>
        <Help />
      </> : <DressingRoom screen={screen} />}
    </div>
  </main>;
}
