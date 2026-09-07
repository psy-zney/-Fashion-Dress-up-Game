"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { initialFit, readLook, rememberLook, type Fit } from "@/lib/studio-look";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type KeyboardEvent } from "react";
import {
  STAGE,
  assetUrl,
  categories,
  garments,
  allGarments,
  layerOrder,
  foregroundArmsOrder,
  foregroundArmsPath,
  bootTuckBottomIds,
  previewAssetUrl,
  type Category,
  type Garment,
  type Selection,
} from "@/lib/studio";
import { playSound, type SoundEffect } from "@/lib/sound-effects";
import { initAudio } from "@/lib/audio-manager";
import { AudioSettingsModal } from "@/components/audio-settings-modal";
import { PlayfulLoading } from "@/components/playful-loading";
import { isAssetsPreloaded } from "@/lib/asset-preloader";
import { MagicBlingSparkles } from "@/components/magic-bling";

type DragPreview = {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  padding: string;
};

const fitFields = [
  { key: "x", label: "Horizontal", min: -100, max: 100, step: 1, suffix: " px" },
  { key: "y", label: "Vertical", min: -100, max: 100, step: 1, suffix: " px" },
  { key: "scaleX", label: "Width", min: 0.7, max: 1.3, step: 0.005, suffix: "×" },
  { key: "scaleY", label: "Length", min: 0.7, max: 1.3, step: 0.005, suffix: "×" },
  { key: "angle", label: "Rotate", min: -15, max: 15, step: 0.1, suffix: "°" },
] as const;

function PinIcon({ active }: { active: boolean }) {
  return <span aria-hidden="true">{active ? "●" : "○"}</span>;
}

export function DressUpStudio() {
  const router = useRouter();
  const armsClipId = useId();
  const [category, setCategory] = useState<Category>("tops");
  const [selected, setSelected] = useState<Selection>({});
  const [held, setHeld] = useState<Partial<Record<Category, boolean>>>({});
  const [fits, setFits] = useState<Record<string, Fit>>({});
  const [positionsLocked, setPositionsLocked] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState("Select or drag and drop an item to start styling.");
  const [audioModalOpen, setAudioModalOpen] = useState(false);
  const [loadingActive, setLoadingActive] = useState(() => !isAssetsPreloaded());

  // Drag & drop state
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [isDragOverStage, setIsDragOverStage] = useState(false);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [recentlyWorn, setRecentlyWorn] = useState<string | null>(null);
  const [recentlyWornCategory, setRecentlyWornCategory] = useState<Category | null>(null);
  const [menuPinned, setMenuPinned] = useState(false);
  const [menuHovered, setMenuHovered] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const pointerDrag = useRef<{ preview: DragPreview; startX: number; startY: number; active: boolean } | null>(null);
  const suppressClick = useRef(false);
  const outfitComplete = Boolean(selected.tops && selected.bottoms && selected.shoes);

  const menuOpen = menuPinned || menuHovered;

  useEffect(() => {
    function cancel(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        finishDrag();
        setMenuPinned(false);
        setMenuHovered(false);
      }
    }
    window.addEventListener("keydown", cancel);
    window.addEventListener("blur", finishDrag);
    return () => { window.removeEventListener("keydown", cancel); window.removeEventListener("blur", finishDrag); };
  }, []);

  useEffect(() => {
    const saved = readLook();
    setSelected(saved.selected);
    setFits(saved.fits);
    setHeld(saved.held);
    setHydrated(true);
    initAudio();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      rememberLook({ selected, fits, held });
    } catch {
      setStatus("Unable to save current outfit in browser storage.");
    }
  }, [fits, held, hydrated, selected]);

  function garmentLayer(item: Garment) {
    if (
      item.id === "shoes-brown-boots" &&
      selected.bottoms && bootTuckBottomIds.has(selected.bottoms)
    ) {
      return 35;
    }
    return layerOrder[item.category];
  }

  const layers = useMemo(
    () => allGarments
      .filter((item) => selected[item.category] === item.id)
      .sort((left, right) => garmentLayer(left) - garmentLayer(right)),
    [selected],
  );
  const visibleGarments = useMemo(
    () => garments.filter((item) => item.category === category),
    [category],
  );
  const activeId = selected[category];
  const activeItem = activeId ? allGarments.find((item) => item.id === activeId) : undefined;
  const activeFit = activeId ? fits[activeId] || initialFit : initialFit;

  function choose(id: string, sound: SoundEffect = "dress") {
    const item = allGarments.find((candidate) => candidate.id === id);
    if (!item) return;
    playSound(sound);
    setSelected((previous) => ({ ...previous, [item.category]: id }));
    setRecentlyWorn(id);
    setRecentlyWornCategory(item.category);
    setTimeout(() => {
      setRecentlyWorn((current) => (current === id ? null : current));
      setRecentlyWornCategory((current) => (current === item.category ? null : current));
    }, 700);
    setStatus(`Wearing ${item.name.toLowerCase()}.`);
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (event.button !== 0 || !event.isPrimary) return;
    suppressClick.current = false;
    const sticker = event.currentTarget.querySelector<HTMLImageElement>(".outfit-card-img");
    if (sticker) {
      const bounds = sticker.getBoundingClientRect();
      const computed = getComputedStyle(sticker);
      const hotspotX = event.clientX - bounds.left;
      const hotspotY = event.clientY - bounds.top;
      pointerDrag.current = { startX: event.clientX, startY: event.clientY, active: false, preview: {
        id,
        left: event.clientX - hotspotX,
        top: event.clientY - hotspotY,
        width: bounds.width,
        height: bounds.height,
        offsetX: hotspotX,
        offsetY: hotspotY,
        padding: computed.padding,
      } };
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = pointerDrag.current;
    if (!drag) return;
    if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 3) return;
    if (!drag.active) playSound("pickup");
    drag.active = true;
    suppressClick.current = true;
    setIsDragging(drag.preview.id);
    setDragPreview({ ...drag.preview, left: event.clientX - drag.preview.offsetX, top: event.clientY - drag.preview.offsetY });
    setIsDragOverStage(isOverStage(event.clientX, event.clientY));
  }

  function isOverStage(x: number, y: number) {
    const bounds = stageRef.current?.getBoundingClientRect();
    return Boolean(bounds && x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom);
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    const drag = pointerDrag.current;
    if (drag?.active && isOverStage(event.clientX, event.clientY)) choose(drag.preview.id, "drop");
    else if (drag?.active) playSound("cancel");
    finishDrag();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function finishDrag() {
    pointerDrag.current = null;
    setIsDragging(null);
    setIsDragOverStage(false);
    setDragPreview(null);
  }

  function activateCategory(nextCategory: Category) {
    if (nextCategory !== category) playSound("category");
    setCategory(nextCategory);
    setMenuPinned(false);
    setMenuHovered(false);
  }

  function handleSectorKeyDown(event: KeyboardEvent<SVGGElement>, nextCategory: Category) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activateCategory(nextCategory);
    }
  }

  function applyLook(proposed: Selection, label: string) {
    const next: Selection = { ...proposed };
    categories.forEach(({ id }) => {
      if (held[id] && selected[id]) next[id] = selected[id];
    });
    setSelected(next);
    setStatus(`Applied ${label}. Pinned items stayed in place.`);
  }

  function shuffle() {
    const next: Selection = {};
    const chooseRandom = (group: Category) => {
      const options = garments.filter((item) => item.category === group);
      return options[Math.floor(Math.random() * options.length)]?.id;
    };
    next.tops = chooseRandom("tops");
    next.bottoms = chooseRandom("bottoms");
    next.shoes = chooseRandom("shoes");
    applyLook(next, "random outfit");
    playSound("dress");
  }

  function removeActive() {
    if (!activeId) return;
    setSelected((previous) => {
      const next = { ...previous };
      delete next[category];
      return next;
    });
    setHeld((previous) => ({ ...previous, [category]: false }));
    playSound("click");
    setStatus(`Removed ${activeItem?.name.toLowerCase() || "selected item"}.`);
  }

  function clearOutfit() {
    setSelected({});
    setHeld({});
    playSound("click");
    setStatus("Removed all clothing; item adjustments are preserved.");
  }

  function updateFit(key: keyof Fit, value: number) {
    if (!activeId || positionsLocked) return;
    setFits((previous) => ({
      ...previous,
      [activeId]: { ...(previous[activeId] || initialFit), [key]: value },
    }));
  }

  function resetActiveFit() {
    if (!activeId) return;
    setFits((previous) => ({ ...previous, [activeId]: { ...initialFit } }));
    playSound("click");
    setStatus(`Reset ${activeItem?.name.toLowerCase()} to default position.`);
  }

  function layerStyle(id: string): CSSProperties {
    const fit = fits[id] || initialFit;
    return {
      transform: `translate(${fit.x / STAGE.width * 100}%, ${fit.y / STAGE.height * 100}%) rotate(${fit.angle}deg) scale(${fit.scaleX}, ${fit.scaleY})`,
    };
  }

  function showLook() {
    try { rememberLook({ selected, fits, held }); } catch { /* The session copy remains available. */ }
    playSound("showcase");
    router.push("/photoshoot");
  }

  return (
    <main className="game-shell" lang="en">
      <div className="game-canvas dressing-room" aria-label="Fashion Dress-Up Dressing Room">
        <div className="dressing-room-content">
        {/* Back button on top-left */}
        <Link className="back-button" href="/" aria-label="Back to home" onClick={() => playSound("back")}>
          <img src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/game/ui/back.svg`} alt="" draggable={false} />
        </Link>

        {/* Settings gear button on top-right */}
        <button
          type="button"
          className="settings-button"
          aria-label="Sound settings"
          title="Sound settings"
          onClick={() => {
            playSound("panelOpen");
            setAudioModalOpen(true);
          }}
          data-testid="settings-btn"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
          </svg>
        </button>

        {/* Character stage with ground shadow */}
        <div className="character-stage-wrap">
          <div className="character-spotlight" aria-hidden="true" />
          <div className="character-podium" aria-hidden="true" />
          <img className="character-shadow" src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/game/ui/shadow.svg`} alt="" draggable={false} />
          <div
            ref={stageRef}
            className={`studio-stage ${isDragOverStage ? "is-drag-over" : ""}`}
            data-testid="studio-stage"
            data-layer-count={layers.length}
          >
            {/* Nude base model */}
            <img
              src={assetUrl(selected.shoes === "shoes-brown-boots" ? "model-boots" : "model")}
              className="studio-layer"
              alt="2D paper doll model standing upright with arms relaxed"
              draggable={false}
              fetchPriority="high"
            />

            {/* Garment layers (shoes, bottoms, tops) */}
            {layers.map((item) => (
              <img
                key={item.id}
                src={assetUrl(item.id)}
                className={`studio-layer ${recentlyWorn === item.id ? "animate-snap" : ""} ${bootTuckBottomIds.has(item.id) && selected.shoes === "shoes-brown-boots" ? "is-shortened-for-boots" : ""}`}
                style={{ ...layerStyle(item.id), zIndex: garmentLayer(item) }}
                alt={item.name}
                data-garment={item.id}
                data-layer-order={garmentLayer(item)}
                draggable={false}
              />
            ))}

            <svg className="studio-layer studio-foreground-arms" viewBox={`0 0 ${STAGE.width} ${STAGE.height}`} style={{ zIndex: foregroundArmsOrder }} aria-hidden="true" data-testid="foreground-arms">
              <defs><clipPath id={armsClipId}><path d={foregroundArmsPath} /></clipPath></defs>
              <image href={assetUrl("model")} width={STAGE.width} height={STAGE.height} clipPath={`url(#${armsClipId})`} />
            </svg>

            {/* White magic bling-bling sparkles on dress-up */}
            <MagicBlingSparkles activeItem={recentlyWorn} category={recentlyWornCategory} />

            {/* Drop target prompt on hover/drag */}
            {isDragOverStage && (
              <div className="stage-drop-overlay">
                <span>Drop outfit here ✧</span>
              </div>
            )}
          </div>
        </div>
        <button className="showcase-button" disabled={!hydrated || !outfitComplete} onClick={showLook}>
          <span aria-hidden="true">✧</span> Show my look
        </button>

        {/* On phones, direct tabs replace the radial wheel so the model and
            wardrobe remain in separate, predictable regions. */}
        <nav className="mobile-category-tabs" aria-label="Wardrobe categories">
          {categories.map((item) => (
            <button
              type="button"
              className={category === item.id ? "is-active" : ""}
              key={item.id}
              role="tab"
              aria-selected={category === item.id}
              aria-controls="garment-panel"
              data-testid={`mobile-category-${item.id}`}
              onClick={() => activateCategory(item.id)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {item.id === "tops" && <path d="m8 5 4 2 4-2 4 3-2.4 3.2-1.6-1V20H8v-9.8l-1.6 1L4 8l4-3Z" />}
                {item.id === "bottoms" && <path d="M7 4h10l2 16h-5l-2-9-2 9H5L7 4Zm0 4h10" />}
                {item.id === "shoes" && <path d="M4 15c3 0 5-2 6-6l2 5c1 2 3 3 6 3h2v3H4v-5Z" />}
              </svg>
              <span>{item.id === "tops" ? "Tops" : item.id === "bottoms" ? "Bottoms" : "Shoes"}</span>
            </button>
          ))}
        </nav>

        {/* 3-Sector Radial Arc Selector matching image-6.png */}
        <nav
          className={`studio-radial-nav ${menuOpen ? "is-open" : ""}`}
          aria-label="Select garment category"
          onMouseEnter={() => { if (!menuOpen) playSound("panelOpen"); setMenuHovered(true); }}
          onMouseLeave={() => { if (!menuPinned) playSound("panelClose"); setMenuHovered(false); }}
        >
          <button
            type="button"
            className="category-launcher"
            aria-label={menuOpen ? "Close wardrobe categories" : "Open wardrobe categories"}
            aria-expanded={menuOpen}
            aria-controls="category-wheel"
            data-testid="category-launcher"
            onClick={() => { playSound(menuOpen ? "tap" : "panelOpen"); setMenuPinned((current) => !current); }}
          >
            <svg className="category-launcher-mark" viewBox="0 0 28 20" aria-hidden="true">
              <path d="M14 6.5c0-2.1 3-2.1 3-4.2C17 1 16 0 14.5 0 13.1 0 12 1 12 2.3" />
              <path d="m14 6.5-11 8.2c-1.1.8-.5 2.6.9 2.6h20.2c1.4 0 2-1.8.9-2.6L14 6.5Z" />
            </svg>
            <span className="category-launcher-label">Wardrobe</span>
          </button>
          <svg
            id="category-wheel"
            className="studio-radial-svg"
            width="160"
            height="320"
            viewBox="0 0 160 320"
            xmlns="http://www.w3.org/2000/svg"
            role="tablist"
            aria-label="Garment categories"
            aria-hidden={!menuOpen}
          >
            <defs>
              <linearGradient id="wheelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#72f1ba" />
                <stop offset="100%" stopColor="#3ddab4" />
              </linearGradient>
              <linearGradient id="activeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#a6ffe0" />
                <stop offset="100%" stopColor="#4aeec4" />
              </linearGradient>
            </defs>

            {/* Semicircle background base */}
            <path
              d="M 160 0 A 160 160 0 0 0 160 320 Z"
              fill="url(#wheelGrad)"
            />

            {/* Sector 1: Tops */}
            <g
              className={`wheel-sector ${category === "tops" ? "is-active" : ""}`}
              role="tab"
              id="tab-tops"
              aria-selected={category === "tops"}
              aria-controls="garment-panel"
              data-testid="category-tops"
              onClick={() => activateCategory("tops")}
              onMouseEnter={() => { if (category !== "tops") playSound("category"); setCategory("tops"); }}
              onKeyDown={(event) => handleSectorKeyDown(event, "tops")}
              tabIndex={menuOpen ? 0 : -1}
            >
              <path
                d="M 160 0 A 160 160 0 0 0 21.44 80 L 90.72 120 A 80 80 0 0 1 160 80 Z"
                fill={category === "tops" ? "url(#activeGrad)" : "url(#wheelGrad)"}
              />
              {/* Shirt icon */}
              <g transform="translate(85, 41)" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 4 9 3 9-3 6 5-4 5-3-2v11H6V12l-3 2-4-5 7-5Z" />
                <path d="M11 5c.5 2 1.5 3 4 3s3.5-1 4-3" />
              </g>
            </g>

            {/* Sector 2: Bottoms */}
            <g
              className={`wheel-sector ${category === "bottoms" ? "is-active" : ""}`}
              role="tab"
              id="tab-bottoms"
              aria-selected={category === "bottoms"}
              aria-controls="garment-panel"
              data-testid="category-bottoms"
              onClick={() => activateCategory("bottoms")}
              onMouseEnter={() => { if (category !== "bottoms") playSound("category"); setCategory("bottoms"); }}
              onKeyDown={(event) => handleSectorKeyDown(event, "bottoms")}
              tabIndex={menuOpen ? 0 : -1}
            >
              <path
                d="M 21.44 80 A 160 160 0 0 0 21.44 240 L 90.72 200 A 80 80 0 0 1 90.72 120 Z"
                fill={category === "bottoms" ? "url(#activeGrad)" : "url(#wheelGrad)"}
              />
              {/* Pants icon */}
              <g transform="translate(25, 145)" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 4h18l3 22h-9l-1-14-1 14H3L6 4Z" />
                <path d="M6 9h18" />
              </g>
            </g>

            {/* Sector 3: Shoes */}
            <g
              className={`wheel-sector ${category === "shoes" ? "is-active" : ""}`}
              role="tab"
              id="tab-shoes"
              aria-selected={category === "shoes"}
              aria-controls="garment-panel"
              data-testid="category-shoes"
              onClick={() => activateCategory("shoes")}
              onMouseEnter={() => { if (category !== "shoes") playSound("category"); setCategory("shoes"); }}
              onKeyDown={(event) => handleSectorKeyDown(event, "shoes")}
              tabIndex={menuOpen ? 0 : -1}
            >
              <path
                d="M 21.44 240 A 160 160 0 0 0 160 320 L 160 240 A 80 80 0 0 1 90.72 200 Z"
                fill={category === "shoes" ? "url(#activeGrad)" : "url(#wheelGrad)"}
              />
              {/* High-heel Shoe icon */}
              <g transform="translate(85, 248)" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M 3 19 C 8 19 13 15 16 10 L 18 5 C 19 10 21 16 26 18 L 26 20 L 18 20 L 17 13 L 15 19 Z" />
              </g>
            </g>

            {/* Clean dividing lines */}
            <line x1="21.44" y1="80" x2="90.72" y2="120" stroke="rgba(255,255,255,0.95)" strokeWidth="2.5" />
            <line x1="21.44" y1="240" x2="90.72" y2="200" stroke="rgba(255,255,255,0.95)" strokeWidth="2.5" />

            {/* Outer and inner curved arc borders (no diameter stroke) */}
            <path
              d="M 160 0 A 160 160 0 0 0 160 320"
              fill="none"
              stroke="rgba(255,255,255,0.95)"
              strokeWidth="2.5"
            />
            <path
              d="M 160 80 A 80 80 0 0 0 160 240"
              fill="none"
              stroke="rgba(255,255,255,0.95)"
              strokeWidth="2.5"
            />
          </svg>
        </nav>


        {/* Wardrobe card matching Figma image.png */}
        <aside className="wardrobe" aria-label="Wardrobe">
          {/* Header pill: Pick an outfit */}
          <div className="wardrobe-header">
            <h1 id="wardrobe-title">Pick an outfit</h1>
          </div>

          {/* Scrollable 2-column cards grid displaying generated/ product shots */}
          <div className="wardrobe-scroll" tabIndex={0} aria-label="Outfit list">
            <div className="outfit-grid" id="garment-panel" role="tabpanel" aria-labelledby={`tab-${category}`}>
              {visibleGarments.map((item) => (
                <button
                  type="button"
                  className={`outfit-card ${activeId === item.id ? "is-selected" : ""} ${isDragging === item.id ? "is-dragging" : ""}`}
                  key={item.id}
                  aria-pressed={activeId === item.id}
                  draggable={false}
                  onPointerDown={(e) => handlePointerDown(e, item.id)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={finishDrag}
                  onLostPointerCapture={finishDrag}
                  onDragStart={(e) => {
                    e.preventDefault();
                    playSound("pickup");
                  }}
                  onClick={() => { if (!suppressClick.current) choose(item.id); suppressClick.current = false; }}
                  aria-label={`Wear ${item.name}`}
                  data-testid={`garment-${item.id}`}
                >
                  <div className="outfit-card-thumb">
                    <img
                      src={previewAssetUrl(item.id)}
                      alt={item.name}
                      draggable={false}
                      className="outfit-card-img"
                    />
                    {activeId === item.id && <span className="outfit-card-check">✓</span>}
                  </div>
                  <span className="outfit-card-name">{item.name}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="sr-only" role="status" aria-live="polite">
            {status}
          </p>
        </aside>
        </div>
      </div>
      {dragPreview && (
        <div
          className="garment-drag-preview"
          aria-hidden="true"
          style={{
            width: dragPreview.width,
            height: dragPreview.height,
            transform: `translate3d(${dragPreview.left}px, ${dragPreview.top}px, 0)`,
          }}
        >
          <img src={previewAssetUrl(dragPreview.id)} style={{ padding: dragPreview.padding }} alt="" draggable={false} />
        </div>
      )}
      <AudioSettingsModal open={audioModalOpen} onClose={() => setAudioModalOpen(false)} />
      <PlayfulLoading active={loadingActive} onFinish={() => setLoadingActive(false)} />
    </main>
  );
}
