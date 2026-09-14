import {
  STAGE,
  STUDIO_ASSET_VERSION,
  assetUrl,
  modelAssetIds,
  garmentAssetId,
  bootTuckBottomIds,
  categories,
  allGarments,
  getGarmentLayerOrder,
  getUserFaceLayerOrder,
  faceFrameOrder,
  showcasePoseCoverOrder,
  showcasePoseCoverAssetId,
  DEFAULT_TUCKABLE_TOP_IDS,
  type Category,
  type Selection,
  isGarmentSelected,
  isGarmentVisibleInStage,
} from "./studio";
import { FACE_CAPTURE_VERSION, drawUserFace, facePoseFor, type FacePose } from "./face-composite";
import publishedFitConfig from "./studio-published-fits.json";

export type Fit = { x: number; y: number; scaleX: number; scaleY: number; angle: number };
export type EraseDot = { x: number; y: number; radius: number };
export type EraseMasks = Record<string, EraseDot[]>;
export type FitGroup = Record<string, Fit>;
export type PairState = "neutral" | "showcase_pose" | "face_composite";
export type PairEraseMasks = Partial<Record<PairState, EraseMasks>>;
export type PairFits = {
  neutral?: FitGroup;
  showcase_pose?: FitGroup;
  face_composite?: FitGroup;
  eraseMasks?: PairEraseMasks;
};

export type VariableFits = {
  denim_tucked?: FitGroup;
  denim_untucked?: FitGroup;
  jeans_other_tops?: FitGroup;
  modal_default?: FitGroup;
  face_composite?: FitGroup;
  showcase_pose?: FitGroup;
  pairs?: Record<string, PairFits>;
};

export type FaceCompositeFit = {
  stage: { centerX: number; centerY: number; width: number; height: number; angle: number };
  guide: { centerX: number; centerY: number; width: number; height: number; angle: number };
};

export type StudioPublishedConfig = {
  version: string;
  updatedAt?: string;
  fits: Record<string, Fit>;
  variableFits?: VariableFits;
  faceCompositeFit?: FaceCompositeFit;
  specialDressFaceCompositeFit?: FaceCompositeFit;
  eraseMasks?: EraseMasks;
  isDenimTucked?: boolean;
  isShowcaseMode?: boolean;
  isFaceCompositeMode?: boolean;
  hideUnderlyingBody?: boolean;
  tuckableTopIds?: string[];
  adminSelection?: Selection;
};

export type FitContext = {
  isTucked?: boolean;
  hasFace?: boolean;
  isShowcase?: boolean;
  selection?: Selection;
};

export type SavedStudio = {
  assetVersion?: string;
  selected: Selection;
  fits: Record<string, Fit>;
  variableFits?: VariableFits;
  faceCompositeFit?: FaceCompositeFit;
  specialDressFaceCompositeFit?: FaceCompositeFit;
  eraseMasks?: EraseMasks;
  held: Partial<Record<Category, boolean>>;
  userFace?: string;
  userFaceVersion?: string;
  isDenimTucked?: boolean;
  isShowcaseMode?: boolean;
  isFaceCompositeMode?: boolean;
  hideUnderlyingBody?: boolean;
  tuckableTopIds?: string[];
};

export const initialFit: Fit = { x: 0, y: 0, scaleX: 1, scaleY: 1, angle: 0 };
// Small, reviewed release-level corrections. Browser/admin overrides are layered
// on top of these values and remain tied to STUDIO_ASSET_VERSION.
export const publishedFits: Record<string, Fit> = publishedFitConfig.fits;
export const publishedVariableFits: VariableFits = (publishedFitConfig as { variableFits?: VariableFits }).variableFits || {};
export const publishedFaceCompositeFit: FaceCompositeFit | undefined = (publishedFitConfig as { faceCompositeFit?: FaceCompositeFit }).faceCompositeFit;
export const defaultSpecialDressFaceCompositeFit: FaceCompositeFit = {
  stage: { centerX: 492, centerY: 183, width: 112, height: 142, angle: 3 },
  guide: { centerX: 190, centerY: 150, width: 126, height: 160, angle: 0 },
};
export const publishedSpecialDressFaceCompositeFit: FaceCompositeFit =
  (publishedFitConfig as { specialDressFaceCompositeFit?: FaceCompositeFit }).specialDressFaceCompositeFit
  || defaultSpecialDressFaceCompositeFit;
export const publishedEraseMasks: EraseMasks = (publishedFitConfig as { eraseMasks?: EraseMasks }).eraseMasks || {};
export const publishedDenimTucked = (publishedFitConfig as { isDenimTucked?: boolean }).isDenimTucked ?? true;
export const publishedFaceCompositeMode = Boolean(
  (publishedFitConfig as { isFaceCompositeMode?: boolean }).isFaceCompositeMode,
);
export const publishedHideUnderlyingBody = Boolean((publishedFitConfig as { hideUnderlyingBody?: boolean }).hideUnderlyingBody);
export const publishedTuckableTopIds = (publishedFitConfig as { tuckableTopIds?: string[] }).tuckableTopIds || [...DEFAULT_TUCKABLE_TOP_IDS];

export const storageKey = "tung-tung-play-ge";
export const ERASE_DOTS_STORAGE_KEY = "tung-tung-admin-erase-dots";
export const STUDIO_SYNC_CHANNEL = "tung_tung_studio_sync";

let currentLook: SavedStudio | undefined;

export function stageToGarment(stageX: number, stageY: number, fit: Fit): { x: number; y: number } {
  const dx2 = stageX - STAGE.width / 2 - fit.x;
  const dy2 = stageY - STAGE.height / 2 - fit.y;
  const rad = (fit.angle * Math.PI) / 180;
  const dx1 = dx2 * Math.cos(rad) + dy2 * Math.sin(rad);
  const dy1 = -dx2 * Math.sin(rad) + dy2 * Math.cos(rad);
  const dx = dx1 / (fit.scaleX || 1);
  const dy = dy1 / (fit.scaleY || 1);
  return {
    x: Math.round(dx + STAGE.width / 2),
    y: Math.round(dy + STAGE.height / 2),
  };
}

export function garmentToStage(garmentX: number, garmentY: number, fit: Fit): { x: number; y: number } {
  const dx = garmentX - STAGE.width / 2;
  const dy = garmentY - STAGE.height / 2;
  const dx1 = dx * (fit.scaleX || 1);
  const dy1 = dy * (fit.scaleY || 1);
  const rad = (fit.angle * Math.PI) / 180;
  const dx2 = dx1 * Math.cos(rad) - dy1 * Math.sin(rad);
  const dy2 = dx1 * Math.sin(rad) + dy1 * Math.cos(rad);
  return {
    x: STAGE.width / 2 + fit.x + dx2,
    y: STAGE.height / 2 + fit.y + dy2,
  };
}

export function getSvgMaskUrl(dots?: EraseDot[], hideUnderlyingBody = false): string | undefined {
  const hasDots = Boolean(dots && dots.length > 0);
  if (!hasDots && !hideUnderlyingBody) return undefined;
  const circles = hasDots
    ? (dots ?? []).map((dot) => `<circle cx="${dot.x}" cy="${dot.y}" r="${dot.radius}" fill="black" />`).join("")
    : "";
  const bodyMask = hideUnderlyingBody
    ? `<rect x="412" y="348" width="218" height="290" rx="16" fill="black" /><rect x="370" y="638" width="284" height="182" rx="16" fill="black" />`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 1024 1536"><defs><mask id="m"><rect width="1024" height="1536" fill="white" />${bodyMask}${circles}</mask></defs><rect width="1024" height="1536" fill="black" mask="url(#m)" /></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function publishedFitFor(id: string): Fit {
  return publishedFits[id] || initialFit;
}

export function selectionPairKey(selection: Selection = {}): string {
  const accessories = Array.isArray(selection.accessories)
    ? [...selection.accessories].sort().join(",")
    : selection.accessories || "-";
  return [
    `top:${selection.tops || "-"}`,
    `bottom:${selection.bottoms || "-"}`,
    `shoes:${selection.shoes || "-"}`,
    `accessories:${accessories}`,
  ].join("|");
}

export function pairFitFor(
  variableFits: VariableFits,
  selection: Selection,
  state: PairState,
  id: string,
): Fit | undefined {
  const pair = variableFits.pairs?.[selectionPairKey(selection)];
  const group = pair ? pair[state] : undefined;
  const stateFit = group?.[id];
  if (stateFit && isSafeFit(stateFit)) return stateFit;

  // Compatibility with JSON written before pairs gained three explicit states.
  if (state === "neutral" && pair) {
    const legacyFit = (pair as unknown as Record<string, unknown>)[id];
    if (isSafeFit(legacyFit)) return legacyFit;
  }
  return undefined;
}

export function pairEraseDotsFor(
  variableFits: VariableFits,
  selection: Selection,
  state: PairState,
  id: string,
): EraseDot[] | undefined {
  const group = variableFits.pairs?.[selectionPairKey(selection)]?.eraseMasks?.[state];
  if (!group || !Object.prototype.hasOwnProperty.call(group, id)) return undefined;
  return group[id];
}

export function resolveStudioEraseDots(
  id: string,
  eraseMasks: EraseMasks = publishedEraseMasks,
  variableFits: VariableFits = publishedVariableFits,
  context: FitContext = {},
): EraseDot[] {
  const state: PairState = context.hasFace
    ? "face_composite"
    : context.isShowcase
      ? "showcase_pose"
      : "neutral";
  const pairDots = context.selection
    ? pairEraseDotsFor(variableFits, context.selection, state, id)
    : undefined;
  return pairDots === undefined ? eraseMasks[id] || [] : pairDots;
}

export function resolveFit(id: string, fits: Record<string, Fit>): Fit {
  return (fits && isSafeFit(fits[id])) ? fits[id] : publishedFitFor(id);
}

export function resolveStudioFit(
  id: string,
  fits: Record<string, Fit> = {},
  context: FitContext = {},
  variableFits: VariableFits = publishedVariableFits,
): Fit {
  // A created combo may override each mode independently. Missing layers keep
  // inheriting the corresponding default mode fit.
  const pairFaceFit = context.selection
    ? pairFitFor(variableFits, context.selection, "face_composite", id)
    : undefined;
  if (context.hasFace && pairFaceFit) return pairFaceFit;

  // 1. Context-specific default fits
  // A. Face composite active
  if (context.hasFace && variableFits?.face_composite?.[id] && isSafeFit(variableFits.face_composite[id])) {
    return variableFits.face_composite[id];
  }

  const pairShowcaseFit = context.selection
    ? pairFitFor(variableFits, context.selection, "showcase_pose", id)
    : undefined;
  if (context.isShowcase && pairShowcaseFit) return pairShowcaseFit;

  // B. Showcase pose active
  if (context.isShowcase && variableFits?.showcase_pose?.[id] && isSafeFit(variableFits.showcase_pose[id])) {
    return variableFits.showcase_pose[id];
  }

  // Neutral combo overrides are sparse; every unlisted garment inherits its
  // normal default/tuck fit.
  if (context.selection) {
    const pairFit = pairFitFor(variableFits, context.selection, "neutral", id);
    if (pairFit && isSafeFit(pairFit)) return pairFit;
  }

  // C. Denim shirt & pants tuck state (only when paired with top-fitted-denim)
  const isDenimTop = context.selection?.tops === "top-fitted-denim";
  if (id === "top-fitted-denim" || (id === "bottom-sculpted-jeans" && isDenimTop)) {
    const isTucked = context.isTucked ?? true;
    const tuckGroup = isTucked ? variableFits?.denim_tucked : variableFits?.denim_untucked;
    if (tuckGroup?.[id] && isSafeFit(tuckGroup[id])) {
      return tuckGroup[id];
    }
  }

  // D. Sculpted jeans paired with other tops
  if (id === "bottom-sculpted-jeans" && context.selection?.tops && !isDenimTop) {
    if (variableFits?.jeans_other_tops?.[id] && isSafeFit(variableFits.jeans_other_tops[id])) {
      return variableFits.jeans_other_tops[id];
    }
  }

  // 2. Local explicit override in current fits
  if (fits[id] && isSafeFit(fits[id])) {
    return fits[id];
  }

  // E. Modal grommet top default baseline
  if (id === "top-modal-grommet" && variableFits?.modal_default?.[id] && isSafeFit(variableFits.modal_default[id])) {
    return variableFits.modal_default[id];
  }

  // 3. Fallback to base published fit
  return publishedFitFor(id);
}

export function isSafeFit(value: unknown): value is Fit {
  if (!value || typeof value !== "object") return false;
  const fit = value as Fit;
  return (
    [fit.x, fit.y, fit.scaleX, fit.scaleY, fit.angle].every(Number.isFinite) &&
    Math.abs(fit.x) <= 800 &&
    Math.abs(fit.y) <= 1000 &&
    fit.scaleX >= 0.1 &&
    fit.scaleX <= 3.0 &&
    fit.scaleY >= 0.1 &&
    fit.scaleY <= 3.0 &&
    Math.abs(fit.angle) <= 180
  );
}

export function broadcastStudioUpdate(
  payload: Partial<SavedStudio & { variableFits?: VariableFits; faceCompositeFit?: FaceCompositeFit; hideUnderlyingBody?: boolean }>,
) {
  if (typeof window === "undefined") return;
  try {
    const channel = new BroadcastChannel(STUDIO_SYNC_CHANNEL);
    channel.postMessage(payload);
    channel.close();
  } catch {
    /* BroadcastChannel unsupported or blocked */
  }
  try {
    window.dispatchEvent(new CustomEvent("tung_tung_fit_sync", { detail: payload }));
  } catch {
    /* event dispatch error */
  }
}

export function subscribeStudioUpdate(
  callback: (
    payload: Partial<SavedStudio & { variableFits?: VariableFits; faceCompositeFit?: FaceCompositeFit; hideUnderlyingBody?: boolean }>,
  ) => void,
) {
  if (typeof window === "undefined") return () => {};
  const receive = (payload: Partial<SavedStudio>) => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "null") as Partial<SavedStudio> | null;
      currentLook = { ...(stored || currentLook || {}), ...payload } as SavedStudio;
      localStorage.setItem(storageKey, JSON.stringify(currentLook));
    } catch {
      if (currentLook) currentLook = { ...currentLook, ...payload };
    }
    callback(payload);
  };
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(STUDIO_SYNC_CHANNEL);
    channel.onmessage = (event) => {
      if (event.data && typeof event.data === "object") {
        receive(event.data);
      }
    };
  } catch {
    /* unsupported */
  }

  const handleCustomEvent = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (detail && typeof detail === "object") {
      receive(detail);
    }
  };

  window.addEventListener("tung_tung_fit_sync", handleCustomEvent);

  return () => {
    if (channel) {
      channel.close();
    }
    window.removeEventListener("tung_tung_fit_sync", handleCustomEvent);
  };
}

export function rememberLook(look: SavedStudio) {
  currentLook = {
    ...look,
    assetVersion: STUDIO_ASSET_VERSION,
    userFaceVersion: look.userFace ? FACE_CAPTURE_VERSION : undefined,
  };
  try {
    localStorage.setItem(storageKey, JSON.stringify(currentLook));
  } catch {
    /* ignore storage quota errors */
  }
}

export function readLook(): SavedStudio {
  let saved: Partial<SavedStudio> = currentLook || {};
  try {
    if (!currentLook) saved = JSON.parse(localStorage.getItem(storageKey) || "null") || {};
  } catch {
    /* Use this session's look. */
  }
  const selected: Selection = {};
  const fits: Record<string, Fit> = {};
  const held: Partial<Record<Category, boolean>> = {};

  categories.forEach(({ id }) => {
    const val = saved.selected?.[id];
    if (id === "accessories") {
      if (Array.isArray(val)) {
        const valid = val.filter((accId) =>
          allGarments.some((item) => item.id === accId && item.category === "accessories")
        );
        if (valid.length > 0) selected.accessories = valid;
      } else if (typeof val === "string" && allGarments.some((item) => item.id === val && item.category === "accessories")) {
        selected.accessories = [val];
      }
      if (saved.held?.accessories) held.accessories = true;
    } else {
      if (typeof val === "string" && allGarments.some((item) => item.id === val && item.category === id)) {
        selected[id] = val;
        if (saved.held?.[id]) held[id] = true;
      }
    }
  });

  // Always initialize all garments with saved fit or published fit as fallback
  allGarments.forEach(({ id }) => {
    if (saved.fits?.[id] && isSafeFit(saved.fits[id])) {
      fits[id] = saved.fits[id];
    } else {
      fits[id] = publishedFitFor(id);
    }
  });

  const variableFits: VariableFits = saved.variableFits || publishedVariableFits;
  const faceCompositeFit: FaceCompositeFit | undefined =
    saved.assetVersion === STUDIO_ASSET_VERSION
      ? saved.faceCompositeFit || publishedFaceCompositeFit
      : publishedFaceCompositeFit;
  const specialDressFaceCompositeFit: FaceCompositeFit =
    saved.assetVersion === STUDIO_ASSET_VERSION
      ? saved.specialDressFaceCompositeFit || publishedSpecialDressFaceCompositeFit
      : publishedSpecialDressFaceCompositeFit;

  const userFace =
    saved.userFaceVersion === FACE_CAPTURE_VERSION &&
    typeof saved.userFace === "string" &&
    saved.userFace.startsWith("data:image/")
      ? saved.userFace
      : undefined;

  let eraseMasks: EraseMasks = { ...publishedEraseMasks };
  try {
    const adminSaved = typeof window !== "undefined" ? localStorage.getItem(ERASE_DOTS_STORAGE_KEY) : null;
    if (adminSaved) {
      const parsed = JSON.parse(adminSaved);
      if (parsed && typeof parsed === "object") eraseMasks = { ...eraseMasks, ...parsed };
    }
  } catch {
    /* ignore */
  }
  if (saved.eraseMasks) {
    eraseMasks = { ...eraseMasks, ...saved.eraseMasks };
  }

  const isDenimTucked = typeof saved.isDenimTucked === "boolean" ? saved.isDenimTucked : publishedDenimTucked;
  const hideUnderlyingBody =
    typeof saved.hideUnderlyingBody === "boolean" ? saved.hideUnderlyingBody : publishedHideUnderlyingBody;
  const validTopIds = new Set(
    allGarments
      .filter((item) => item.category === "tops" && !item.id.startsWith("dress-"))
      .map((item) => item.id),
  );
  const tuckableTopIds = Array.isArray(saved.tuckableTopIds)
    ? saved.tuckableTopIds.filter((id): id is string => typeof id === "string" && validTopIds.has(id))
    : publishedTuckableTopIds;

  return {
    selected,
    fits,
    variableFits,
    faceCompositeFit,
    specialDressFaceCompositeFit,
    eraseMasks,
    held,
    userFace,
    userFaceVersion: userFace ? FACE_CAPTURE_VERSION : undefined,
    isDenimTucked,
    isShowcaseMode: saved.isShowcaseMode,
    isFaceCompositeMode:
      typeof saved.isFaceCompositeMode === "boolean" ? saved.isFaceCompositeMode : publishedFaceCompositeMode,
    hideUnderlyingBody,
    tuckableTopIds,
  };
}

export async function renderLook(
  {
    selected,
    fits,
    variableFits,
    faceCompositeFit,
    userFace,
    eraseMasks,
    isDenimTucked,
    isFaceCompositeMode,
    hideUnderlyingBody,
    tuckableTopIds,
  }: SavedStudio,
  showcase = true,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = STAGE.width;
  canvas.height = STAGE.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  const boots = Boolean(selected.shoes);

  let faceImage: HTMLImageElement | undefined;
  if (showcase && isFaceCompositeMode && userFace) {
    try {
      const image = new Image();
      image.src = userFace;
      await image.decode();
      faceImage = image;
    } catch {
      // A damaged saved data URL must not leave a transparent hole in the pose.
    }
  }

  const fitContext: FitContext = {
    isTucked: isDenimTucked ?? true,
    hasFace: Boolean(faceImage),
    isShowcase: showcase,
    selection: selected,
  };
  const faceSwapLayoutActive = Boolean(showcase && isFaceCompositeMode);
  fitContext.hasFace = faceSwapLayoutActive;
  const showcasePoseCoverId = showcasePoseCoverAssetId(selected, showcase, faceSwapLayoutActive);

  const layers = [
    ...modelAssetIds(selected, showcase, faceSwapLayoutActive).map((id, index) => ({
      kind: "asset" as const,
      id,
      fit: initialFit,
      clip: false,
      order: index,
    })),
    ...(selected.tops === "top-modal-grommet"
      ? [
          {
            kind: "asset" as const,
            id: "top-modal-grommet-skin",
            fit: resolveStudioFit("top-modal-grommet", fits, fitContext, variableFits),
            clip: false,
            order: 39,
          },
        ]
      : []),
    ...allGarments
      .filter((item) => isGarmentSelected(item.id, selected) && isGarmentVisibleInStage(item, selected, showcase, faceSwapLayoutActive))
      .map((item) => ({
        kind: "asset" as const,
        id: garmentAssetId(item.id, selected, showcase, faceSwapLayoutActive),
        rawId: item.id,
        fit: resolveStudioFit(item.id, fits, fitContext, variableFits),
        clip: boots && bootTuckBottomIds.has(item.id),
        order: getGarmentLayerOrder(
          item,
          selected,
          isDenimTucked ?? true,
          tuckableTopIds || publishedTuckableTopIds,
          showcase,
          faceSwapLayoutActive,
        ),
      })),
    ...(faceImage
      ? [
          {
            kind: "face" as const,
            image: faceImage,
            // Face swap always restores the registered standing model, including
            // for the special dress, so every outfit shares the neutral face fit.
            pose: facePoseFor(selected, faceCompositeFit),
            order: getUserFaceLayerOrder(selected, isDenimTucked ?? true, tuckableTopIds || publishedTuckableTopIds),
          },
        ]
      : []),
    ...(faceImage
      ? [
          {
            kind: "asset" as const,
            id: "model-face-frame-overlay",
            fit: initialFit,
            clip: false,
            order: faceFrameOrder,
          },
        ]
      : []),
    ...(showcasePoseCoverId
      ? [
          {
            kind: "asset" as const,
            id: showcasePoseCoverId,
            fit: initialFit,
            clip: false,
            order: showcasePoseCoverOrder,
          },
        ]
      : []),

  ].sort((a, b) => a.order - b.order);

  const images = await Promise.all(
    layers.map(async (layer) => {
      if (layer.kind === "face") return layer.image;
      const image = new Image();
      image.src = assetUrl(layer.id);
      await image.decode();
      return image;
    }),
  );

  layers.forEach((layer, index) => {
    if (layer.kind === "face") {
      drawUserFace(context, images[index], layer.pose);
      return;
    }
    const { fit, clip } = layer;
    context.save();
    context.translate(STAGE.width / 2 + fit.x, STAGE.height / 2 + fit.y);
    context.rotate((fit.angle * Math.PI) / 180);
    context.scale(fit.scaleX, fit.scaleY);
    const height = STAGE.height * (clip ? 0.648 : 1);
    const layerId = "rawId" in layer && typeof layer.rawId === "string" ? layer.rawId : layer.id;
    const isModel = layer.kind === "asset" && layer.id.startsWith("model");
    const dots = isModel
      ? [
          ...resolveStudioEraseDots("model", eraseMasks || {}, variableFits, fitContext),
          ...resolveStudioEraseDots(layerId, eraseMasks || {}, variableFits, fitContext),
        ]
      : resolveStudioEraseDots(layerId, eraseMasks || {}, variableFits, fitContext);
    const maskUnderlying = isModel ? Boolean(hideUnderlyingBody) : false;

    if ((dots && dots.length > 0) || maskUnderlying) {
      const layerCanvas = document.createElement("canvas");
      layerCanvas.width = STAGE.width;
      layerCanvas.height = STAGE.height;
      const layerCtx = layerCanvas.getContext("2d");
      if (layerCtx) {
        layerCtx.drawImage(images[index], 0, 0, STAGE.width, height, 0, 0, STAGE.width, height);
        layerCtx.globalCompositeOperation = "destination-out";
        if (maskUnderlying) {
          layerCtx.fillRect(412, 348, 218, 290);
          layerCtx.fillRect(370, 638, 284, 182);
        }
        if (dots) {
          for (const dot of dots) {
            layerCtx.beginPath();
            layerCtx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
            layerCtx.fill();
          }
        }
        context.drawImage(layerCanvas, 0, 0, STAGE.width, height, -STAGE.width / 2, -STAGE.height / 2, STAGE.width, height);
      } else {
        context.drawImage(images[index], 0, 0, STAGE.width, height, -STAGE.width / 2, -STAGE.height / 2, STAGE.width, height);
      }
    } else {
      context.drawImage(images[index], 0, 0, STAGE.width, height, -STAGE.width / 2, -STAGE.height / 2, STAGE.width, height);
    }
    context.restore();
  });

  return canvas;
}
