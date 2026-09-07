"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  decay: number;
  sparkle: boolean;
}

interface Rocket {
  x: number;
  y: number;
  targetY: number;
  vy: number;
  color: string;
}

interface AnimeBokeh {
  x: number;
  y: number;
  radius: number;
  speedY: number;
  swaySpeed: number;
  swayAmp: number;
  phase: number;
  alpha: number;
  maxAlpha: number;
  colorType: "white" | "cyan" | "gold" | "lavender";
}

interface AnimeStar {
  x: number;
  y: number;
  size: number;
  alpha: number;
  maxAlpha: number;
  phase: number;
  twinkleSpeed: number;
  rotation: number;
  color: string;
}

interface LightMote {
  x: number;
  y: number;
  speedY: number;
  speedX: number;
  size: number;
  alpha: number;
  pulsePhase: number;
}

const FIREWORK_PALETTES = [
  ["#f43f5e", "#fb7185", "#fda4af", "#fff1f2", "#fbbf24"], // Rose Gold
  ["#38bdf8", "#0ea5e9", "#7dd3fc", "#e0f2fe", "#a7f3d0"], // Ice Cyan
  ["#a855f7", "#c084fc", "#e9d5ff", "#fbcfe8", "#f43f5e"], // Magic Purple
  ["#fbbf24", "#f59e0b", "#fde68a", "#fffbeb", "#ffffff"], // Golden Champagne
  ["#10b981", "#34d399", "#6ee7b7", "#a7f3d0", "#fbbf24"], // Emerald Spark
];

export function Fireworks({ active = true }: { active?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrame: number;
    let particles: Particle[] = [];
    let rockets: Rocket[] = [];
    let bokehList: AnimeBokeh[] = [];
    let starsList: AnimeStar[] = [];
    let motesList: LightMote[] = [];
    let isMounted = true;
    let width = 0;
    let height = 0;

    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx?.scale(dpr, dpr);
    }

    resize();
    window.addEventListener("resize", resize);

    // Initialize Anime Bokeh Orbs (Image 2 aesthetic)
    const bokehCount = 18;
    const colorTypes: AnimeBokeh["colorType"][] = ["white", "cyan", "gold", "lavender"];
    for (let i = 0; i < bokehCount; i++) {
      bokehList.push({
        x: Math.random() * (width || 1000),
        y: Math.random() * (height || 700),
        radius: 22 + Math.random() * 55,
        speedY: 0.35 + Math.random() * 0.65,
        swaySpeed: 0.008 + Math.random() * 0.015,
        swayAmp: 0.4 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.1 + Math.random() * 0.3,
        maxAlpha: 0.35 + Math.random() * 0.35,
        colorType: colorTypes[i % colorTypes.length],
      });
    }

    // Initialize Anime 4-Point Sparkle Stars (Image 2 Fairy Tail glints)
    const starCount = 22;
    const starColors = ["#ffffff", "#e0f2fe", "#fef08a", "#fbcfe8", "#d1fae5"];
    for (let i = 0; i < starCount; i++) {
      starsList.push({
        x: Math.random() * (width || 1000),
        y: Math.random() * (height || 700),
        size: 7 + Math.random() * 14,
        alpha: Math.random(),
        maxAlpha: 0.65 + Math.random() * 0.35,
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.02 + Math.random() * 0.035,
        rotation: (Math.random() - 0.5) * 0.4,
        color: starColors[Math.floor(Math.random() * starColors.length)],
      });
    }

    // Initialize Anime Light Dust / Motes
    const moteCount = 35;
    for (let i = 0; i < moteCount; i++) {
      motesList.push({
        x: Math.random() * (width || 1000),
        y: Math.random() * (height || 700),
        speedY: 0.2 + Math.random() * 0.5,
        speedX: (Math.random() - 0.5) * 0.3,
        size: 1.2 + Math.random() * 2.2,
        alpha: 0.2 + Math.random() * 0.6,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    function createExplosion(x: number, y: number, palette: string[]) {
      const count = 46 + Math.floor(Math.random() * 22);
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
        const speed = 2.4 + Math.random() * 5.2;
        const color = palette[Math.floor(Math.random() * palette.length)];
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color,
          size: 2.2 + Math.random() * 2.8,
          alpha: 1,
          decay: 0.012 + Math.random() * 0.016,
          sparkle: Math.random() > 0.35,
        });
      }
    }

    function launchRocket() {
      if (!canvas || width <= 0 || height <= 0) return;

      // Burst fireworks across outer thirds so the styled doll is unobstructed
      const side = Math.random();
      const x = side < 0.45 ? width * (0.06 + Math.random() * 0.32) : width * (0.62 + Math.random() * 0.32);
      const targetY = height * (0.12 + Math.random() * 0.38);
      const palette = FIREWORK_PALETTES[Math.floor(Math.random() * FIREWORK_PALETTES.length)];
      rockets.push({
        x,
        y: height + 10,
        targetY,
        vy: -7.5 - Math.random() * 3.5,
        color: palette[0],
      });
    }

    // Launch festive salvo
    setTimeout(launchRocket, 50);
    setTimeout(launchRocket, 300);
    setTimeout(launchRocket, 650);

    const interval = setInterval(() => {
      if (isMounted && rockets.length < 4) launchRocket();
    }, 750);

    function drawAnimeStar(
      context: CanvasRenderingContext2D,
      x: number,
      y: number,
      size: number,
      alpha: number,
      rotation: number,
      color: string,
    ) {
      context.save();
      context.translate(x, y);
      context.rotate(rotation);
      context.globalAlpha = Math.max(0, Math.min(1, alpha));

      // Circular soft aura behind star
      const glow = context.createRadialGradient(0, 0, 0, 0, 0, size * 2.2);
      glow.addColorStop(0, "rgba(255, 255, 255, 0.9)");
      glow.addColorStop(0.35, color);
      glow.addColorStop(1, "rgba(255, 255, 255, 0)");
      context.fillStyle = glow;
      context.beginPath();
      context.arc(0, 0, size * 2.2, 0, Math.PI * 2);
      context.fill();

      // 4-pointed diamond star body with flared curved tips
      context.fillStyle = "#ffffff";
      context.beginPath();
      context.moveTo(0, -size * 1.8);
      context.quadraticCurveTo(0, 0, size * 0.32, 0);
      context.lineTo(size * 1.8, 0);
      context.quadraticCurveTo(0, 0, 0, size * 0.32);
      context.lineTo(0, size * 1.8);
      context.quadraticCurveTo(0, 0, -size * 0.32, 0);
      context.lineTo(-size * 1.8, 0);
      context.quadraticCurveTo(0, 0, 0, -size * 0.32);
      context.closePath();
      context.fill();

      // Long vertical and horizontal cross flare spikes
      context.strokeStyle = "rgba(255, 255, 255, 0.88)";
      context.lineWidth = 1.3;
      context.beginPath();
      context.moveTo(0, -size * 3.4);
      context.lineTo(0, size * 3.4);
      context.moveTo(-size * 3.4, 0);
      context.lineTo(size * 3.4, 0);
      context.stroke();

      // Bright center sparkle core
      context.fillStyle = "#ffffff";
      context.beginPath();
      context.arc(0, 0, size * 0.38, 0, Math.PI * 2);
      context.fill();

      context.restore();
    }

    function tick() {
      if (!canvas || !ctx || width <= 0 || height <= 0) return;

      ctx.clearRect(0, 0, width, height);

      // 1. Render Anime Bokeh Orbs (Image 2 shoujo / bishonen dreamy bokeh)
      for (const orb of bokehList) {
        orb.y -= orb.speedY;
        orb.phase += orb.swaySpeed;
        orb.x += Math.sin(orb.phase) * orb.swayAmp;

        // Wrap around top to bottom
        if (orb.y < -orb.radius * 2) {
          orb.y = height + orb.radius;
          orb.x = Math.random() * width;
        }

        const pulse = 0.5 + 0.5 * Math.sin(orb.phase * 2);
        const currentAlpha = orb.alpha + (orb.maxAlpha - orb.alpha) * pulse;

        ctx.save();
        const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.radius);
        if (orb.colorType === "white") {
          grad.addColorStop(0, `rgba(255, 255, 255, ${currentAlpha * 0.75})`);
          grad.addColorStop(0.4, `rgba(255, 255, 255, ${currentAlpha * 0.35})`);
          grad.addColorStop(0.85, `rgba(255, 255, 255, ${currentAlpha * 0.12})`);
          grad.addColorStop(1, "rgba(255, 255, 255, 0)");
        } else if (orb.colorType === "cyan") {
          grad.addColorStop(0, `rgba(224, 242, 254, ${currentAlpha * 0.8})`);
          grad.addColorStop(0.45, `rgba(186, 230, 253, ${currentAlpha * 0.4})`);
          grad.addColorStop(0.88, `rgba(125, 211, 252, ${currentAlpha * 0.1})`);
          grad.addColorStop(1, "rgba(224, 242, 254, 0)");
        } else if (orb.colorType === "gold") {
          grad.addColorStop(0, `rgba(254, 240, 138, ${currentAlpha * 0.75})`);
          grad.addColorStop(0.45, `rgba(253, 230, 138, ${currentAlpha * 0.35})`);
          grad.addColorStop(0.88, `rgba(252, 211, 77, ${currentAlpha * 0.1})`);
          grad.addColorStop(1, "rgba(254, 240, 138, 0)");
        } else {
          grad.addColorStop(0, `rgba(245, 208, 254, ${currentAlpha * 0.75})`);
          grad.addColorStop(0.45, `rgba(233, 213, 255, ${currentAlpha * 0.35})`);
          grad.addColorStop(0.88, `rgba(192, 132, 252, ${currentAlpha * 0.1})`);
          grad.addColorStop(1, "rgba(245, 208, 254, 0)");
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
        ctx.fill();

        // Subtle crisp lens bokeh ring
        ctx.strokeStyle = `rgba(255, 255, 255, ${currentAlpha * 0.45})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.restore();
      }

      // 2. Render Anime Light Motes / Fairy Dust
      for (const mote of motesList) {
        mote.y -= mote.speedY;
        mote.x += mote.speedX;
        mote.pulsePhase += 0.04;

        if (mote.y < -10) {
          mote.y = height + 10;
          mote.x = Math.random() * width;
        }

        const alpha = mote.alpha * (0.6 + 0.4 * Math.sin(mote.pulsePhase));
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "#7dd3fc";
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(mote.x, mote.y, mote.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 3. Render Anime 4-Point Sparkle Stars (Image 2)
      for (const star of starsList) {
        star.phase += star.twinkleSpeed;
        const cycle = Math.sin(star.phase);
        // Twinkling scale & alpha
        if (cycle < -0.6) {
          // Respawn in a new pleasant spot when fully dimmed
          star.x = Math.random() * width;
          star.y = Math.random() * height;
          star.rotation = (Math.random() - 0.5) * 0.5;
        }

        const norm = Math.max(0, cycle);
        const starAlpha = norm * star.maxAlpha;
        const currentSize = star.size * (0.8 + 0.35 * norm);

        if (starAlpha > 0.03) {
          drawAnimeStar(ctx, star.x, star.y, currentSize, starAlpha, star.rotation, star.color);
        }
      }

      // 4. Render Fireworks Rockets
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.y += r.vy;
        r.vy *= 0.985;

        // Spark trail
        ctx.fillStyle = r.color;
        ctx.shadowColor = r.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 2.6, 0, Math.PI * 2);
        ctx.fill();

        if (r.y <= r.targetY || r.vy >= -1.2) {
          const palette = FIREWORK_PALETTES[Math.floor(Math.random() * FIREWORK_PALETTES.length)];
          createExplosion(r.x, r.y, palette);
          rockets.splice(i, 1);
        }
      }

      // 5. Render Fireworks Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.965;
        p.vy *= 0.965;
        p.vy += 0.08; // subtle gravity
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.sparkle && Math.random() > 0.35 ? p.alpha * 0.6 : p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.size * 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.alpha, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animationFrame = requestAnimationFrame(tick);
    }

    animationFrame = requestAnimationFrame(tick);

    return () => {
      isMounted = false;
      clearInterval(interval);
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fireworks-canvas"
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 15,
      }}
    />
  );
}
