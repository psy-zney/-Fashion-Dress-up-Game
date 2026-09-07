"use client";

import { useEffect } from "react";

interface PlayfulLoadingProps {
  onFinish?: () => void;
  active: boolean;
}

/**
 * Loading is preloaded upfront before entering the main page.
 * Entering the studio hall has zero delay.
 */
export function PlayfulLoading({ onFinish, active }: PlayfulLoadingProps) {
  useEffect(() => {
    if (active) {
      onFinish?.();
    }
  }, [active, onFinish]);

  return null;
}
