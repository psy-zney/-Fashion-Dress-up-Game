import { type Category } from "./studio";

export type EffectMode = "normal" | "cloud" | "smoke";

export interface EffectController {
  play: (mode: EffectMode, category?: Category) => void;
  stop: () => void;
  destroy: () => void;
}

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function createEffectController(canvas: HTMLCanvasElement): EffectController {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return {
      play: () => {},
      stop: () => {},
      destroy: () => {},
    };
  }

  // Offscreen videos
  const cloudVideo = document.createElement("video");
  cloudVideo.src = `${basePath}/game/effects/cloud.webm`;
  cloudVideo.muted = true;
  cloudVideo.playsInline = true;
  cloudVideo.preload = "auto";

  const smokeVideo = document.createElement("video");
  smokeVideo.src = `${basePath}/game/effects/smoke.mp4`;
  smokeVideo.muted = true;
  smokeVideo.playsInline = true;
  smokeVideo.preload = "auto";

  // Shared processing canvas for frame extraction
  const offscreen = document.createElement("canvas");
  const offCtx = offscreen.getContext("2d", { willReadFrequently: true });

  let animId: number | null = null;
  let activeVideo: HTMLVideoElement | null = null;
  let startTime = 0;
  let duration = 1.3;
  let currentMode: EffectMode = "normal";
  let targetYRatio = 0.44;

  function stop() {
    if (animId !== null) {
      cancelAnimationFrame(animId);
      animId = null;
    }
    if (activeVideo) {
      activeVideo.pause();
      activeVideo = null;
    }
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  }

  function renderFrame(now: number) {
    if (!activeVideo || !ctx || !offCtx) return;

    const elapsed = (now - startTime) / 1000;
    if (elapsed >= duration || activeVideo.ended) {
      stop();
      return;
    }

    const vw = activeVideo.videoWidth || 768;
    const vh = activeVideo.videoHeight || 432;

    if (offscreen.width !== vw || offscreen.height !== vh) {
      offscreen.width = vw;
      offscreen.height = vh;
    }

    offCtx.drawImage(activeVideo, 0, 0, vw, vh);
    const imgData = offCtx.getImageData(0, 0, vw, vh);
    const d = imgData.data;

    let globalAlpha = 1.0;
    let scaleMultiplier = 1.0;

    if (currentMode === "smoke") {
      // Chroma key out green (#00fc0c)
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const maxRB = r > b ? r : b;
        const diff = g - maxRB;

        if (diff > 25) {
          if (diff > 65) {
            d[i + 3] = 0;
          } else {
            d[i + 3] = Math.round(((65 - diff) / 40) * 255);
            d[i + 1] = maxRB; // suppress green fringe
          }
        }
      }
      scaleMultiplier = 1.3;
    } else if (currentMode === "cloud") {
      // Luma key out black background
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const maxVal = r > g ? (r > b ? r : b) : (g > b ? g : b);

        if (maxVal < 35) {
          d[i + 3] = 0;
        } else if (maxVal < 70) {
          d[i + 3] = Math.round(((maxVal - 35) / 35) * 255);
        }
      }

      // Pop-in and fade-out envelope for cloud
      if (elapsed < 0.18) {
        // Quick expansion pop
        const t = elapsed / 0.18;
        scaleMultiplier = 0.5 + 0.75 * Math.sin((t * Math.PI) / 2);
        globalAlpha = t;
      } else if (elapsed > 0.85) {
        // Fade out & expand slightly
        const t = (elapsed - 0.85) / (duration - 0.85);
        scaleMultiplier = 1.25 + 0.15 * t;
        globalAlpha = Math.max(0, 1 - t);
      } else {
        scaleMultiplier = 1.25;
        globalAlpha = 1.0;
      }
    }

    offCtx.putImageData(imgData, 0, 0);

    // Draw onto destination canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.globalAlpha = globalAlpha;

    const targetW = canvas.width * scaleMultiplier;
    const targetH = (vh / vw) * targetW;
    const targetX = (canvas.width - targetW) / 2;
    const targetY = canvas.height * targetYRatio - targetH / 2;

    ctx.drawImage(offscreen, targetX, targetY, targetW, targetH);
    ctx.restore();

    animId = requestAnimationFrame(renderFrame);
  }

  function play(mode: EffectMode, category?: Category) {
    stop();
    if (mode === "normal") return;

    currentMode = mode;
    activeVideo = mode === "cloud" ? cloudVideo : smokeVideo;
    duration = mode === "cloud" ? 1.2 : 1.28;

    // Center vertical location based on clothing category
    if (category === "tops") {
      targetYRatio = 0.32;
    } else if (category === "bottoms") {
      targetYRatio = 0.52;
    } else if (category === "shoes") {
      targetYRatio = 0.78;
    } else {
      targetYRatio = 0.44;
    }

    activeVideo.currentTime = 0;
    const playPromise = activeVideo.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          startTime = performance.now();
          animId = requestAnimationFrame(renderFrame);
        })
        .catch(() => {
          // Playback might be blocked or cancelled
        });
    }
  }

  function destroy() {
    stop();
    cloudVideo.src = "";
    smokeVideo.src = "";
  }

  return {
    play,
    stop,
    destroy,
  };
}
