"use client";

import { useEffect, useState } from "react";

interface Sparkle {
  id: number;
  x: number; // percentage relative to character stage
  y: number;
  size: number; // px
  type: "star4" | "star8" | "circle" | "sparkle";
  delay: number; // ms
  dx: number;
  dy: number;
  rotation: number;
}

interface MagicBlingProps {
  activeItem: string | null;
  category?: "tops" | "bottoms" | "shoes" | null;
}

export function MagicBlingSparkles({ activeItem, category }: MagicBlingProps) {
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);

  useEffect(() => {
    if (!activeItem) return;

    // Define vertical & horizontal center based on worn category
    let centerY = 50;
    let spreadY = 44;
    let spreadX = 34;

    if (category === "tops") {
      centerY = 35; // Torso, chest, shoulders
      spreadY = 22;
      spreadX = 32;
    } else if (category === "bottoms") {
      centerY = 60; // Waist, hips, legs
      spreadY = 24;
      spreadX = 28;
    } else if (category === "shoes") {
      centerY = 88; // Feet, ankles
      spreadY = 12;
      spreadX = 24;
    }

    // Generate 26 glowing white magic sparkles localized to the garment
    const count = 26;
    const newSparkles: Sparkle[] = Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.45;
      const distance = 25 + Math.random() * 65;
      const types: Array<Sparkle["type"]> = ["star4", "star8", "circle", "sparkle"];

      return {
        id: Date.now() + i,
        x: 50 + (Math.random() - 0.5) * spreadX,
        y: centerY + (Math.random() - 0.5) * spreadY,
        size: 11 + Math.floor(Math.random() * 20),
        type: types[Math.floor(Math.random() * types.length)],
        delay: Math.floor(Math.random() * 180),
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance - 16, // drift slightly upward
        rotation: Math.floor(Math.random() * 360),
      };
    });

    setSparkles(newSparkles);

    const timer = setTimeout(() => {
      setSparkles([]);
    }, 950);

    return () => clearTimeout(timer);
  }, [activeItem, category]);

  if (sparkles.length === 0) return null;

  return (
    <div className="magic-bling-container" aria-hidden="true">
      {sparkles.map((s) => (
        <div
          key={s.id}
          className={`magic-bling-particle bling-type-${s.type}`}
          style={
            {
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              animationDelay: `${s.delay}ms`,
              "--dx": `${s.dx}px`,
              "--dy": `${s.dy}px`,
              "--rot": `${s.rotation}deg`,
            } as React.CSSProperties
          }
        >
          {s.type === "star4" && (
            <svg viewBox="0 0 24 24" fill="white" className="bling-svg">
              <path d="M12 0 L14.5 9.5 L24 12 L14.5 14.5 L12 24 L9.5 14.5 L0 12 L9.5 9.5 Z" />
            </svg>
          )}
          {s.type === "star8" && (
            <svg viewBox="0 0 24 24" fill="white" className="bling-svg">
              <path d="M12 1 L13.8 8.2 L21 6.4 L15.8 11.6 L23 12 L15.8 12.4 L21 17.6 L13.8 15.8 L12 23 L10.2 15.8 L3 17.6 L8.2 12.4 L1 12 L8.2 11.6 L3 6.4 L10.2 8.2 Z" />
            </svg>
          )}
          {s.type === "circle" && (
            <div className="bling-bubble-circle" />
          )}
          {s.type === "sparkle" && (
            <svg viewBox="0 0 24 24" fill="white" className="bling-svg">
              <circle cx="12" cy="12" r="3" fill="#ffffff" />
              <path d="M12 2 L13 10 L21 12 L13 14 L12 22 L11 14 L3 12 L11 10 Z" fill="#ffffff" />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}
