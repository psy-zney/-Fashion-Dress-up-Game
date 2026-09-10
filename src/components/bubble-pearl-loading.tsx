"use client";

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type TouchEvent } from "react";
import { preloadAllAssets, isAssetsPreloaded } from "@/lib/asset-preloader";
import { playBubblePop } from "@/lib/sound-effects";
import { publicAsset } from "@/lib/public-asset";

interface BubblePearlLoadingProps {
  active: boolean;
  onFinish?: () => void;
  minDurationMs?: number;
  title?: string;
  showStatusText?: boolean;
}

// 23 Original Circles extracted from Figma Frame 112:147 ("Loading page")
const FIGMA_CIRCLES_DEF = [
  { id: "113:193", name: "Ellipse 60", x: 317, y: 264, size: 350, hex: "#DE3C2A" },
  { id: "113:194", name: "Ellipse 61", x: 771, y: 191, size: 248, hex: "#F0A4C0" },
  { id: "113:195", name: "Ellipse 62", x: 575, y: 296, size: 145, hex: "#D8E85A" },
  { id: "113:196", name: "Ellipse 63", x: 215, y: 34, size: 315, hex: "#93F1DD" },
  { id: "113:197", name: "Ellipse 64", x: -83, y: -56, size: 437, hex: "#FFDE59" },
  { id: "113:198", name: "Ellipse 65", x: 205, y: 290, size: 149, hex: "#F0A4C0" },
  { id: "113:199", name: "Ellipse 66", x: 1043, y: -95, size: 464, hex: "#FFDE59" },
  { id: "113:200", name: "Ellipse 67", x: 1251, y: 614, size: 377, hex: "#F0A4C0" },
  { id: "113:201", name: "Ellipse 68", x: 530, y: 533, size: 185, hex: "#F0A4C0" },
  { id: "113:202", name: "Ellipse 69", x: -30, y: 625, size: 185, hex: "#F0A4C0" },
  { id: "113:203", name: "Ellipse 70", x: 980, y: 335, size: 126, hex: "#93F1DD" },
  { id: "113:204", name: "Ellipse 71", x: -30, y: 514, size: 427, hex: "#89B4E1" },
  { id: "113:205", name: "Ellipse 72", x: 317, y: 533, size: 94, hex: "#93F1DD" },
  { id: "113:206", name: "Ellipse 73", x: 917, y: 99, size: 165, hex: "#89B4E1" },
  { id: "113:207", name: "Ellipse 74", x: 1251, y: 587, size: 131, hex: "#93F1DD" },
  { id: "113:208", name: "Ellipse 75", x: 354, y: -121, size: 254, hex: "#D8E85A" },
  { id: "113:209", name: "Ellipse 76", x: 882, y: 625, size: 274, hex: "#D8E85A" },
  { id: "113:210", name: "Ellipse 77", x: 1070, y: 599, size: 72, hex: "#DE3C2A" },
  { id: "113:211", name: "Ellipse 78", x: 652, y: 398, size: 59, hex: "#89B4E1" },
  { id: "113:212", name: "Ellipse 79", x: 941, y: 163, size: 59, hex: "#DE3C2A" },
  { id: "113:213", name: "Ellipse 80", x: 853, y: 381, size: 218, hex: "#89B4E1" },
  { id: "113:214", name: "Ellipse 81", x: 1347, y: 283, size: 131, hex: "#D8E85A" },
  { id: "113:215", name: "Ellipse 82", x: 806, y: 712, size: 152, hex: "#F0A4C0" },
];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

interface DynamicBubble {
  id: string;
  name: string;
  baseXRatio: number;
  baseYRatio: number;
  baseRadiusRatio: number;
  hex: string;
  rgb: [number, number, number];

  x: number;
  y: number;
  radius: number;
  targetRadius: number;
  currentRadius: number;
  vx: number;
  vy: number;
  phaseX: number;
  phaseY: number;
  phaseScale: number;
  wobbleSpeed: number;
  ampX: number;
  ampY: number;

  popping: boolean;
  popScale: number;
  respawnTime: number;
}

interface SparkleParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

interface PearlWakeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
}

export function BubblePearlLoading({
  active,
  onFinish,
  minDurationMs = 2600,
  title = "PREPARING FASHION STUDIO…",
  showStatusText = true,
}: BubblePearlLoadingProps) {
  const [progress, setProgress] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({ x: -999, y: -999, active: false });
  const bubblesRef = useRef<DynamicBubble[]>([]);
  const sparklesRef = useRef<SparkleParticle[]>([]);
  const wakeRef = useRef<PearlWakeParticle[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const isExitingRef = useRef(false);

  // Steady progress pacing references
  const rawAssetProgressRef = useRef(0);
  const assetsDoneRef = useRef(false);
  const startTimeRef = useRef(0);
  const displayProgressRef = useRef(0);
  const lastStateUpdateRef = useRef(0);
  const exitTriggeredRef = useRef(false);
  const isMobileRef = useRef(false);

  isExitingRef.current = isExiting;

  useEffect(() => {
    if (!active) {
      setHidden(true);
      return;
    }

    if (isAssetsPreloaded() && minDurationMs <= 0) {
      setHidden(true);
      onFinish?.();
      return;
    }

    setHidden(false);
    setIsExiting(false);
    setError("");
    setProgress(0);
    rawAssetProgressRef.current = 0;
    assetsDoneRef.current = false;
    startTimeRef.current = performance.now();
    displayProgressRef.current = 0;
    exitTriggeredRef.current = false;

    let isMounted = true;

    preloadAllAssets(
      (p) => {
        if (isMounted) {
          rawAssetProgressRef.current = Math.max(rawAssetProgressRef.current, p);
        }
      },
      { force: true }
    )
      .then(() => {
        if (!isMounted) return;
        assetsDoneRef.current = true;
        rawAssetProgressRef.current = 100;
      })
      .catch(() => {
        if (!isMounted) return;
        setError("Some game assets could not be loaded. Check your connection and retry.");
      });

    return () => {
      isMounted = false;
    };
  }, [active, attempt, minDurationMs, onFinish]);

  // Initialize and run interactive canvas loop
  useEffect(() => {
    if (hidden) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const updateMobileStatus = () => {
      isMobileRef.current = width < 768;
    };
    updateMobileStatus();

    // Responsive scaling & positioning calculator
    const computeBubbleLayout = () => {
      const isMobile = width < 768;
      const isPortrait = height > width;

      let scaleFactor: number;
      if (!isMobile) {
        // Desktop / tablet landscape: preserve exact Figma 1440x1024 proportion
        scaleFactor = Math.min(width / 1440, height / 1024);
      } else if (isPortrait) {
        // Mobile portrait: scale generously so bubbles are juicy and easy to tap
        scaleFactor = Math.max(width / 520, 0.65);
      } else {
        // Mobile landscape
        scaleFactor = Math.max(height / 480, 0.58);
      }

      return { isMobile, isPortrait, scaleFactor };
    };

    const handleResize = () => {
      if (!canvas) return;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      updateMobileStatus();

      const { scaleFactor } = computeBubbleLayout();
      bubblesRef.current.forEach((b) => {
        b.targetRadius = b.baseRadiusRatio * 1440 * scaleFactor;
        b.radius = b.targetRadius;
      });
    };

    window.addEventListener("resize", handleResize);

    // Initialize 23 Figma bubbles with responsive mobile distribution
    const { isMobile, isPortrait, scaleFactor } = computeBubbleLayout();
    bubblesRef.current = FIGMA_CIRCLES_DEF.map((def, i) => {
      const centerX = def.x + def.size / 2;
      const centerY = def.y + def.size / 2;
      const radius = (def.size / 2) * scaleFactor;

      let startX: number;
      let startY: number;

      if (isMobile && isPortrait) {
        // On mobile portrait, gracefully distribute across the entire screen height
        // while preserving the relative cluster harmony
        const normX = Math.max(0, Math.min(1, (centerX - 50) / 1300));
        const normY = Math.max(0, Math.min(1, (centerY + 20) / 840));
        startX = (0.08 + normX * 0.84) * width;
        startY = (0.07 + normY * 0.84) * height;
      } else {
        startX = (centerX / 1440) * width;
        startY = (centerY / 1024) * height;
      }

      // Gentle natural velocity
      const angle = Math.random() * Math.PI * 2;
      const speed = isMobile ? 0.2 + Math.random() * 0.35 : 0.25 + Math.random() * 0.45;

      return {
        id: def.id,
        name: def.name,
        baseXRatio: centerX / 1440,
        baseYRatio: centerY / 1024,
        baseRadiusRatio: def.size / 2 / 1440,
        hex: def.hex,
        rgb: hexToRgb(def.hex),

        x: startX,
        y: startY,
        radius,
        targetRadius: radius,
        currentRadius: radius,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        phaseX: (i * 0.73) % (Math.PI * 2),
        phaseY: (i * 1.17) % (Math.PI * 2),
        phaseScale: (i * 0.51) % (Math.PI * 2),
        wobbleSpeed: 0.0016 + (i % 5) * 0.0003,
        ampX: isMobile ? 12 + (i % 4) * 6 : 18 + (i % 4) * 8,
        ampY: isMobile ? 10 + (i % 3) * 5 : 15 + (i % 3) * 7,

        popping: false,
        popScale: 1,
        respawnTime: 0,
      };
    });

    let lastTime = performance.now();
    let wakeSpawnCounter = 0;

    const render = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.064);
      lastTime = time;

      // 1. Calculate Steady Progress ("Chạy đều")
      const now = performance.now();
      const elapsed = Math.max(0, (now - startTimeRef.current) / 1000);
      const totalMinSec = Math.max(0.6, minDurationMs / 1000);
      const timeRatio = Math.min(1, elapsed / totalMinSec);

      // Target progress determination:
      // Time-based linear progression advances steadily up to 98%.
      // Real asset progress ensures we advance if assets take longer or lead.
      // 100% is only unlocked when BOTH real assets are loaded AND minDuration has elapsed.
      let targetProgress: number;
      if (assetsDoneRef.current && elapsed >= totalMinSec) {
        targetProgress = 100;
      } else {
        const timeSteadyProgress = timeRatio * 96;
        const realAssetProgress = rawAssetProgressRef.current * 0.95;
        targetProgress = Math.min(98, Math.max(timeSteadyProgress, realAssetProgress));
      }

      // Smooth constant step per frame so progress NEVER jumps abruptly
      const standardSpeed = 100 / totalMinSec; // % per second
      const diff = targetProgress - displayProgressRef.current;
      if (diff > 0) {
        const speed = targetProgress >= 100
          ? Math.max(standardSpeed * 1.5, diff * 5)
          : Math.min(standardSpeed * 1.35, Math.max(standardSpeed * 0.85, diff * 2.5));
        displayProgressRef.current = Math.min(targetProgress, displayProgressRef.current + speed * dt);
      }

      const curProgress = displayProgressRef.current;

      // Throttled React state update for DOM percentage & fill width (smooth 30-60fps state updates)
      if (now - lastStateUpdateRef.current > 30 || curProgress >= 100) {
        lastStateUpdateRef.current = now;
        setProgress(curProgress);
      }

      // When progress reaches 100%, trigger smooth exit sequence
      if (curProgress >= 99.8 && !exitTriggeredRef.current) {
        exitTriggeredRef.current = true;
        displayProgressRef.current = 100;
        setProgress(100);
        setTimeout(() => {
          setIsExiting(true);
          setTimeout(() => {
            setHidden(true);
            onFinish?.();
          }, 450);
        }, 250);
      }

      ctx.clearRect(0, 0, width, height);

      // Smooth background fill
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      const mouse = mouseRef.current;
      const exiting = isExitingRef.current;

      // Spawn wake particles behind rolling 3D pearl
      wakeSpawnCounter++;
      if (trackRef.current && curProgress > 0 && curProgress < 100 && wakeSpawnCounter % 3 === 0) {
        const rect = trackRef.current.getBoundingClientRect();
        const pearlX = rect.left + rect.width * (curProgress / 100);
        const pearlY = rect.top + rect.height / 2;

        wakeRef.current.push({
          x: pearlX + (Math.random() - 0.5) * 16,
          y: pearlY + (Math.random() - 0.5) * 12,
          vx: (Math.random() - 0.5) * 0.7,
          vy: -0.8 - Math.random() * 1.2,
          size: 4 + Math.random() * 8,
          alpha: 0.85,
        });
      }

      // Update and draw wake bubbles
      for (let i = wakeRef.current.length - 1; i >= 0; i--) {
        const p = wakeRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= dt * 0.9;
        p.size *= 0.985;

        if (p.alpha <= 0 || p.size <= 0.5) {
          wakeRef.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(106, 254, 255, ${Math.max(0, p.alpha * 0.75)})`;
        ctx.shadowColor = "rgba(106, 254, 255, 0.8)";
        ctx.shadowBlur = 8;
        ctx.fill();

        // Inner white shine
        ctx.beginPath();
        ctx.arc(p.x - p.size * 0.3, p.y - p.size * 0.3, p.size * 0.28, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, p.alpha * 0.9)})`;
        ctx.fill();
        ctx.restore();
      }

      // Update and draw 23 dynamic Figma bubbles
      bubblesRef.current.forEach((b) => {
        // Popping & respawning state
        if (b.popping) {
          b.popScale = Math.max(0, b.popScale - dt * 6.5);
          if (b.popScale <= 0) {
            b.respawnTime += dt;
            if (b.respawnTime > 1.2) {
              b.popping = false;
              b.popScale = 0.01;
            }
          }
        } else if (b.popScale < 1) {
          b.popScale = Math.min(1, b.popScale + dt * 3.2);
        }

        if (b.popScale <= 0) return;

        // Harmonic sway & velocity drift
        b.x += b.vx;
        b.y += b.vy;

        // Soft harmonic wander
        const swayX = Math.sin(time * b.wobbleSpeed + b.phaseX) * (b.ampX * dt * 2.5);
        const swayY = Math.cos(time * b.wobbleSpeed * 0.9 + b.phaseY) * (b.ampY * dt * 2.5);
        b.x += swayX;
        b.y += swayY;

        // Damping / speed limiter
        b.vx *= 0.995;
        b.vy *= 0.995;
        const currentSpeed = Math.hypot(b.vx, b.vy);
        if (currentSpeed < 0.25) {
          const boostAngle = Math.random() * Math.PI * 2;
          b.vx += Math.cos(boostAngle) * 0.12;
          b.vy += Math.sin(boostAngle) * 0.12;
        }

        // Soft boundary reflection
        const boundMargin = b.radius * 0.4;
        if (b.x - b.radius < -boundMargin) {
          b.vx = Math.abs(b.vx) + 0.15;
        } else if (b.x + b.radius > width + boundMargin) {
          b.vx = -Math.abs(b.vx) - 0.15;
        }
        if (b.y - b.radius < -boundMargin) {
          b.vy = Math.abs(b.vy) + 0.15;
        } else if (b.y + b.radius > height + boundMargin) {
          b.vy = -Math.abs(b.vy) - 0.15;
        }

        // Mouse deflection (liquid push effect)
        if (mouse.active) {
          const dx = b.x - mouse.x;
          const dy = b.y - mouse.y;
          const dist = Math.hypot(dx, dy);
          const influenceRadius = b.radius + 120;
          if (dist < influenceRadius && dist > 1) {
            const force = (1 - dist / influenceRadius) * 2.2;
            b.vx += (dx / dist) * force;
            b.vy += (dy / dist) * force;
          }
        }

        // Exit celebration dispersion
        if (exiting) {
          const cx = width / 2;
          const cy = height / 2;
          b.vx += (b.x - cx) * 0.035;
          b.vy += (b.y - cy) * 0.035;
        }

        // Soft elastic breathing
        const breath = 1 + 0.045 * Math.sin(time * 0.0022 + b.phaseScale);
        const squishX = 1 + 0.035 * Math.sin(time * 0.003 + b.phaseX);
        const squishY = 1 - 0.035 * Math.sin(time * 0.003 + b.phaseX);
        const drawRadiusX = b.radius * breath * squishX * b.popScale;
        const drawRadiusY = b.radius * breath * squishY * b.popScale;

        // Draw bubble with luminous color and subtle rim lighting
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, Math.max(1, drawRadiusX), Math.max(1, drawRadiusY), 0, 0, Math.PI * 2);

        const [r, g, bVal] = b.rgb;
        ctx.fillStyle = `rgb(${r}, ${g}, ${bVal})`;
        ctx.fill();

        // Subtle soft 3D highlight (gives playful bubble depth)
        const shineGrad = ctx.createRadialGradient(
          b.x - drawRadiusX * 0.28,
          b.y - drawRadiusY * 0.32,
          drawRadiusX * 0.05,
          b.x,
          b.y,
          drawRadiusX
        );
        shineGrad.addColorStop(0, "rgba(255, 255, 255, 0.45)");
        shineGrad.addColorStop(0.35, "rgba(255, 255, 255, 0.12)");
        shineGrad.addColorStop(1, "rgba(255, 255, 255, 0)");

        ctx.fillStyle = shineGrad;
        ctx.fill();
        ctx.restore();
      });

      // Update and draw pop sparkles
      for (let i = sparklesRef.current.length - 1; i >= 0; i--) {
        const s = sparklesRef.current[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vx *= 0.94;
        s.vy *= 0.94;
        s.vy += 0.08; // subtle gravity
        s.life++;
        s.alpha = Math.max(0, 1 - s.life / s.maxLife);

        if (s.life >= s.maxLife || s.alpha <= 0) {
          sparklesRef.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * s.alpha, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.globalAlpha = s.alpha;
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 10;
        ctx.fill();

        // Cross sparkle star
        const arm = s.size * s.alpha * 1.8;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(s.x - arm, s.y);
        ctx.lineTo(s.x + arm, s.y);
        ctx.moveTo(s.x, s.y - arm);
        ctx.lineTo(s.x, s.y + arm);
        ctx.stroke();
        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [hidden]);

  // Handle pointer interactions (mouse & touch)
  const handlePointerMove = (clientX: number, clientY: number) => {
    mouseRef.current = { x: clientX, y: clientY, active: true };
  };

  const handlePointerLeave = () => {
    mouseRef.current.active = false;
  };

  const lastTouchPopTimeRef = useRef(0);

  const handleClickOrTap = (clientX: number, clientY: number, isTouch = false) => {
    if (!isTouch && Date.now() - lastTouchPopTimeRef.current < 450) {
      // Suppress synthesized mouse event after touch on mobile
      return;
    }
    if (isTouch) {
      lastTouchPopTimeRef.current = Date.now();
    }

    const bubbles = bubblesRef.current;
    // Generous hit tolerance on touch screens for effortless tapping
    const hitTolerance = isTouch || isMobileRef.current ? 22 : 0;

    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      if (b.popping || b.popScale < 0.4) continue;

      const dist = Math.hypot(clientX - b.x, clientY - b.y);
      if (dist <= b.radius + hitTolerance) {
        // Pop this bubble!
        b.popping = true;
        b.popScale = 1;
        b.respawnTime = 0;

        playBubblePop(0.9 + Math.random() * 0.3, 0.85);

        // Mobile haptic vibration
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate(18);
          } catch {
            // Ignore unsupported environments
          }
        }

        // Spawn 16 sparkle starburst particles
        for (let j = 0; j < 16; j++) {
          const angle = (j / 16) * Math.PI * 2 + Math.random() * 0.4;
          const speed = 2.5 + Math.random() * 5.5;
          sparklesRef.current.push({
            x: b.x,
            y: b.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 3.5 + Math.random() * 4.5,
            color: b.hex,
            alpha: 1,
            life: 0,
            maxLife: 30 + Math.floor(Math.random() * 20),
          });
        }
        break;
      }
    }
  };

  if (hidden) return null;

  return (
    <div
      className={`figma-loading-overlay ${isExiting ? "is-exiting" : ""}`}
      role="status"
      aria-label="Loading fashion game assets"
      aria-live="polite"
      data-testid="heart-loader"
      onMouseMove={(e: MouseEvent<HTMLDivElement>) => handlePointerMove(e.clientX, e.clientY)}
      onMouseLeave={handlePointerLeave}
      onClick={(e: MouseEvent<HTMLDivElement>) => handleClickOrTap(e.clientX, e.clientY, false)}
      onTouchStart={(e: TouchEvent<HTMLDivElement>) => {
        if (e.touches[0]) {
          const t = e.touches[0];
          handlePointerMove(t.clientX, t.clientY);
          handleClickOrTap(t.clientX, t.clientY, true);
        }
      }}
      onTouchMove={(e: TouchEvent<HTMLDivElement>) => {
        if (e.touches[0]) handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }}
      onTouchEnd={handlePointerLeave}
    >
      {/* Living Dynamic Canvas for Motion Circles & Sparkles */}
      <canvas ref={canvasRef} className="figma-loading-canvas" aria-hidden="true" />

      {/* Interactive Hint */}
      <div className="figma-loading-tap-hint">Tap bubbles to pop! ✨</div>

      {/* Foreground Stage: Glassmorphic Loading Bar & 3D Cyan Pearl */}
      <div className="figma-loading-stage">
        <div className="figma-loading-bar-container">
          {/* Glassmorphic Track */}
          <div ref={trackRef} className="figma-loading-track">
            {/* Cyan-to-Teal Gradient Fill */}
            <div
              className="figma-loading-fill"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />

            {/* 3D Cyan Pearl Head with Glowing White Halo */}
            <div
              className="figma-loading-pearl-wrap"
              style={{
                left: `${Math.min(100, Math.max(0, progress))}%`,
              }}
            >
              <div className="figma-loading-pearl-halo" />
              <img
                src={publicAsset("/game/ui/cyan-pearl-3d.png")}
                alt=""
                className="figma-loading-pearl-img"
                draggable={false}
                style={
                  {
                    "--pearl-rot": `${progress * 7.2}deg`,
                  } as CSSProperties
                }
              />
            </div>
          </div>

          {/* Meta Information: Status & Percentage */}
          {showStatusText && (
            <div className="figma-loading-meta">
              <span className="figma-loading-text">{title}</span>
              <span className="figma-loading-percent">{Math.round(progress)}%</span>
            </div>
          )}

          {error && (
            <div className="figma-loading-error-box">
              <span className="figma-loading-error-text">{error}</span>
              <button
                type="button"
                className="figma-loading-retry-btn"
                onClick={() => setAttempt((v) => v + 1)}
              >
                Retry loading
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
