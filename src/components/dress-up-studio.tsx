"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type KeyboardEvent } from "react";
import {
  STAGE,
  assetUrl,
  categories,
  garments,
  layerOrder,
  previewAssetUrl,
  type Category,
  type Garment,
  type Selection,
} from "@/lib/studio";

type Fit = { x: number; y: number; scaleX: number; scaleY: number; angle: number };
type SavedStudio = {
  selected: Selection;
  fits: Record<string, Fit>;
  held: Partial<Record<Category, boolean>>;
};

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

const initialFit: Fit = { x: 0, y: 0, scaleX: 1, scaleY: 1, angle: 0 };
const storageKey = "tung-tung-play-ge";

const fitFields = [
  { key: "x", label: "Ngang", min: -100, max: 100, step: 1, suffix: " px" },
  { key: "y", label: "Dọc", min: -100, max: 100, step: 1, suffix: " px" },
  { key: "scaleX", label: "Rộng", min: 0.7, max: 1.3, step: 0.005, suffix: "×" },
  { key: "scaleY", label: "Dài", min: 0.7, max: 1.3, step: 0.005, suffix: "×" },
  { key: "angle", label: "Xoay", min: -15, max: 15, step: 0.1, suffix: "°" },
] as const;

function isSafeFit(value: unknown): value is Fit {
  if (!value || typeof value !== "object") return false;
  const fit = value as Fit;
  return (
    [fit.x, fit.y, fit.scaleX, fit.scaleY, fit.angle].every(Number.isFinite) &&
    Math.abs(fit.x) <= 100 &&
    Math.abs(fit.y) <= 100 &&
    fit.scaleX >= 0.7 &&
    fit.scaleX <= 1.3 &&
    fit.scaleY >= 0.7 &&
    fit.scaleY <= 1.3 &&
    Math.abs(fit.angle) <= 15
  );
}

function PinIcon({ active }: { active: boolean }) {
  return <span aria-hidden="true">{active ? "●" : "○"}</span>;
}

export function DressUpStudio() {
  const [category, setCategory] = useState<Category>("tops");
  const [selected, setSelected] = useState<Selection>({});
  const [held, setHeld] = useState<Partial<Record<Category, boolean>>>({});
  const [fits, setFits] = useState<Record<string, Fit>>({});
  const [positionsLocked, setPositionsLocked] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState("Chọn hoặc kéo thả một món đồ để bắt đầu.");

  // Drag & drop state
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [isDragOverStage, setIsDragOverStage] = useState(false);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [recentlyWorn, setRecentlyWorn] = useState<string | null>(null);
  const [menuPinned, setMenuPinned] = useState(false);
  const [menuHovered, setMenuHovered] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const pointerDrag = useRef<{ preview: DragPreview; startX: number; startY: number; active: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [showcase, setShowcase] = useState(false);
  const outfitComplete = Boolean(selected.tops && selected.bottoms && selected.shoes);

  const menuOpen = menuPinned || menuHovered;

  useEffect(() => {
    function cancel(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        finishDrag();
        setMenuPinned(false);
        setMenuHovered(false);
        setShowcase(false);
      }
    }
    window.addEventListener("keydown", cancel);
    window.addEventListener("blur", finishDrag);
    return () => { window.removeEventListener("keydown", cancel); window.removeEventListener("blur", finishDrag); };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as SavedStudio;
        const validSelection: Selection = {};
        categories.forEach(({ id }) => {
          const selectedId = saved.selected?.[id];
          if (garments.some((item) => item.id === selectedId && item.category === id)) {
            validSelection[id] = selectedId;
          }
        });
        const validFits: Record<string, Fit> = {};
        garments.forEach((item) => {
          const fit = saved.fits?.[item.id];
          if (isSafeFit(fit)) validFits[item.id] = fit;
        });
        const validHeld: Partial<Record<Category, boolean>> = {};
        categories.forEach(({ id }) => {
          if (saved.held?.[id] && validSelection[id]) validHeld[id] = true;
        });
        setSelected(validSelection);
        setFits(validFits);
        setHeld(validHeld);
      }
    } catch {
      setStatus("Không đọc được bản phối đã lưu; bạn vẫn có thể tiếp tục chơi.");
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ selected, fits, held } satisfies SavedStudio));
    } catch {
      setStatus("Trình duyệt không thể lưu bản phối hiện tại.");
    }
  }, [fits, held, hydrated, selected]);

  function garmentLayer(item: Garment) {
    if (
      item.id === "shoes-brown-boots" &&
      selected.bottoms &&
      selected.bottoms === "bottom-blue-jeans"
    ) {
      return 35;
    }
    return layerOrder[item.category];
  }

  const layers = useMemo(
    () => garments
      .filter((item) => selected[item.category] === item.id)
      .sort((left, right) => garmentLayer(left) - garmentLayer(right)),
    [selected],
  );
  const visibleGarments = useMemo(
    () => garments.filter((item) => item.category === category),
    [category],
  );
  const activeId = selected[category];
  const activeItem = activeId ? garments.find((item) => item.id === activeId) : undefined;
  const activeFit = activeId ? fits[activeId] || initialFit : initialFit;

  function choose(id: string) {
    const item = garments.find((candidate) => candidate.id === id);
    if (!item) return;
    setShowcase(false);
    setSelected((previous) => ({ ...previous, [item.category]: id }));
    setRecentlyWorn(id);
    setTimeout(() => setRecentlyWorn((current) => (current === id ? null : current)), 600);
    setStatus(`Đã mặc ${item.name.toLocaleLowerCase("vi")}.`);
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
    if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) return;
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
    if (drag?.active && isOverStage(event.clientX, event.clientY)) choose(drag.preview.id);
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
    setStatus(`Đã phối ${label}. Các món được giữ vẫn ở nguyên vị trí.`);
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
    applyLook(next, "một bộ ngẫu nhiên");
  }

  function removeActive() {
    if (!activeId) return;
    setSelected((previous) => {
      const next = { ...previous };
      delete next[category];
      return next;
    });
    setHeld((previous) => ({ ...previous, [category]: false }));
    setStatus(`Đã bỏ ${activeItem?.name.toLocaleLowerCase("vi") || "món đang chọn"}.`);
  }

  function clearOutfit() {
    setSelected({});
    setHeld({});
    setStatus("Đã bỏ toàn bộ trang phục; căn chỉnh riêng của từng món vẫn được lưu.");
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
    setStatus(`Đã đưa ${activeItem?.name.toLocaleLowerCase("vi")} về điểm neo chuẩn.`);
  }

  function layerStyle(id: string): CSSProperties {
    const fit = fits[id] || initialFit;
    return {
      transform: `translate(${fit.x / STAGE.width * 100}%, ${fit.y / STAGE.height * 100}%) rotate(${fit.angle}deg) scale(${fit.scaleX}, ${fit.scaleY})`,
    };
  }

  async function exportPng() {
    setExporting(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = STAGE.width;
      canvas.height = STAGE.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable.");

      const exportLayers = [
        { id: selected.shoes === "shoes-brown-boots" ? "model-boots" : "model", fit: initialFit, clipBottomAt: undefined },
        ...layers.map((item) => ({
          id: item.id,
          fit: fits[item.id] || initialFit,
          clipBottomAt:
            item.category === "bottoms" &&
            item.id === "bottom-blue-jeans" &&
            selected.shoes === "shoes-brown-boots"
              ? 0.648
              : undefined,
        })),
      ];
      for (const layer of exportLayers) {
        const picture = new Image();
        picture.src = assetUrl(layer.id);
        await picture.decode();
        context.save();
        context.translate(STAGE.width / 2 + layer.fit.x, STAGE.height / 2 + layer.fit.y);
        context.rotate(layer.fit.angle * Math.PI / 180);
        context.scale(layer.fit.scaleX, layer.fit.scaleY);
        if (layer.clipBottomAt) {
          const clippedHeight = STAGE.height * layer.clipBottomAt;
          context.drawImage(
            picture,
            0,
            0,
            STAGE.width,
            clippedHeight,
            -STAGE.width / 2,
            -STAGE.height / 2,
            STAGE.width,
            clippedHeight,
          );
        } else {
          context.drawImage(picture, -STAGE.width / 2, -STAGE.height / 2, STAGE.width, STAGE.height);
        }
        context.restore();
      }

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("PNG export failed."))), "image/png");
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "tung-tung-outfit.png";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus("Đã xuất bộ phối PNG 1024×1536 với nền trong suốt.");
    } catch {
      setStatus("Không thể xuất ảnh. Hãy đợi các lớp tải xong rồi thử lại.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="game-shell" lang="vi">
      <div className="game-canvas dressing-room" aria-label="Phòng thử đồ Tưng Tửng">
        <div className="dressing-room-content">
        {/* Back button on top-left */}
        <Link className="back-button" href="/" aria-label="Về trang chủ">
          <img src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/game/ui/back.svg`} alt="" draggable={false} />
        </Link>

        {/* Character stage with ground shadow */}
        <div className="character-stage-wrap">
          <div className="character-spotlight" aria-hidden="true" />
          <div className="character-podium" aria-hidden="true" />
          <img className="character-shadow" src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/game/ui/shadow.svg`} alt="" draggable={false} />
          <div
            ref={stageRef}
            className={`studio-stage ${isDragOverStage ? "is-drag-over" : ""} ${showcase ? "is-showcasing" : ""}`}
            data-testid="studio-stage"
            data-layer-count={layers.length}
            onAnimationEnd={(event) => { if (event.target === event.currentTarget) setShowcase(false); }}
          >
            {/* Nude base model */}
            <img
              src={assetUrl(selected.shoes === "shoes-brown-boots" ? "model-boots" : "model")}
              className="studio-layer"
              alt="Nhân vật 2D cố định đứng thẳng, hai tay xuôi tự nhiên"
              draggable={false}
              fetchPriority="high"
            />

            {/* Garment layers (shoes, bottoms, tops) */}
            {layers.map((item) => (
              <img
                key={item.id}
                src={assetUrl(item.id)}
                className={`studio-layer ${recentlyWorn === item.id ? "animate-snap" : ""} ${item.id === "bottom-blue-jeans" && selected.shoes === "shoes-brown-boots" ? "is-shortened-for-boots" : ""}`}
                style={{ ...layerStyle(item.id), zIndex: garmentLayer(item) }}
                alt={item.name}
                data-garment={item.id}
                data-layer-order={garmentLayer(item)}
                draggable={false}
              />
            ))}

            {/* Drop target prompt on hover/drag */}
            {isDragOverStage && (
              <div className="stage-drop-overlay">
                <span>Thả trang phục vào đây ✧</span>
              </div>
            )}
          </div>
        </div>
        <button className="showcase-button" disabled={!outfitComplete || showcase} onClick={() => { setShowcase(true); setStatus("Bộ đồ đã hoàn thiện — cùng tỏa sáng!"); }}>
          <span aria-hidden="true">✧</span> {showcase ? "Looking good!" : "Show my look"}
        </button>

        {/* 3-Sector Radial Arc Selector matching image-6.png */}
        <nav
          className={`studio-radial-nav ${menuOpen ? "is-open" : ""}`}
          aria-label="Chọn loại trang phục"
          onMouseEnter={() => setMenuHovered(true)}
          onMouseLeave={() => setMenuHovered(false)}
        >
          <button
            type="button"
            className="category-launcher"
            aria-label={menuOpen ? "Close wardrobe categories" : "Open wardrobe categories"}
            aria-expanded={menuOpen}
            aria-controls="category-wheel"
            data-testid="category-launcher"
            onClick={() => setMenuPinned((current) => !current)}
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
            aria-label="Loại trang phục"
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
              onMouseEnter={() => setCategory("tops")}
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
              onMouseEnter={() => setCategory("bottoms")}
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
              onMouseEnter={() => setCategory("shoes")}
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
                  onClick={() => { if (!suppressClick.current) choose(item.id); suppressClick.current = false; }}
                  aria-label={`Mặc ${item.name}`}
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
    </main>
  );
}
