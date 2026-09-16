"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  initialFit,
  readLook,
  rememberLook,
  getSvgMaskUrl,
  resolveStudioFit,
  resolveStudioEraseDots,
  subscribeStudioUpdate,
  publishedVariableFits,
  publishedFaceCompositeFit,
  publishedSpecialDressFaceCompositeFit,
  publishedHideUnderlyingBody,
  publishedTuckableTopIds,
  publishedFaceCompositeMode,
  type Fit,
  type EraseMasks,
  type VariableFits,
  type StudioPublishedConfig,
  type FaceCompositeFit,
} from "@/lib/studio-look";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import {
  STAGE,
  assetUrl,
  modelAssetIds,
  garmentAssetId,
  categories,
  wheelCategories,
  garments,
  allGarments,
  layerOrder,
  faceFrameOrder,
  showcasePoseCoverOrder,
  showcasePoseCoverAssetId,
  bootTuckBottomIds,
  getGarmentLayerOrder,
  getUserFaceLayerOrder,
  previewAssetUrl,
  isGarmentSelected,
  isGarmentVisibleInStage,
  canTuckTop,
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
import { FaceCamModal } from "@/components/face-cam-modal";
import { publicAsset } from "@/lib/public-asset";
import { faceLayerStyle, facePoseFor } from "@/lib/face-composite";

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
  const [variableFits, setVariableFits] = useState<VariableFits>(publishedVariableFits);
  const [faceCompositeFit, setFaceCompositeFit] = useState<FaceCompositeFit | undefined>(publishedFaceCompositeFit);
  const [specialDressFaceCompositeFit, setSpecialDressFaceCompositeFit] = useState<FaceCompositeFit>(publishedSpecialDressFaceCompositeFit);
  const [eraseMasks, setEraseMasks] = useState<EraseMasks>({});
  const [positionsLocked, setPositionsLocked] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState("Select or drag and drop an item to start styling.");
  const [audioModalOpen, setAudioModalOpen] = useState(false);
  const [loadingActive, setLoadingActive] = useState(true);
  const [isShowcaseMode, setIsShowcaseMode] = useState(false);
  const [isFaceCompositeMode, setIsFaceCompositeMode] = useState(publishedFaceCompositeMode);
  const [isCapturing, setIsCapturing] = useState(false);
  const [userFace, setUserFace] = useState<string | undefined>();
  const [faceCamOpen, setFaceCamOpen] = useState(false);
  const [isDenimTucked, setIsDenimTucked] = useState(true);
  const [tuckableTopIds, setTuckableTopIds] = useState<string[]>(publishedTuckableTopIds);
  const [hideUnderlyingBody, setHideUnderlyingBody] = useState(publishedHideUnderlyingBody);
  const [toastNotice, setToastNotice] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  function showToastNotice(msg: string) {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastNotice(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastNotice(null);
      toastTimeoutRef.current = null;
    }, 4000);
  }

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
  const canShowLook = Boolean(
    selected.tops || selected.bottoms || selected.shoes ||
    (Array.isArray(selected.accessories) ? selected.accessories.length : selected.accessories),
  );
  const isSpecialDress = selected.tops === "dress-strapless-deep-fold-denim";
  const showcaseFaceActive = isShowcaseMode && isFaceCompositeMode && Boolean(userFace);
  // Add Face activates the face-layout branch. Regular tops use their
  // hands-on-hips swap pose; only the special denim dress returns to standing.
  const faceSwapLayoutActive = isShowcaseMode && isFaceCompositeMode;
  const showcasePoseCoverId = showcasePoseCoverAssetId(selected, isShowcaseMode, faceSwapLayoutActive);

  const menuOpen = menuPinned || menuHovered;

  useEffect(() => {
    function cancel(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        if (isShowcaseMode) {
          setIsShowcaseMode(false);
          setIsFaceCompositeMode(false);
          playSound("tap");
        }
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
    if (saved.variableFits) setVariableFits(saved.variableFits);
    if (saved.faceCompositeFit) setFaceCompositeFit(saved.faceCompositeFit);
    if (saved.specialDressFaceCompositeFit) setSpecialDressFaceCompositeFit(saved.specialDressFaceCompositeFit);
    setHeld(saved.held);
    if (saved.eraseMasks) setEraseMasks(saved.eraseMasks);
    if (saved.isDenimTucked !== undefined) setIsDenimTucked(saved.isDenimTucked);
    if (saved.tuckableTopIds) setTuckableTopIds(saved.tuckableTopIds);
    if (saved.hideUnderlyingBody !== undefined) setHideUnderlyingBody(saved.hideUnderlyingBody);
    if (saved.isFaceCompositeMode !== undefined) setIsFaceCompositeMode(saved.isFaceCompositeMode);
    setUserFace(saved.userFace);
    setHydrated(true);
    initAudio();
    router.prefetch("/photoshoot");

    // Fetch freshest published fits from server
    fetch(`/api/fits?t=${Date.now()}`)
      .then((res) => res.json())
      .then((data: StudioPublishedConfig) => {
        if (data && data.fits) {
          setFits((prev) => ({ ...data.fits, ...prev }));
          if (data.variableFits) setVariableFits(data.variableFits);
          if (data.faceCompositeFit) setFaceCompositeFit(data.faceCompositeFit);
          if (data.specialDressFaceCompositeFit) setSpecialDressFaceCompositeFit(data.specialDressFaceCompositeFit);
          if (data.eraseMasks) setEraseMasks(data.eraseMasks);
          if (typeof data.isDenimTucked === "boolean") setIsDenimTucked(data.isDenimTucked);
          if (Array.isArray(data.tuckableTopIds)) setTuckableTopIds(data.tuckableTopIds);
          if (typeof data.hideUnderlyingBody === "boolean") setHideUnderlyingBody(data.hideUnderlyingBody);
          if (typeof data.isFaceCompositeMode === "boolean") setIsFaceCompositeMode(data.isFaceCompositeMode);
        }
      })
      .catch(() => {});

    // Real-time live sync across open tabs and windows
    const unsubscribe = subscribeStudioUpdate((payload) => {
      if (payload.fits) setFits(payload.fits);
      if (payload.variableFits) setVariableFits(payload.variableFits);
      if (payload.faceCompositeFit) setFaceCompositeFit(payload.faceCompositeFit);
      if (payload.specialDressFaceCompositeFit) setSpecialDressFaceCompositeFit(payload.specialDressFaceCompositeFit);
      if (payload.eraseMasks) setEraseMasks(payload.eraseMasks);
      if (typeof payload.isDenimTucked === "boolean") setIsDenimTucked(payload.isDenimTucked);
      if (Array.isArray(payload.tuckableTopIds)) setTuckableTopIds(payload.tuckableTopIds);
      if (typeof payload.isShowcaseMode === "boolean") setIsShowcaseMode(payload.isShowcaseMode);
      if (typeof payload.isFaceCompositeMode === "boolean") setIsFaceCompositeMode(payload.isFaceCompositeMode);
      if (typeof payload.hideUnderlyingBody === "boolean") setHideUnderlyingBody(payload.hideUnderlyingBody);
      if (payload.selected) setSelected((prev) => ({ ...prev, ...payload.selected }));
    });

    return () => {
      unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      rememberLook({ selected, fits, variableFits, faceCompositeFit, specialDressFaceCompositeFit, eraseMasks, held, userFace, isDenimTucked, isShowcaseMode, isFaceCompositeMode, hideUnderlyingBody, tuckableTopIds });
    } catch {
      setStatus("Unable to save current outfit in browser storage.");
    }
  }, [eraseMasks, faceCompositeFit, specialDressFaceCompositeFit, fits, held, hydrated, isDenimTucked, isFaceCompositeMode, isShowcaseMode, selected, userFace, variableFits, hideUnderlyingBody, tuckableTopIds]);

  function garmentLayer(item: Garment) {
    return getGarmentLayerOrder(item, selected, isDenimTucked, tuckableTopIds, isShowcaseMode, faceSwapLayoutActive);
  }

  const layers = useMemo(
    () => allGarments
      .filter((item) => isGarmentSelected(item.id, selected) && isGarmentVisibleInStage(item, selected, isShowcaseMode, faceSwapLayoutActive))
      .sort((left, right) => garmentLayer(left) - garmentLayer(right)),
    [selected, isDenimTucked, tuckableTopIds, isShowcaseMode, faceSwapLayoutActive],
  );
  // In face-composite mode the dress uses model-neutral so the head position is the same as
  // other tops — use shared faceCompositeFit. specialDressFaceCompositeFit is for legacy use only.
  const facePose = facePoseFor(selected, (isSpecialDress && !showcaseFaceActive) ? specialDressFaceCompositeFit : faceCompositeFit);
  const userFaceLayerOrder = getUserFaceLayerOrder(selected, isDenimTucked, tuckableTopIds);
  const visibleGarments = useMemo(
    () => garments.filter((item) => item.category === category),
    [category],
  );
  const activeId = selected[category];
  const activeItem = activeId ? allGarments.find((item) => item.id === activeId) : undefined;
  const activeFit = activeId ? fits[activeId] || initialFit : initialFit;

  function choose(id: string, sound: SoundEffect = "dress", forceWear = false) {
    const item = allGarments.find((candidate) => candidate.id === id);
    if (!item) return;

    const isCurrentlySelected = isGarmentSelected(item.id, selected);

    if (!forceWear && isCurrentlySelected) {
      playSound("click");
      setSelected((previous) => {
        const next: Selection = { ...previous };
        if (item.category === "accessories") {
          const currentAcc = Array.isArray(next.accessories)
            ? next.accessories
            : next.accessories ? [next.accessories] : [];
          const updated = currentAcc.filter((accId) => accId !== id);
          if (updated.length === 0) {
            delete next.accessories;
          } else {
            next.accessories = updated;
          }
        } else {
          delete next[item.category];
        }
        return next;
      });
      setStatus(`Removed ${item.name.toLowerCase()}.`);
      return;
    }

    // Rule: Wearing the strapless denim dress blocks wearing bottoms ("mặc đầm chặn mặc quần")
    if (item.category === "bottoms" && selected.tops === "dress-strapless-deep-fold-denim") {
      playSound("cancel");
      setStatus("Bottoms cannot be worn with the denim dress. Unequip the dress first.");
      return;
    }

    const LONG_PANTS_IDS = [
      "bottom-sculpted-jeans",
      "bottom-three-tone-wide-leg-jeans",
      "bottom-inside-out-cuff-jeans",
    ];
    if (
      (id === "legwear-pocket-denim-warmers" && selected.bottoms && LONG_PANTS_IDS.includes(selected.bottoms)) ||
      (LONG_PANTS_IDS.includes(id) && isGarmentSelected("legwear-pocket-denim-warmers", selected))
    ) {
      showToastNotice("Note: Long pants cover the denim leg warmers underneath.");
    }

    const sequence = ++dressEffectSequence.current;
    playSound(sound);
    setSelected((previous) => {
      const next: Selection = { ...previous };
      if (item.category === "accessories") {
        const currentAcc = Array.isArray(next.accessories)
          ? [...next.accessories]
          : next.accessories ? [next.accessories] : [];
        if (!currentAcc.includes(id)) {
          currentAcc.push(id);
        }
        next.accessories = currentAcc;
      } else {
        next[item.category] = id;
        // Equipping the denim dress automatically removes any bottom
        if (id === "dress-strapless-deep-fold-denim") {
          delete next.bottoms;
        }
      }
      return next;
    });
    if (id === "dress-strapless-deep-fold-denim") {
      setHeld((previous) => ({ ...previous, bottoms: false }));
    }
    setDressEffect({ id, category: item.category, sequence });
    setTimeout(() => {
      setDressEffect((current) => (current?.sequence === sequence ? null : current));
    }, 1000);
    setStatus(
      id === "dress-strapless-deep-fold-denim" && selected.bottoms
        ? `Wearing ${item.name.toLowerCase()}. Bottoms removed.`
        : `Wearing ${item.name.toLowerCase()}.`
    );
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (event.button !== 0 || !event.isPrimary) return;
    const item = allGarments.find((candidate) => candidate.id === id);
    if (item?.category === "bottoms" && selected.tops === "dress-strapless-deep-fold-denim") {
      suppressClick.current = false;
      return;
    }
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
    if (drag?.active && isOverStage(event.clientX, event.clientY)) choose(drag.preview.id, "drop", true);
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
    if (next.tops === "dress-strapless-deep-fold-denim") {
      delete next.bottoms;
    }
    categories.forEach(({ id }) => {
      if (held[id] && selected[id]) {
        if (id === "bottoms" && next.tops === "dress-strapless-deep-fold-denim") {
          // dress clears held bottoms
        } else {
          next[id] = selected[id];
        }
      }
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
    if (next.tops === "dress-strapless-deep-fold-denim") {
      delete next.bottoms;
    } else {
      next.bottoms = chooseRandom("bottoms");
    }
    next.shoes = chooseRandom("shoes");
    const accOptions = garments.filter((item) => item.category === "accessories").map((i) => i.id);
    const chosenAcc = accOptions.filter(() => Math.random() > 0.5);
    if (chosenAcc.length > 0) {
      next.accessories = chosenAcc;
    }
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
    const fitContext = {
      isTucked: isDenimTucked,
      hasFace: faceSwapLayoutActive,
      isShowcase: isShowcaseMode,
      selection: selected,
    };
    const fit = resolveStudioFit(id, fits, fitContext, variableFits);

    const maskUrl = getSvgMaskUrl(resolveStudioEraseDots(id, eraseMasks, variableFits, fitContext));
    const maskStyle: CSSProperties = maskUrl
      ? {
          WebkitMaskImage: `url("${maskUrl}")`,
          maskImage: `url("${maskUrl}")`,
          WebkitMaskSize: "100% 100%",
          maskSize: "100% 100%",
        }
      : {};
    return {
      transform: `translate(${(fit.x / STAGE.width) * 100}%, ${(fit.y / STAGE.height) * 100}%) rotate(${fit.angle}deg) scale(${fit.scaleX}, ${fit.scaleY})`,
      ...maskStyle,
    };
  }

  function showLook() {
    setIsShowcaseMode(true);
    setIsFaceCompositeMode(false);
    playSound("showcase");
    setStatus("Showing your look with the original model face. Face Swap is a separate option.");
  }

  function handleSaveLook() {
    try {
      rememberLook({ selected, fits, variableFits, faceCompositeFit, specialDressFaceCompositeFit, eraseMasks, held, userFace, isDenimTucked, isShowcaseMode, isFaceCompositeMode, hideUnderlyingBody, tuckableTopIds });
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
    setIsFaceCompositeMode(false);
    setStatus("Continuing outfit styling.");
  }

  return (
    <main className="game-shell" lang="en">
      <div className="game-canvas dressing-room" aria-label="Fashion Dress-Up Dressing Room">   <div
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
            {/* Base model: pose artwork in plain showcase, standing model in face swap. */}
            {modelAssetIds(selected, isShowcaseMode, faceSwapLayoutActive).map((id, index) => {
              const maskContext = {
                isTucked: isDenimTucked,
                hasFace: faceSwapLayoutActive,
                isShowcase: isShowcaseMode,
                selection: selected,
              };
              const combinedDots = [
                ...resolveStudioEraseDots("model", eraseMasks, variableFits, maskContext),
                ...resolveStudioEraseDots(id, eraseMasks, variableFits, maskContext),
              ];
              const modelMaskUrl = getSvgMaskUrl(combinedDots, hideUnderlyingBody);
              const modelMaskStyle: CSSProperties = modelMaskUrl
                ? {
                    WebkitMaskImage: `url("${modelMaskUrl}")`,
                    maskImage: `url("${modelMaskUrl}")`,
                    WebkitMaskSize: "100% 100%",
                    maskSize: "100% 100%",
                  }
                : {};
              return (
                <img
                  key={id}
                  src={assetUrl(id)}
                  className="studio-layer"
                  style={{ zIndex: index, ...modelMaskStyle }}
                  alt={index === 0 ? (isShowcaseMode ? "Paper doll showing your look" : "2D paper doll model standing upright with arms relaxed") : ""}
                  aria-hidden={index === 0 ? undefined : "true"}
                  data-model-layer={id}
                  draggable={false}
                  fetchPriority="high"
                />
              );
            })}

            {selected.tops === "top-modal-grommet" && (
              <img
                src={assetUrl("top-modal-grommet-skin")}
                className="studio-layer"
                style={{ ...layerStyle("top-modal-grommet"), zIndex: 39 }}
                alt=""
                aria-hidden="true"
                data-testid="top-modal-skin-backing"
                draggable={false}
              />
            )}

            {/* Garment layers (shoes, bottoms, tops) */}
            {layers.map((item) => (
              <img
                key={item.id}
                src={assetUrl(garmentAssetId(item.id, selected, isShowcaseMode, faceSwapLayoutActive))}
                className={`studio-layer ${dressEffect?.id === item.id ? "animate-snap" : ""} ${bootTuckBottomIds.has(item.id) && selected.shoes === "shoes-brown-boots" ? "is-shortened-for-boots" : ""}`}
                style={{ ...layerStyle(item.id), zIndex: garmentLayer(item) }}
                alt={item.name}
                data-garment={item.id}
                data-layer-order={garmentLayer(item)}
                draggable={false}
              />
            ))}

            {/* Special pose cover: base pose -> denim legwear -> legless pose cover. */}
            {showcasePoseCoverId && (
              <img
                src={assetUrl(showcasePoseCoverId)}
                className="studio-layer"
                style={{ zIndex: showcasePoseCoverOrder }}
                alt=""
                aria-hidden="true"
                data-testid="foreground-jeans-overlay"
                data-layer-role="showcase-pose-cover"
                draggable={false}
              />
            )}

            {showcaseFaceActive && userFace && (
              <img
                src={userFace}
                className="studio-layer studio-user-face"
                style={faceLayerStyle(facePose, userFaceLayerOrder)}
                alt="Player face"
                data-testid="user-face-sprite"
                data-face-pose={facePose.id}
                draggable={false}
              />
            )}
            {showcaseFaceActive && userFace && (
              <img
                src={assetUrl("model-face-frame-overlay")}
                className="studio-layer studio-user-hair-hat-overlay"
                style={{ zIndex: faceFrameOrder }}
                alt=""
                aria-hidden="true"
                data-testid="user-hair-hat-overlay"
                draggable={false}
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
          {/* Quick toggle on stage when wearing denim top and bottoms */}
          {selected.tops && selected.bottoms && canTuckTop(selected.tops, tuckableTopIds) && !isShowcaseMode && (
            <button
              type="button"
              className={`stage-denim-tuck-btn ${isDenimTucked ? "is-tucked" : "is-untucked"}`}
              onClick={() => {
                setIsDenimTucked((prev) => !prev);
                playSound("click");
                setStatus(!isDenimTucked ? "Top tucked into bottoms." : "Top worn untucked.");
              }}
              title={isDenimTucked ? "Top is tucked in. Click to untuck" : "Top is untucked. Click to tuck in"}
              data-testid="stage-denim-tuck-btn"
            >
              <span className="tuck-icon">{isDenimTucked ? "👔" : "👕"}</span>
              <span className="tuck-label">{isDenimTucked ? "Tucked" : "Untucked"}</span>
            </button>
          )}
        </div>
        <button
          className={`showcase-button ${canShowLook ? "is-ready" : ""}`}
          disabled={!hydrated || !canShowLook}
          onClick={showLook}
          title={canShowLook ? "Open the photoshoot" : "Choose at least one item"}
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
          {wheelCategories.map((item) => (
            <button
              type="button"
              className={category === item.id ? "is-active" : ""}
              key={item.id}
              role="tab"
              aria-selected={category === item.id}
              aria-controls="garment-panel"
              data-testid={`mobile-category-${item.id}`}
              onClick={() => activateCategory(item.id)}
              aria-label={`${item.label} category`}
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
            {wheelCategories.map((item) => (
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
                aria-label={`${item.label} category`}
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
              {category === "bottoms" && selected.tops === "dress-strapless-deep-fold-denim" && (
                <div className="wardrobe-blocked-notice" role="status" data-testid="wardrobe-bottoms-blocked">
                  Bottoms are unavailable while wearing the Strapless Denim Dress. Unequip the dress to wear bottoms.
                </div>
              )}
              {visibleGarments.map((item) => {
                const isSelected = isGarmentSelected(item.id, selected);
                const isBottomBlocked = item.category === "bottoms" && selected.tops === "dress-strapless-deep-fold-denim";
                return (
                  <button
                    type="button"
                    className={`outfit-card ${isSelected ? "is-selected" : ""} ${isDragging === item.id ? "is-dragging" : ""} ${isBottomBlocked ? "is-blocked" : ""}`}
                    key={item.id}
                    aria-pressed={isSelected}
                    aria-disabled={isBottomBlocked}
                    title={isBottomBlocked ? "Bottoms cannot be worn with the denim dress. Unequip the dress first." : undefined}
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
                    aria-label={isBottomBlocked ? `${item.name} (unavailable while wearing dress)` : `Wear ${item.name}`}
                    data-testid={`garment-${item.id}`}
                  >
                    <div className="outfit-card-thumb">
                      <img
                        src={previewAssetUrl(item.id)}
                        alt={item.name}
                        draggable={false}
                        className="outfit-card-img"
                      />
                      {isSelected && <span className="outfit-card-check">✓</span>}
                      {item.id === "legwear-pocket-denim-warmers" && (
                        <span className="outfit-card-note">Covered by long pants</span>
                      )}
                    </div>
                    <span className="outfit-card-name">{item.name}</span>
                  </button>
                );
              })}
              {category === "accessories" && selected.tops && canTuckTop(selected.tops, tuckableTopIds) && (
                <button
                  type="button"
                  className={`outfit-card outfit-card-tuck ${isDenimTucked ? "is-selected" : ""}`}
                  key="denim-tuck-accessory"
                  aria-pressed={isDenimTucked}
                  draggable={false}
                  onClick={() => {
                    setIsDenimTucked((prev) => !prev);
                    playSound("click");
                    setStatus(!isDenimTucked ? "Top tucked into bottoms." : "Top worn untucked.");
                  }}
                  aria-label={isDenimTucked ? "Selected top is tucked in. Tap to untuck" : "Selected top is untucked. Tap to tuck in"}
                  data-testid="wardrobe-denim-tuck-btn"
                >
                  <div className="outfit-card-thumb">
                    <img
                      src={previewAssetUrl(selected.tops)}
                      alt="Tuck In"
                      draggable={false}
                      className="outfit-card-img"
                      style={{
                        transform: isDenimTucked ? "translateY(8px) scale(0.94)" : "scale(1)",
                        transition: "transform 0.25s ease",
                      }}
                    />
                    {isDenimTucked && <span className="outfit-card-check">✓</span>}
                    <span className={`outfit-card-tuck-badge ${isDenimTucked ? "is-tucked" : "is-untucked"}`}>
                      {isDenimTucked ? "Tucked" : "Untucked"}
                    </span>
                  </div>
                  <span className="outfit-card-name">Shirt Tuck</span>
                </button>
              )}
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
                  className="showcase-face-btn"
                  onClick={() => {
                    playSound("tap");
                    setIsFaceCompositeMode(true);
                    setFaceCamOpen(true);
                  }}
                  disabled={isCapturing}
                  data-testid="open-face-cam-btn"
                >
                  📷 {userFace ? "Retake Face" : "Add Face"}
            </button>
            {userFace && (
                  <button
                    type="button"
                    className="showcase-clear-face-btn"
                    onClick={() => {
                      setIsFaceCompositeMode((active) => !active);
                      playSound("tap");
                    }}
                    disabled={isCapturing}
                    data-testid="toggle-face-composite-btn"
                    aria-pressed={isFaceCompositeMode}
                    title={isFaceCompositeMode ? "Show your look without face swap" : "Show your look with face swap"}
                  >
                    {isFaceCompositeMode ? "◉ Original Face" : "🎭 Face Swap"}
                  </button>
            )}
            {userFace && (
                  <button
                    type="button"
                    className="showcase-clear-face-btn"
                    onClick={() => { setUserFace(undefined); setIsFaceCompositeMode(false); playSound("click"); }}
                    disabled={isCapturing}
                    data-testid="clear-face-btn"
                    title="Remove face composite and restore original model"
                  >
                    ✕ Remove Face
                  </button>
            )}
            <button
              type="button"
              className="showcase-save-btn"
              onClick={handleSaveLook}
              disabled={isCapturing}
              data-testid="showcase-save-btn"
              aria-label="Save look"
              title="Save look"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span className="sr-only">Save look</span>
            </button>
            <button
              type="button"
              className="showcase-edit-btn"
              onClick={handleExitShowcase}
              disabled={isCapturing}
              data-testid="showcase-edit-btn"
              aria-label="Edit outfit"
              title="Edit outfit"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <span className="sr-only">Edit outfit</span>
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
                  {modelAssetIds(selected, isShowcaseMode, faceSwapLayoutActive).map((id, index) => (
                    <img
                      key={id}
                      src={assetUrl(id)}
                      className="studio-layer"
                      style={{ zIndex: index }}
                      alt=""
                      draggable={false}
                    />
                  ))}
                  {selected.tops === "top-modal-grommet" && (
                    <img
                      src={assetUrl("top-modal-grommet-skin")}
                      className="studio-layer"
                      style={{ ...layerStyle("top-modal-grommet"), zIndex: 39 }}
                      alt=""
                      draggable={false}
                    />
                  )}
                  {layers.map((item) => (
                    <img
                      key={item.id}
                      src={assetUrl(garmentAssetId(item.id, selected, isShowcaseMode, faceSwapLayoutActive))}
                      className="studio-layer"
                      style={{ ...layerStyle(item.id), zIndex: garmentLayer(item) }}
                      alt=""
                      draggable={false}
                    />
                  ))}
                  {/* Foreground jeans overlay in photoshoot capture */}
                  {showcasePoseCoverId && (
                    <img
                      src={assetUrl(showcasePoseCoverId)}
                      className="studio-layer"
                      style={{ zIndex: showcasePoseCoverOrder }}
                      alt=""
                      draggable={false}
                    />
                  )}
                  {showcaseFaceActive && userFace && (
                    <img
                      src={userFace}
                      className="studio-layer studio-user-face"
                      style={faceLayerStyle(facePose, userFaceLayerOrder)}
                      alt="Player face"
                      data-face-pose={facePose.id}
                      draggable={false}
                    />
                  )}
                  {showcaseFaceActive && userFace && (
                    <img
                      src={assetUrl("model-face-frame-overlay")}
                      className="studio-layer studio-user-hair-hat-overlay"
                      style={{ zIndex: faceFrameOrder }}
                      alt=""
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
      {toastNotice && (
        <div
          className="studio-toast-banner"
          role="status"
          aria-live="polite"
          data-testid="studio-toast-banner"
        >
          <span className="studio-toast-icon" aria-hidden="true">ℹ️</span>
          <span className="studio-toast-text">{toastNotice}</span>
          <button
            type="button"
            className="studio-toast-close"
            onClick={() => setToastNotice(null)}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}
      <AudioSettingsModal open={audioModalOpen} onClose={() => setAudioModalOpen(false)} />
      <BubblePearlLoading
        active={loadingActive}
        minDurationMs={2600}
        title="LOADING YOUR WARDROBE…"
        onFinish={() => setLoadingActive(false)}
      />
      <FaceCamModal
        isOpen={faceCamOpen}
        pose={facePoseFor(selected, faceCompositeFit)}
        onClose={() => setFaceCamOpen(false)}
        onApplyFace={(faceUrl) => {
          setUserFace(faceUrl);
          setIsFaceCompositeMode(true);
          rememberLook({ selected, fits, variableFits, faceCompositeFit, specialDressFaceCompositeFit, eraseMasks, held, userFace: faceUrl, isDenimTucked, isShowcaseMode: true, isFaceCompositeMode: true, hideUnderlyingBody, tuckableTopIds });
        }}
      />
    </main>
  );
}
