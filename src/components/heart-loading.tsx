"use client";

import { useEffect, useState } from "react";
import { preloadAllAssets, isAssetsPreloaded } from "@/lib/asset-preloader";

interface HeartLoadingProps {
  active: boolean;
  onFinish?: () => void;
  minDurationMs?: number;
  title?: string;
}

export function HeartLoading({
  active,
  onFinish,
  minDurationMs = 1800,
  title = "PREPARING FASHION STUDIO…",
}: HeartLoadingProps) {
  const [progress, setProgress] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!active) {
      setHidden(true);
      return;
    }

    // If already preloaded and no min duration requested, skip immediately
    if (isAssetsPreloaded() && minDurationMs <= 0) {
      setHidden(true);
      onFinish?.();
      return;
    }

    setHidden(false);
    setIsExiting(false);
    setError("");
    setProgress(0);

    const startTime = performance.now();
    let isMounted = true;

    // Start loading assets
    const preloadPromise = preloadAllAssets((p) => {
      if (isMounted) {
        setProgress((prev) => Math.max(prev, p));
      }
    }, { force: true });

    // Ensure smooth display duration for the heart animation
    const minTimerPromise = new Promise((resolve) => setTimeout(resolve, minDurationMs));

    Promise.all([preloadPromise, minTimerPromise]).then(() => {
      if (!isMounted) return;
      setProgress(100);
      setTimeout(() => {
        if (!isMounted) return;
        setIsExiting(true);
        setTimeout(() => {
          if (!isMounted) return;
          setHidden(true);
          onFinish?.();
        }, 350);
      }, 200);
    }).catch(() => {
      if (!isMounted) return;
      setError("Some game assets could not be loaded. Check your connection and retry.");
    });

    return () => {
      isMounted = false;
    };
  }, [active, attempt, minDurationMs, onFinish]);

  if (hidden) return null;

  return (
    <div
      className={`playful-loading-overlay heart-loading-overlay ${isExiting ? "is-exiting" : ""}`}
      role="status"
      aria-label="Loading fashion game assets"
      aria-live="polite"
      data-testid="heart-loader"
    >
      <div className="heart-loading-box">
        {/* Large, prominent ECG pulse heart loader */}
        <svg
          className="heart"
          viewBox="-5 -5 278 56"
          version="1.1"
          id="svg5"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <filter id="heartGlowBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
          <g transform="translate(29.1 -127.42)" id="layer1">
            <path
              pathLength={1}
              d="M-28.73 167.2c26.43 9.21 68.46-9.46 85.45-12.03 18.45-2.78 32.82 4.86 28.75 9.83-3.82 4.66-25.77-21.18-14.81-31.5 9.54-8.98 17.64 10.64 16.42 17.06-1.51-6.2 2.95-26.6 14.74-22.11 11.7 4.46-4.33 49.03-15.44 44.08-6.97-3.1 15.44-16.26 26.1-16 23.03.56 55.6 27.51 126.63 3.36"
              id="line"
            />
          </g>
          <g transform="translate(29.1 -127.42)" id="layer2">
            <path
              pathLength={1}
              d="M-28.73 167.2c26.43 9.21 68.46-9.46 85.45-12.03 18.45-2.78 32.82 4.86 28.75 9.83-3.82 4.66-25.77-21.18-14.81-31.5 9.54-8.98 17.64 10.64 16.42 17.06-1.51-6.2 2.95-26.6 14.74-22.11 11.7 4.46-4.33 49.03-15.44 44.08-6.97-3.1 15.44-16.26 26.1-16 23.03.56 55.6 27.51 126.63 3.36"
              id="point"
              filter="url(#heartGlowBlur)"
            />
          </g>
        </svg>

        {/* Progress percent & glowing status text */}
        <div className="heart-loading-meta">
          <span className="heart-loading-percent">{progress}%</span>
          <span className="heart-loading-text">{title}</span>
          <div className="heart-loading-track" aria-hidden="true">
            <span className="heart-loading-fill" style={{ width: `${progress}%` }} />
          </div>
          {error && <>
            <span className="heart-loading-error">{error}</span>
            <button type="button" className="heart-loading-retry" onClick={() => setAttempt((value) => value + 1)}>Retry loading</button>
          </>}
        </div>
      </div>
    </div>
  );
}
