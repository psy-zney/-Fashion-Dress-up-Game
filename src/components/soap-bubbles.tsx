"use client";

import { useEffect, useRef, useState } from "react";
import { playBubblePop } from "@/lib/sound-effects";

interface Bubble {
  id: number;
  x: number; // percentage (0% to 100%)
  y: number; // percentage (0% to 100%)
  vx: number; // horizontal drift speed
  vy: number; // vertical drift speed
  size: number; // px (26 to 68)
  phaseX: number;
  phaseY: number;
  wobbleSpeed: number;
  popping: boolean;
  hue: number;
}

// Center area where the girl blows bubbles in the artwork
const WAND_X = 66;
const WAND_Y = 24;

function createBubble(id: number, fromWand = false, compact = false, slot = 0): Bubble {
  const isWand = fromWand || Math.random() < (compact ? 0.12 : 0.22);
  const startX = isWand
    ? WAND_X + (Math.random() - 0.5) * (compact ? 12 : 18)
    : 10 + ((slot * 37 + Math.random() * 12) % 80);
  const startY = isWand
    ? WAND_Y + (Math.random() - 0.5) * (compact ? 10 : 15)
    : 10 + ((slot * 29 + Math.random() * 12) % 80);

  // Trajectory biased outwards from the wand with organic dispersion
  const angle = isWand
    ? Math.PI * 0.8 + (Math.random() - 0.5) * Math.PI * 1.15
    : Math.random() * Math.PI * 2;

  const speed = 0.045 + Math.random() * 0.11;
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed - 0.02; // slight upward air buoyancy

  return {
    id,
    x: startX,
    y: startY,
    vx,
    vy,
    size: compact ? 16 + Math.floor(Math.random() * 25) : 24 + Math.floor(Math.random() * 38),
    phaseX: Math.random() * Math.PI * 2,
    phaseY: Math.random() * Math.PI * 2,
    wobbleSpeed: 0.002 + Math.random() * 0.003,
    popping: false,
    hue: Math.floor(Math.random() * 60) - 30,
  };
}

export function SoapBubbles({ count = 14, enabled = true }: { count?: number; enabled?: boolean }) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [compact, setCompact] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const animFrame = useRef<number | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 600px), (max-height: 600px)");
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // Start bubbles from wand once loading finishes
  useEffect(() => {
    if (!enabled) return;

    const visibleCount = compact ? Math.min(count, 6) : count;
    const initialBubbles: Bubble[] = Array.from({ length: visibleCount }, (_, slot) =>
      createBubble(nextId.current++, true, compact, slot),
    );

    setBubbles(initialBubbles);

    let lastTime = performance.now();

    function loop(currentTime: number) {
      const delta = Math.min(currentTime - lastTime, 64);
      lastTime = currentTime;
      const step = delta / 16;

      setBubbles((prev) => {
        return prev.map((b) => {
          if (b.popping) return b;

          const phaseX = b.phaseX + b.wobbleSpeed * delta;
          const phaseY = b.phaseY + b.wobbleSpeed * delta * 0.8;
          const wobbleX = Math.sin(phaseX) * 0.06;
          const wobbleY = Math.cos(phaseY) * 0.04;

          let nextX = b.x + (b.vx + wobbleX) * step;
          let nextY = b.y + (b.vy + wobbleY) * step;

          // Check collision with any screen boundary
          const hitTop = nextY <= 2;
          const hitBottom = nextY >= 98;
          const hitLeft = nextX <= 2;
          const hitRight = nextX >= 98;

          if (hitTop || hitBottom || hitLeft || hitRight) {
            // Boundary collision pop: "âm thanh bong bóng tự vỡ sẽ nhỏ hơn 1 chút so với click vỡ"
            const pitch = 0.85 + (1 - b.size / 75) * 0.45;
            playBubblePop(pitch, 0.42);

            setTimeout(() => {
              respawnBubble(b.id);
            }, 220);

            return {
              ...b,
              popping: true,
            };
          }

          return {
            ...b,
            x: nextX,
            y: nextY,
            phaseX,
            phaseY,
          };
        });
      });

      animFrame.current = requestAnimationFrame(loop);
    }

    animFrame.current = requestAnimationFrame(loop);

    return () => {
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
    };
  }, [compact, count, enabled]);

  function respawnBubble(id: number) {
    setBubbles((prev) =>
      prev.map((b) => (b.id === id ? createBubble(nextId.current++, true, compact) : b)),
    );
  }

  function handlePop(e: React.MouseEvent | React.TouchEvent, bubble: Bubble) {
    e.stopPropagation();
    if (bubble.popping) return;

    // Pitch scales with size; user click has full crisp punchy pop (volumeScale: 1.0)
    const pitch = 0.85 + (1 - bubble.size / 75) * 0.45;
    playBubblePop(pitch, 1.0);

    setBubbles((prev) =>
      prev.map((b) => (b.id === bubble.id ? { ...b, popping: true } : b)),
    );

    setTimeout(() => {
      respawnBubble(bubble.id);
    }, 220);
  }

  if (!enabled) return null;

  return (
    <div className="soap-bubbles-layer" ref={containerRef} aria-hidden="true">
      {bubbles.map((b) => (
        <div
          key={b.id}
          className={`soap-bubble ${b.popping ? "is-popping" : ""}`}
          style={{
            width: `${b.size}px`,
            height: `${b.size}px`,
            left: `${b.x}%`,
            top: `${b.y}%`,
            filter: `hue-rotate(${b.hue}deg)`,
          }}
          onClick={(e) => handlePop(e, b)}
          onTouchStart={(e) => handlePop(e, b)}
        >
          {/* Internal specular reflections matching realistic soap bubbles */}
          <span className="soap-bubble-glint-main" />
          <span className="soap-bubble-glint-sub" />
          <span className="soap-bubble-glint-rim" />
          {b.popping && <span className="soap-bubble-burst-ring" />}
        </div>
      ))}
    </div>
  );
}
