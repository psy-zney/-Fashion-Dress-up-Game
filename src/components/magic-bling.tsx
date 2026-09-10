"use client";

import type { CSSProperties } from "react";
import { publicAsset } from "@/lib/public-asset";

interface ColorBubbleBurstProps {
  activeItem: string | null;
  category?: "tops" | "bottoms" | "shoes" | null;
}

const burstBubbles = [
  { x: "-8.4cqw", y: "-1.2cqw", size: 17, delay: 10, hue: 185 },
  { x: "8.7cqw", y: "-.8cqw", size: 15, delay: 0, hue: 315 },
  { x: "-6.8cqw", y: "-5.8cqw", size: 13, delay: 45, hue: 48 },
  { x: "6.2cqw", y: "-6.4cqw", size: 18, delay: 20, hue: 205 },
  { x: "-5.1cqw", y: "6.7cqw", size: 19, delay: 65, hue: 330 },
  { x: "5.8cqw", y: "6.1cqw", size: 12, delay: 35, hue: 62 },
  { x: "-10.1cqw", y: "3.7cqw", size: 10, delay: 85, hue: 270 },
  { x: "10.4cqw", y: "3.2cqw", size: 16, delay: 55, hue: 155 },
  { x: "-2.1cqw", y: "-8.9cqw", size: 11, delay: 95, hue: 345 },
  { x: "2.5cqw", y: "9.2cqw", size: 15, delay: 75, hue: 195 },
  { x: "-9.3cqw", y: "-4.8cqw", size: 8, delay: 110, hue: 82 },
  { x: "9.6cqw", y: "-4.3cqw", size: 10, delay: 90, hue: 292 },
  { x: "-8.7cqw", y: "7.6cqw", size: 9, delay: 125, hue: 215 },
  { x: "8.3cqw", y: "7.8cqw", size: 8, delay: 115, hue: 25 },
  { x: "-3.8cqw", y: "-4.1cqw", size: 24, delay: 0, hue: 172 },
  { x: "3.9cqw", y: "-3.5cqw", size: 22, delay: 15, hue: 322 },
  { x: "-3.2cqw", y: "4.3cqw", size: 20, delay: 25, hue: 52 },
  { x: "3.4cqw", y: "4.1cqw", size: 18, delay: 40, hue: 202 },
] as const;

export function ColorBubbleBurst({ activeItem, category }: ColorBubbleBurstProps) {
  if (!activeItem) return null;

  return (
    <div
      className={`color-bubble-burst color-bubble-burst-${category || "full"}`}
      aria-hidden="true"
      data-testid="color-bubble-burst"
    >
      <span className="color-bubble-burst-flash" />
      <span className="color-bubble-burst-ring color-bubble-burst-ring-outer" />
      <span className="color-bubble-burst-ring color-bubble-burst-ring-inner" />
      <img
        className="color-bubble-burst-art"
        src={publicAsset("/game/effects/color-bubble-burst.gif")}
        alt=""
        draggable={false}
      />
      {burstBubbles.map((bubble, index) => (
        <span
          key={index}
          className="color-bubble-burst-particle"
          style={
            {
              "--burst-x": bubble.x,
              "--burst-y": bubble.y,
              "--bubble-size": `${bubble.size}px`,
              "--bubble-delay": `${bubble.delay}ms`,
              "--bubble-hue": bubble.hue,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
