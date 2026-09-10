"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { initialFit, readLook, rememberLook, type Fit } from "@/lib/studio-look";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import {
  STAGE,
  assetUrl,
  modelAssetId,
  garmentAssetId,
  hasShowcasePose,
  categories,
  garments,
  allGarments,
  layerOrder,
  foregroundArmsOrder,
  bootTuckBottomIds,
  getGarmentLayerOrder,
  previewAssetUrl,
  type Category,
  type Garment,
  type Selection,
} from "@/lib/studio";
import { playSound, type SoundEffect } from "@/lib/sound-effects";
import { initAudio } from "@/lib/audio-manager";
import { AudioSettingsModal } from "@/components/audio-settings-modal";
import { BubblePearlLoading } from "@/components/bubble-pearl-loading";
import { ColorBubbleBurst } from "@/components/magic-bling";
import { Fireworks } from "@/components/fireworks";
import { publicAsset } from "@/lib/public-asset";

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

type DressEffect = {
  id: string;
  category: Category;
  sequence: number;
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
  const [category, setCategory] = useState<Category>("tops");
  const [selected, setSelected] = useState<Selection>({});
  const [held, setHeld] = useState<Partial<Record<Category, boolean>>>({});
  const [fits, setFits] = useState<Record<string, Fit>>({});
  const [positionsLocked, setPositionsLocked] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState("Select or drag and drop an item to start styling.");
  const [audioModalOpen, setAudioModalOpen] = useState(false);
  const [loadingActive, setLoadingActive] = useState(true);
  const [isShowcaseMode, setIsShowcaseMode] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  // Drag & drop state
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [isDragOverStage, setIsDragOverStage] = useState(false);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [dressEffect, setDressEffect] = useState<DressEffect | null>(null);
  const dressEffectSequence = useRef(0);
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
        if (isShowcaseMode) {
          setIsShowcaseMode(false);
        }
        finishDrag();
        setMenuPinned(false);
        setMenuHovered(false);
      }
    }
    window.addEventListener("keydown", cancel);
    window.addEventListener("blur", finishDrag);
    return () => { window.removeEventListener("keydown", cancel); window.removeEventListener("blur", finishDrag); };
  }, [isShowcaseMode]);

  useEffect(() => {
    const saved = readLook();
    setSelected(saved.selected);
    setFits(saved.fits);
    setHeld(saved.held);
    setHydrated(true);
    initAudio();
    router.prefetch("/photoshoot");
  }, [router]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      rememberLook({ selected, fits, held });
    } catch {
      setStatus("Unable to save current outfit in browser storage.");
    }
  }, [fits, held, hydrated, selected]);

  function garmentLayer(item: Garment) {
    return getGarmentLayerOrder(item, selected);
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
    const sequence = ++dressEffectSequence.current;
    playSound(sound);
    setSelected((previous) => ({ ...previous, [item.category]: id }));
    setDressEffect({ id, category: item.category, sequence });
    setTimeout(() => {
      setDressEffect((current) => (current?.sequence === sequence ? null : current));
    }, 1000);
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

  function handleMenuMouseEnter() {
    setMenuHovered(true);
  }

  function handleMenuMouseLeave() {
    setMenuHovered(false);
  }

  function toggleMenu() {
    setMenuPinned((previous) => !previous);
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
    // The pose includes the head and arms, so it stays anchored to the body.
    const fit = hasShowcasePose(selected, isShowcaseMode) && id === selected.tops ? initialFit : fits[id] || initialFit;
    return {
      transform: `translate(${fit.x / STAGE.width * 100}%, ${fit.y / STAGE.height * 100}%) rotate(${fit.angle}deg) scale(${fit.scaleX}, ${fit.scaleY})`,
    };
  }

  function showLook() {
    setIsShowcaseMode(true);
    playSound("showcase");
    setStatus("Showing your look! Click Save to capture your photoshoot polaroid.");
  }

  function handleSaveLook() {
    try {
      rememberLook({ selected, fits, held });
    } catch {
      /* The session copy remains available. */
    }
    playSound("shutter");
    setIsCapturing(true);
    setTimeout(() => {
      router.push("/photoshoot");
    }, 850);
  }

  function handleExitShowcase() {
    playSound("tap");
    setIsShowcaseMode(false);
    setStatus("Continuing outfit styling.");
  }

  return (
    <main className="game-shell" lang="en">
      <div className="game-canvas dressing-room" aria-label="Fashion Dress-Up Dressing Room">
        <div
          className={`dressing-room-content ${isShowcaseMode ? "is-showcase-mode" : ""}`}
          style={{
            "--studio-background-image": `url('${publicAsset("/game/backgrounds/slide-playground.webp")}')`,
            "--wardrobe-background-image": `url('${publicAsset("/game/ui/wardrobe-cabinet-glossy.webp")}')`,
          } as CSSProperties}
        >
        <div className="desktop-6-atmosphere" aria-hidden="true">
          <span className="ambient-bubble ambient-bubble-a" />
          <span className="ambient-bubble ambient-bubble-b" />
          <span className="ambient-bubble ambient-bubble-c" />
          <span className="ambient-bubble ambient-bubble-d" />
          <p>Mix · match · magic</p>
        </div>
        {/* Photoshoot background layer in showcase mode matching Image 1 */}
        <img
          className="showcase-bg-layer"
          src={publicAsset("/game/photoshoot/background.png")}
          alt=""
          draggable={false}
          aria-hidden="true"
        />

        {/* Anime sparkles, dream bokeh, and fireworks celebration */}
        <Fireworks active={isShowcaseMode} />

        {/* Back button on top-left: exits showcase mode if active, else navigates home */}
        {isShowcaseMode ? (
          <button
            type="button"
            className="back-button"
            aria-label="Back to wardrobe"
            title="Back to wardrobe"
            onClick={handleExitShowcase}
            data-testid="showcase-back-btn"
          >
            <img src={publicAsset("/game/ui/back-button-glossy.png")} alt="" draggable={false} />
          </button>
        ) : (
          <Link className="back-button" href="/" aria-label="Back to home" onClick={() => playSound("back")}>
            <img src={publicAsset("/game/ui/back-button-glossy.png")} alt="" draggable={false} />
          </Link>
        )}

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
          <img className="character-shadow" src={publicAsset("/game/ui/shadow.svg")} alt="" draggable={false} />
          <div
            ref={stageRef}
            className={`studio-stage ${isDragOverStage ? "is-drag-over" : ""}`}
            data-testid="studio-stage"
            data-layer-count={layers.length}
          >
            {/* Nude base model */}
            <img
              src={assetUrl(modelAssetId(selected, isShowcaseMode))}
              className="studio-layer"
              alt={hasShowcasePose(selected, isShowcaseMode) ? "Paper doll showing your look" : "2D paper doll model standing upright with arms relaxed"}
              draggable={false}
              fetchPriority="high"
            />

            {/* Garment layers (shoes, bottoms, tops) */}
            {layers.map((item) => (
              <img
                key={item.id}
                src={assetUrl(garmentAssetId(item.id, selected, isShowcaseMode))}
                className={`studio-layer ${dressEffect?.id === item.id ? "animate-snap" : ""} ${bootTuckBottomIds.has(item.id) && selected.shoes === "shoes-brown-boots" ? "is-shortened-for-boots" : ""}`}
                style={{ ...layerStyle(item.id), zIndex: garmentLayer(item) }}
                alt={item.name}
                data-garment={item.id}
                data-layer-order={garmentLayer(item)}
                draggable={false}
              />
            ))}

            {!hasShowcasePose(selected, isShowcaseMode) && (
              <img
                src={assetUrl("model-arms")}
                className="studio-layer studio-foreground-arms"
                style={{ zIndex: foregroundArmsOrder }}
                alt=""
                aria-hidden="true"
                draggable={false}
                data-testid="foreground-arms"
              />
            )}

            {/* One-shot colorful bubble burst on dress-up */}
            <ColorBubbleBurst
              key={dressEffect?.sequence || 0}
              activeItem={dressEffect?.id || null}
              category={dressEffect?.category}
            />

            {/* Drop target prompt on hover/drag */}
            {isDragOverStage && (
              <div className="stage-drop-overlay">
                <span>Drop outfit here ✧</span>
              </div>
            )}
          </div>
        </div>
        <button
          className={`showcase-button ${outfitComplete ? "is-ready" : ""}`}
          disabled={!hydrated || !outfitComplete}
          onClick={showLook}
          title={outfitComplete ? "Open the photoshoot" : "Choose a top, bottom and shoes first"}
        >
          <span aria-hidden="true">✧</span> SHOW YOUR LOOK
        </button>

        <nav className="mobile-category-tabs" aria-label="Wardrobe categories">
          <img
            className="mobile-category-tabs-bg"
            src={publicAsset("/game/ui/category-tabs-pink.webp")}
            alt=""
            draggable={false}
            aria-hidden="true"
          />
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
              aria-label={`${item.id === "tops" ? "Tops" : item.id === "bottoms" ? "Bottoms" : "Shoes"} category`}
            />
          ))}
        </nav>

        {/* Wardrobe cabinet matching Figma Desktop - 6 */}
        <aside className="wardrobe" aria-label="Wardrobe">
          {/* Category Wheel attached to the left edge of wardrobe cabinet */}
          <nav
            className={`wardrobe-wheel ${menuOpen ? "is-open" : ""}`}
            role="tablist"
            aria-label="Garment categories"
            onMouseEnter={handleMenuMouseEnter}
            onMouseLeave={handleMenuMouseLeave}
          >
            {/* 3D pearl-pink wheel background exported from Figma 72:223 */}
            <img
              src={publicAsset("/game/ui/category-wheel-pink.webp")}
              alt=""
              className="wardrobe-wheel-bg"
              draggable={false}
              aria-hidden="true"
            />

            {/* Hidden category launcher for aria and test compatibility */}
            <button
              type="button"
              className="category-launcher"
              aria-expanded={true}
              aria-controls="garment-panel"
              data-testid="category-launcher"
              aria-label="Wardrobe categories"
              tabIndex={-1}
            />

            {/* Interactive category buttons positioned over the 3 sectors — click only */}
            {categories.map((item) => (
              <button
                type="button"
                className={`wheel-sector-btn sector-${item.id} ${category === item.id ? "is-active" : ""}`}
                id={`tab-${item.id}`}
                key={item.id}
                role="tab"
                aria-selected={category === item.id}
                aria-controls="garment-panel"
                data-testid={`category-${item.id}`}
                onClick={() => activateCategory(item.id)}
                aria-label={`${item.id === "tops" ? "Tops" : item.id === "bottoms" ? "Bottoms" : "Shoes"} category`}
              >
                <span className="wheel-active-indicator" aria-hidden="true" />
              </button>
            ))}
          </nav>

          {/* Header pill: PICK AN OUTFIT matching Figma Desktop - 6 Frame 18 */}
          <div className="wardrobe-header">
            <h1 id="wardrobe-title">PICK AN OUTFIT</h1>
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

        {/* Showcase Action Bar (Save Look & Edit Look) */}
        {isShowcaseMode && (
          <div className="showcase-action-bar" role="toolbar" aria-label="Showcase actions">
            <button
              type="button"
              className="showcase-save-btn"
              onClick={handleSaveLook}
              disabled={isCapturing}
              data-testid="showcase-save-btn"
            >
              <span aria-hidden="true">📸</span>
              <span>SAVE LOOK</span>
              <span aria-hidden="true">✧</span>
            </button>
            <button
              type="button"
              className="showcase-edit-btn"
              onClick={handleExitShowcase}
              disabled={isCapturing}
              data-testid="showcase-edit-btn"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <span>EDIT OUTFIT</span>
            </button>
          </div>
        )}

        {/* Capture Snapshot Pullout Animation Overlay */}
        {isCapturing && (
          <div className="capture-overlay" aria-label="Capturing photo" role="status">
            <div className="capture-flash" aria-hidden="true" />
            <div className="capture-polaroid-card">
              <div className="capture-polaroid-photo">
                <img
                  className="capture-polaroid-bg"
                  src={publicAsset("/game/photoshoot/background.png")}
                  alt=""
                  draggable={false}
                  aria-hidden="true"
                />
                <div className="studio-stage" style={{ transform: "scale(0.92)", position: "relative", zIndex: 2 }}>
                  <img
                    src={assetUrl(modelAssetId(selected, isShowcaseMode))}
                    className="studio-layer"
                    alt=""
                    draggable={false}
                  />
                  {layers.map((item) => (
                    <img
                      key={item.id}
                      src={assetUrl(garmentAssetId(item.id, selected, isShowcaseMode))}
                      className="studio-layer"
                      style={{ ...layerStyle(item.id), zIndex: garmentLayer(item) }}
                      alt=""
                      draggable={false}
                    />
                  ))}
                  {!hasShowcasePose(selected, isShowcaseMode) && (
                    <img
                      src={assetUrl("model-arms")}
                      className="studio-layer studio-foreground-arms"
                      style={{ zIndex: foregroundArmsOrder }}
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                    />
                  )}
                </div>
              </div>
              <div className="capture-polaroid-caption">
                <span aria-hidden="true">✨</span>
                <span>FASHION LOOKBOOK</span>
                <span aria-hidden="true">✨</span>
              </div>
            </div>
          </div>
        )}
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
      <BubblePearlLoading
        active={loadingActive}
        minDurationMs={2600}
        title="LOADING YOUR WARDROBE…"
        onFinish={() => setLoadingActive(false)}
      />
    </main>
  );
}
