import type { CSSProperties } from "react";
import type { Selection } from "./studio";

export const FACE_CAPTURE_VIEWPORT = { width: 380, height: 300 } as const;
export const FACE_TEXTURE = { width: 160, height: 190 } as const;
export const FACE_CAPTURE_VERSION = "face-frame-overlay-v4";

export type FacePoseId = "face-safe-neutral";

export type FacePose = {
  id: FacePoseId;
  label: string;
  guide: {
    centerX: number;
    centerY: number;
    width: number;
    height: number;
    angle: number;
  };
  stage: {
    centerX: number;
    centerY: number;
    width: number;
    height: number;
    angle: number;
  };
};

export type FacePoseFit = Pick<FacePose, "guide" | "stage">;

// The face crop is shared by both showcase poses. Pose-specific hand layers are
// rendered after the frame so fingers can overlap the captured photo naturally.
export const FACE_POSES: Record<FacePoseId, FacePose> = {
  "face-safe-neutral": {
    id: "face-safe-neutral",
    label: "khung mặt showcase",
    guide: { centerX: 190, centerY: 150, width: 126, height: 160, angle: 0 },
    stage: { centerX: 512, centerY: 176, width: 120, height: 160, angle: 0 },
  },
};

export function facePoseFor(_selection: Selection, fit?: FacePoseFit): FacePose {
  const pose = FACE_POSES["face-safe-neutral"];
  return fit ? { ...pose, guide: fit.guide, stage: fit.stage } : pose;
}

export function faceLayerStyle(pose: FacePose, zIndex: number): CSSProperties {
  const { centerX, centerY, width, height, angle } = pose.stage;
  return {
    left: `${(centerX - width / 2) / 1024 * 100}%`,
    top: `${(centerY - height / 2) / 1536 * 100}%`,
    width: `${width / 1024 * 100}%`,
    height: `${height / 1536 * 100}%`,
    transform: `rotate(${angle}deg)`,
    transformOrigin: "50% 50%",
    zIndex,
  };
}

// Maps the full 1024 × 1536 head-accessory layer onto the camera guide using
// the exact same face rectangle as the stage. The camera image remains below
// this layer and can be dragged/zoomed independently by the player.
export function faceCameraAccessoryStyle(pose: FacePose): CSSProperties {
  const scaleX = pose.guide.width / pose.stage.width;
  const scaleY = pose.guide.height / pose.stage.height;
  return {
    left: pose.guide.centerX - pose.stage.centerX * scaleX,
    top: pose.guide.centerY - pose.stage.centerY * scaleY,
    width: 1024 * scaleX,
    height: 1536 * scaleY,
  };
}

export function drawUserFace(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  pose: FacePose,
) {
  const { centerX, centerY, width, height, angle } = pose.stage;
  context.save();
  context.translate(centerX, centerY);
  context.rotate(angle * Math.PI / 180);
  context.drawImage(image, -width / 2, -height / 2, width, height);
  context.restore();
}
