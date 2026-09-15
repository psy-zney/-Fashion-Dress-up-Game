"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { looks, wardrobeCards, type LookScreen, type Screen } from "@/lib/outfits";
import { playSound } from "@/lib/sound-effects";
import { SoapBubbles } from "@/components/soap-bubbles";
import { loadMusicWithProgress, initAudio, playBgmSafely } from "@/lib/audio-manager";
import { preloadAllAssets } from "@/lib/asset-preloader";
import { publicAsset } from "@/lib/public-asset";

const asset = (name: string) => publicAsset(`/game/ui/${name}`);
const unit = (pixels: number) => `${pixels / 14.4}cqw`;

function Help({ onOpen }: { onOpen?: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button className="help-button" aria-label="How to play" onClick={() => { onOpen?.(); playSound("panelOpen"); dialog.current?.showModal(); }}>
      <img src={asset("button-help.png")} alt="" className="help-button-img" draggable={false} />
      <span className="sr-only">?</span>
    </button>
    <dialog ref={dialog} className="help-dialog" aria-labelledby="help-title" onClose={() => playSound("panelClose")} onClick={(event) => {
      if (event.target === event.currentTarget) dialog.current?.close();
    }}>
      <div className="help-content">
        <span className="help-eyebrow">FASHION DRESS-UP MINIGAME</span>
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
          onClick={() => playSound("dress")}
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
    <Link className="back-button" href="/" aria-label="Back to start" onClick={() => playSound("back")}><img src={asset("back.svg")} alt="" /></Link>
    <p className="sr-only" role="status" aria-live="polite">Selected outfit: {look.name}</p>
  </>;
}

export function DressUpGame({ screen }: { screen: Screen }) {
  const [audioLoading, setAudioLoading] = useState(() => screen === 1);
  const [audioProgress, setAudioProgress] = useState(0);
  const [freshlyLoaded, setFreshlyLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [isActivated, setIsActivated] = useState(false);

  const handleActivate = useCallback(() => {
    setIsActivated((prev) => {
      if (prev) return true;
      initAudio();
      void playBgmSafely();
      playSound("click");
      setFreshlyLoaded(true);
      return true;
    });
  }, []);

  // Allow clicking or tapping ANYWHERE on the screen to activate audio, clear blur, and start
  useEffect(() => {
    if (screen !== 1 || audioLoading || isActivated) return;

    const onUserGesture = () => {
      handleActivate();
    };

    window.addEventListener("pointerdown", onUserGesture, { passive: true });
    window.addEventListener("keydown", onUserGesture, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onUserGesture);
      window.removeEventListener("keydown", onUserGesture);
    };
  }, [screen, audioLoading, isActivated, handleActivate]);

  useEffect(() => {
    if (screen === 1) {
      let isMounted = true;
      setAudioLoading(true);
      setLoadError(false);
      setAudioProgress(0);

      // Start audio initialization & unlock listeners right away on mount
      initAudio();

      void (async () => {
        // Run asset preloading in parallel with smooth ~2.65s loading bar progression
        const preloadPromise = preloadAllAssets().catch(() => {});

        await loadMusicWithProgress((pct) => {
          if (isMounted) setAudioProgress(pct);
        });

        await preloadPromise;

        if (!isMounted) return;
        setAudioProgress(100);

        // Brief pleasant hold at 100% before revealing PLAY button
        await new Promise((r) => setTimeout(r, 220));
        if (!isMounted) return;

        setAudioLoading(false);
      })().catch(() => {
        if (!isMounted) return;
        setAudioLoading(false);
        setLoadError(true);
      });
      return () => {
        isMounted = false;
      };
    } else {
      initAudio();
    }
  }, [loadAttempt, screen]);

  const parallaxStageRef = useRef<HTMLDivElement>(null);
  const modelDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);

  const updateModelDrag = useCallback((element: HTMLElement, x: number, y: number) => {
    const canvas = parallaxStageRef.current;
    const bounds = canvas?.getBoundingClientRect();
    const maxX = (bounds?.width ?? window.innerWidth) * 0.12;
    const maxY = (bounds?.height ?? window.innerHeight) * 0.08;
    const dragX = Math.max(-maxX, Math.min(maxX, x));
    const dragY = Math.max(-maxY, Math.min(maxY, y));
    element.style.setProperty("--drag-x", `${dragX}px`);
    element.style.setProperty("--drag-y", `${dragY}px`);
  }, []);

  const handleModelPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    modelDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.dataset.dragging = "true";
  }, []);

  const handleModelPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = modelDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    updateModelDrag(event.currentTarget, event.clientX - drag.startX, event.clientY - drag.startY);
  }, [updateModelDrag]);

  const releaseModelDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = modelDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    modelDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    delete event.currentTarget.dataset.dragging;
    updateModelDrag(event.currentTarget, 0, 0);
  }, [updateModelDrag]);

  useEffect(() => {
    if (screen !== 1) return;
    const stage = parallaxStageRef.current;
    if (!stage) return;
    let animationFrame = 0;

    const renderParallax = (clientX: number, clientY: number) => {
      const bounds = stage.getBoundingClientRect();
      const x = Math.max(-0.5, Math.min(0.5, (clientX - bounds.left) / bounds.width - 0.5));
      const y = Math.max(-0.5, Math.min(0.5, (clientY - bounds.top) / bounds.height - 0.5));
      const layers = stage.querySelectorAll<HTMLElement>('.parallax-layer');
      layers.forEach((layer) => {
        const speedX = parseFloat(layer.getAttribute('data-speed-x') || '0');
        const speedY = parseFloat(layer.getAttribute('data-speed-y') || '0');
        layer.style.setProperty('--parallax-x', `${x * speedX}px`);
        layer.style.setProperty('--parallax-y', `${y * speedY}px`);
      });
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!event.isPrimary) return;
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => renderParallax(event.clientX, event.clientY));
    };
    const resetParallax = () => {
      cancelAnimationFrame(animationFrame);
      stage.querySelectorAll<HTMLElement>('.parallax-layer').forEach((layer) => {
        layer.style.setProperty('--parallax-x', '0px');
        layer.style.setProperty('--parallax-y', '0px');
      });
    };

    stage.addEventListener('pointermove', handlePointerMove, { passive: true });
    stage.addEventListener('pointerleave', resetParallax, { passive: true });
    return () => {
      cancelAnimationFrame(animationFrame);
      stage.removeEventListener('pointermove', handlePointerMove);
      stage.removeEventListener('pointerleave', resetParallax);
    };
  }, [screen]);

  const isBlurred = screen === 1 && (audioLoading || !isActivated);

  return (
    <main
      className={`game-shell ${screen === 1 ? "landing-shell" : ""}`}
      style={{ "--landing-bg": `url('${asset("landing-new-bg.png")}')` } as CSSProperties}
      ref={parallaxStageRef}
    >
      <div
        className={`game-canvas ${screen === 1 ? "landing" : "dressing-room"}`}
        data-screen={screen}
        data-node-id={screen === 1 ? "1:2" : looks[screen].nodeId}
        aria-label={screen === 1 ? "Fashion Dress-Up minigame" : "Dress up game"}
        onClick={() => {
          if (screen === 1 && !audioLoading && !isActivated) {
            handleActivate();
          }
        }}
      >
        {screen === 1 ? <>
          <div className="landing-background-layer parallax-layer" data-speed-x="-12" data-speed-y="-7">
            <img
              className={`landing-art ${isBlurred ? "is-loading-blur" : ""}`}
              src={asset("landing-new-bg.png")}
              alt="Fashion Dress-Up Minigame — a colorful fashion collage in the city"
              fetchPriority="high"
              draggable={false}
            />
          </div>
          <div
            className="landing-model-wrap parallax-layer"
            data-testid="landing-model-layer"
            data-speed-x="28"
            data-speed-y="16"
            data-effects-ready={isActivated}
            onPointerDown={handleModelPointerDown}
            onPointerMove={handleModelPointerMove}
            onPointerUp={releaseModelDrag}
            onPointerCancel={releaseModelDrag}
          >
            <img className={`landing-asset ${isBlurred ? "is-loading-blur" : ""}`} src={asset("landing-model.png")} alt="" draggable={false} />
            {!audioLoading && <>
              <img className="landing-clothing landing-jacket" src={asset("model-jacket.png")} alt="" draggable={false} />
              <img className="landing-clothing landing-skirt" src={asset("model-skirt.png")} alt="" draggable={false} />
              <img className="landing-clothing landing-belt" src={asset("model-belt.png")} alt="" draggable={false} />
              <img className="landing-clothing landing-beanie" src={asset("model-beanie.png")} alt="" draggable={false} />
            </>}
          </div>
          <div className="landing-pole-wrap parallax-layer" data-speed-x="3" data-speed-y="1">
            <img className={`landing-asset ${isBlurred ? "is-loading-blur" : ""}`} src={asset("landing-pole.png")} alt="" draggable={false} />
          </div>

          <div className="landing-sign-hehe-wrap parallax-layer" data-speed-x="10" data-speed-y="5">
            <img className="landing-hover-overlay" src={asset("hehe-hover.png")} alt="" draggable={false} />
            <img className={`landing-asset landing-sign-hehe ${isBlurred ? "is-loading-blur" : ""}`} src={asset("sign-hehe.png")} alt="" draggable={false} />
          </div>
          <div className="landing-sign-tung-wrap parallax-layer" data-speed-x="12" data-speed-y="4">
            <img className="landing-hover-overlay" src={asset("tung-tung-hover.png")} alt="" draggable={false} />
            <img className={`landing-asset landing-sign-tung ${isBlurred ? "is-loading-blur" : ""}`} src={asset("sign-tung-tung.png")} alt="" draggable={false} />
          </div>
          {!audioLoading && isActivated && <SoapBubbles count={12} />}
          {loadError ? (
            <button
              type="button"
              className="glass-button play-button is-freshly-loaded is-retry"
              onClick={() => setLoadAttempt((value) => value + 1)}
            >
              RETRY
            </button>
          ) : isActivated && !audioLoading ? (
            <>
              <Link
                className={`glass-button play-button ${freshlyLoaded ? "is-freshly-loaded" : ""}`}
                href="/play"
                aria-label="PLAY"
                onClick={() => {
                  handleActivate();
                  playSound("play");
                  void playBgmSafely();
                }}
              >
                PLAY
              </Link>
              <div className="landing-start-game-wrap parallax-layer" data-speed-x="10" data-speed-y="3">
                <img className="landing-hover-overlay" src={asset("start-game-hover.png")} alt="" draggable={false} />
                <Link
                  className={`landing-btn-inner ${freshlyLoaded ? "is-freshly-loaded" : ""}`}
                  href="/play"
                  aria-label="START GAME"
                  onClick={() => {
                    handleActivate();
                    playSound("play");
                    void playBgmSafely();
                  }}
                  style={{ display: 'block', width: '100%', height: '100%' }}
                >
                  <img
                    src={asset("button-start-game.png")}
                    alt=""
                    className="landing-asset"
                    draggable={false}
                  />
                  <span className="sr-only">PLAY</span>
                </Link>
              </div>
            </>
          ) : null}
          <div
            className={`landing-loading-bar-wrap ${!audioLoading ? "is-hidden" : ""}`}
            aria-hidden={!audioLoading}
          >
            <div className="landing-loading-info">
              <span className="landing-loading-percent">{audioProgress}%</span>
              <span className="landing-loading-label">
                {loadError ? "Loading failed — tap retry" : "Loading game assets"}
              </span>
            </div>
            <div className="landing-loading-track">
              <div className="landing-loading-fill" style={{ width: `${audioProgress}%` }} />
            </div>
          </div>
          {!audioLoading && !isActivated && (
            <div
              className="landing-tap-notification"
              role="button"
              tabIndex={0}
              aria-label="Tap to play"
              onClick={handleActivate}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleActivate();
              }}
            >
              <span className="landing-tap-title">Tap to play</span>
            </div>
          )}
          <Help onOpen={handleActivate} />
        </> : <DressingRoom screen={screen} />}
      </div>
    </main>
  );
}
