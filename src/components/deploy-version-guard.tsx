"use client";

import { useEffect } from "react";
import { DEPLOY_VERSION } from "@/lib/public-asset";

const RELOAD_KEY = "tung-tung-deploy-reload";

export function DeployVersionGuard() {
  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
        const response = await fetch(`${basePath}/deploy-version.json?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!response.ok || !active) return;

        const payload = await response.json() as { version?: string };
        const latestVersion = payload.version;
        if (!latestVersion || latestVersion === DEPLOY_VERSION) {
          sessionStorage.removeItem(RELOAD_KEY);
          return;
        }

        if (sessionStorage.getItem(RELOAD_KEY) === latestVersion) return;
        sessionStorage.setItem(RELOAD_KEY, latestVersion);

        if ("caches" in window) {
          const names = await window.caches.keys();
          await Promise.all(names.map((name) => window.caches.delete(name)));
        }

        const url = new URL(window.location.href);
        url.searchParams.set("deploy", latestVersion);
        window.location.replace(url.toString());
      } catch {
        // Offline visits keep using the last complete deployment.
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return null;
}
