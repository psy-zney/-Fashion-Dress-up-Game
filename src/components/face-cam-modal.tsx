"use client";

import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from "react";
import { playSound } from "@/lib/sound-effects";
import { publicAsset } from "@/lib/public-asset";
import { assetUrl } from "@/lib/studio";
import { FACE_CAPTURE_VIEWPORT, FACE_TEXTURE, faceCameraAccessoryStyle, type FacePose } from "@/lib/face-composite";

type FaceCamModalProps = {
  isOpen: boolean;
  pose: FacePose;
  onClose: () => void;
  onApplyFace: (faceDataUrl: string) => void;
};

type CameraState = "off" | "starting" | "live" | "error";

export function FaceCamModal({ isOpen, pose, onClose, onApplyFace }: FaceCamModalProps) {
  const [cameraState, setCameraState] = useState<CameraState>("off");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadedSrc, setUploadedSrc] = useState<string | null>(null);
  const [capturedFaceUrl, setCapturedFaceUrl] = useState<string | null>(null);

  // Alignment controls operate identically in the preview and capture canvas.
  const [zoom, setZoom] = useState(0.85);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [roll, setRoll] = useState(0);
  const [isMirrored, setIsMirrored] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadedImageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; panX: number; panY: number } | null>(null);

  // Stop camera stream safely
  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraState("off");
  }

  // Start camera stream
  async function startCamera(facing: "user" | "environment" = facingMode) {
    stopCamera();
    setErrorMessage("");
    setUploadedSrc(null);
    setCapturedFaceUrl(null);
    setCameraState("starting");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Trình duyệt không hỗ trợ webcam hoặc cần chạy trên HTTPS / localhost.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 720 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraState("live");
    } catch (error) {
      setCameraState("error");
      const err = error as { name?: string; message?: string };
      if (err.name === "NotAllowedError" || err.name === "SecurityError") {
        setErrorMessage("Quyền truy cập camera bị từ chối. Vui lòng cấp quyền hoặc tải ảnh chân dung từ máy.");
      } else if (err.name === "NotFoundError") {
        setErrorMessage("Không tìm thấy camera trên thiết bị. Bạn có thể tải ảnh từ máy.");
      } else {
        setErrorMessage(err.message || "Không thể mở camera. Vui lòng thử lại hoặc tải ảnh từ máy.");
      }
    }
  }

  useEffect(() => {
    if (isOpen) {
      startCamera("user");
    } else {
      stopCamera();
      setCapturedFaceUrl(null);
      setUploadedSrc(null);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Handle switching front / back camera
  function switchCamera() {
    playSound("tap");
    const nextFacing = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextFacing);
    setIsMirrored(nextFacing === "user");
    startCamera(nextFacing);
  }

  // Handle file upload fallback
  function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    stopCamera();
    playSound("click");
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setUploadedSrc(reader.result);
        setCameraState("off");
        setCapturedFaceUrl(null);
        setZoom(0.85);
        setPanX(0);
        setPanY(0);
        setRoll(0);
        setIsMirrored(false);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function resetAlignment() {
    setZoom(0.85);
    setPanX(0);
    setPanY(0);
    setRoll(0);
  }

  function handleAlignPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (capturedFaceUrl || (cameraState !== "live" && !uploadedSrc)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, panX, panY };
  }

  function handleAlignPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const scale = FACE_CAPTURE_VIEWPORT.width / bounds.width;
    setPanX(Math.max(-80, Math.min(80, Math.round(drag.panX + (event.clientX - drag.x) * scale))));
    setPanY(Math.max(-60, Math.min(60, Math.round(drag.panY + (event.clientY - drag.y) * scale))));
  }

  function handleAlignPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  // Store a normalized face texture. Pose rotation and placement are reapplied
  // by the stage/export compositor, so one capture remains usable per pose.
  function captureFace() {
    playSound("shutter");
    const canvas = document.createElement("canvas");
    canvas.width = FACE_CAPTURE_VIEWPORT.width;
    canvas.height = FACE_CAPTURE_VIEWPORT.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const source = uploadedSrc ? uploadedImageRef.current : videoRef.current;
    if (!source) return;

    const sourceWidth = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
    const sourceHeight = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
    if (!sourceWidth || !sourceHeight) return;

    const viewportRatio = FACE_CAPTURE_VIEWPORT.width / FACE_CAPTURE_VIEWPORT.height;
    const sourceRatio = sourceWidth / sourceHeight;
    const drawWidth = sourceRatio > viewportRatio
      ? FACE_CAPTURE_VIEWPORT.height * sourceRatio
      : FACE_CAPTURE_VIEWPORT.width;
    const drawHeight = sourceRatio > viewportRatio
      ? FACE_CAPTURE_VIEWPORT.height
      : FACE_CAPTURE_VIEWPORT.width / sourceRatio;

    ctx.save();
    ctx.translate(FACE_CAPTURE_VIEWPORT.width / 2 + panX, FACE_CAPTURE_VIEWPORT.height / 2 + panY);
    ctx.rotate(roll * Math.PI / 180);
    ctx.scale(isMirrored ? -zoom : zoom, zoom);
    ctx.drawImage(source, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();

    // Unrotate the pose aperture into a reusable portrait texture.
    const clippedCanvas = document.createElement("canvas");
    clippedCanvas.width = FACE_TEXTURE.width;
    clippedCanvas.height = FACE_TEXTURE.height;
    const cCtx = clippedCanvas.getContext("2d");
    if (cCtx) {
      cCtx.save();
      cCtx.translate(FACE_TEXTURE.width / 2, FACE_TEXTURE.height / 2);
      cCtx.scale(FACE_TEXTURE.width / pose.guide.width, FACE_TEXTURE.height / pose.guide.height);
      cCtx.rotate(-pose.guide.angle * Math.PI / 180);
      cCtx.drawImage(canvas, -pose.guide.centerX, -pose.guide.centerY);
      cCtx.restore();

      // A face-shaped elliptical feather keeps the user's neck and background
      // out of the outfit while avoiding the old circular sticker edge.
      const mask = document.createElement("canvas");
      mask.width = FACE_TEXTURE.width;
      mask.height = FACE_TEXTURE.height;
      const maskCtx = mask.getContext("2d");
      if (!maskCtx) return;
      maskCtx.translate(FACE_TEXTURE.width / 2, FACE_TEXTURE.height / 2);
      maskCtx.scale(1, FACE_TEXTURE.height / FACE_TEXTURE.width);
      const grad = maskCtx.createRadialGradient(0, 0, FACE_TEXTURE.width * 0.40, 0, 0, FACE_TEXTURE.width * 0.5);
      grad.addColorStop(0, "rgba(0,0,0,1)");
      grad.addColorStop(0.72, "rgba(0,0,0,1)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      maskCtx.fillStyle = grad;
      maskCtx.fillRect(-FACE_TEXTURE.width / 2, -FACE_TEXTURE.width / 2, FACE_TEXTURE.width, FACE_TEXTURE.width);

      cCtx.globalCompositeOperation = "destination-in";
      cCtx.drawImage(mask, 0, 0);
    }

    const dataUrl = clippedCanvas.toDataURL("image/png");
    setCapturedFaceUrl(dataUrl);
  }

  function handleConfirm() {
    if (!capturedFaceUrl) return;
    playSound("showcase");
    onApplyFace(capturedFaceUrl);
    onClose();
  }

  function handleRetake() {
    playSound("tap");
    setCapturedFaceUrl(null);
    if (!uploadedSrc && cameraState === "off") {
      startCamera();
    }
  }

  if (!isOpen) return null;

  const eyeY = pose.guide.centerY - pose.guide.height * 0.08;
  const eyeOffset = pose.guide.width * 0.24;
  const noseBottom = pose.guide.centerY + pose.guide.height * 0.18;
  const mouthY = pose.guide.centerY + pose.guide.height * 0.31;

  return (
    <div className="face-cam-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="face-cam-title">
      <div className="face-cam-card">
        {/* Header */}
        <div className="face-cam-header">
          <div className="face-cam-title-group">
            <span className="face-cam-icon">📸</span>
            <h2 id="face-cam-title">Chụp hình Show your look V2</h2>
          </div>
          <button
            type="button"
            className="face-cam-close-btn"
            onClick={onClose}
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        <p className="face-cam-desc">
          Tóc, mũ và kính của model đã được đặt trên camera. Kéo ảnh bên dưới để đặt hai mắt vào kính; có thể phóng to và chỉnh nghiêng thêm ở các thanh bên dưới.
        </p>

        {/* Viewport with Hat & Hair overlay */}
        <div className="face-cam-viewport-wrap">
          <div
            className={`face-cam-viewport ${!capturedFaceUrl && (cameraState === "live" || uploadedSrc) ? "is-alignable" : ""}`}
            data-face-pose={pose.id}
            onPointerDown={handleAlignPointerDown}
            onPointerMove={handleAlignPointerMove}
            onPointerUp={handleAlignPointerEnd}
            onPointerCancel={handleAlignPointerEnd}
            aria-label="Kéo ảnh để căn khuôn mặt"
          >
            {/* Studio Background Layer behind character (ẩn viền cam ngoài / đè hình nền luôn) */}
            <div className="face-cam-bg-layer" aria-hidden="true">
              <img
                src={publicAsset("/game/backgrounds/slide-playground.webp")}
                alt=""
                className="face-cam-bg-img"
              />
              <div className="face-cam-bg-vignette" />
            </div>

            {/* Face Aperture Portal - Live Camera / Uploaded Image */}
            <div className="face-cam-face-portal">
              {/* Live Camera Feed */}
              <video
                ref={videoRef}
                className={`face-cam-media ${isMirrored ? "is-mirrored" : ""}`}
                style={{
                  display: uploadedSrc || capturedFaceUrl ? "none" : "block",
                  transform: `translate(${panX}px, ${panY}px) rotate(${roll}deg) scale(${isMirrored ? -zoom : zoom}, ${zoom})`,
                }}
                playsInline
                muted
                autoPlay
              />

              {/* Uploaded Image Feed */}
              {uploadedSrc && !capturedFaceUrl && (
                <img
                  ref={uploadedImageRef}
                  src={uploadedSrc}
                  alt=""
                  className="face-cam-media"
                  style={{
                    transform: `translate(${panX}px, ${panY}px) rotate(${roll}deg) scale(${zoom})`,
                  }}
                />
              )}

              {/* Captured Face Snapshot Preview */}
              {capturedFaceUrl && (
                <img
                  src={capturedFaceUrl}
                  alt="Captured Face"
                  className="face-cam-captured-face"
                  style={{
                    left: pose.guide.centerX - pose.guide.width / 2,
                    top: pose.guide.centerY - pose.guide.height / 2,
                    width: pose.guide.width,
                    height: pose.guide.height,
                    transform: `rotate(${pose.guide.angle}deg)`,
                  }}
                />
              )}
            </div>

            <img
              src={assetUrl("model-face-accessories-safe")}
              alt=""
              className="face-cam-accessory-overlay"
              style={faceCameraAccessoryStyle(pose)}
              aria-hidden="true"
              data-testid="face-cam-accessory-overlay"
              draggable={false}
            />

            {/* Proportional guide only. Accessories stay in the selected pose layer. */}
            {!capturedFaceUrl && (
              <div className="face-cam-guide-ring" aria-hidden="true">
                <svg className="face-cam-features-guide" viewBox="0 0 380 300" aria-hidden="true">
                  <defs>
                    <mask id="face-guide-cutout">
                      <rect width="380" height="300" fill="white" />
                      <ellipse
                        cx={pose.guide.centerX}
                        cy={pose.guide.centerY}
                        rx={pose.guide.width / 2 + 4}
                        ry={pose.guide.height / 2 + 4}
                        fill="black"
                        transform={`rotate(${pose.guide.angle} ${pose.guide.centerX} ${pose.guide.centerY})`}
                      />
                    </mask>
                  </defs>
                  <rect width="380" height="300" fill="rgba(7, 12, 11, 0.28)" mask="url(#face-guide-cutout)" />
                  <g transform={`rotate(${pose.guide.angle} ${pose.guide.centerX} ${pose.guide.centerY})`}>
                    <ellipse
                      cx={pose.guide.centerX}
                      cy={pose.guide.centerY}
                      rx={pose.guide.width / 2}
                      ry={pose.guide.height / 2}
                      fill="rgba(80, 227, 194, 0.06)"
                      stroke="rgba(255, 255, 255, 0.92)"
                      strokeWidth="1.8"
                      strokeDasharray="6 5"
                      className="guide-contour-pulse"
                    />
                    <path
                      d={`M${pose.guide.centerX - eyeOffset - 12} ${eyeY} Q${pose.guide.centerX - eyeOffset} ${eyeY - 6} ${pose.guide.centerX - eyeOffset + 12} ${eyeY}`}
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.9)"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <path
                      d={`M${pose.guide.centerX + eyeOffset - 12} ${eyeY} Q${pose.guide.centerX + eyeOffset} ${eyeY - 6} ${pose.guide.centerX + eyeOffset + 12} ${eyeY}`}
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.85)"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <circle cx={pose.guide.centerX - eyeOffset} cy={eyeY} r="2.6" fill="rgba(80, 227, 194, 1)" />
                    <circle cx={pose.guide.centerX + eyeOffset} cy={eyeY} r="2.6" fill="rgba(80, 227, 194, 1)" />
                    <path
                      d={`M${pose.guide.centerX} ${pose.guide.centerY - 3} L${pose.guide.centerX} ${noseBottom} M${pose.guide.centerX - 5} ${noseBottom} Q${pose.guide.centerX} ${noseBottom + 4} ${pose.guide.centerX + 5} ${noseBottom}`}
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.85)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d={`M${pose.guide.centerX - 17} ${mouthY} Q${pose.guide.centerX} ${mouthY + 7} ${pose.guide.centerX + 17} ${mouthY}`}
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.9)"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </g>
                </svg>
                <span className="face-cam-guide-text">Kéo ảnh • mắt vào 2 chấm • giữ đủ trán và cằm</span>
              </div>
            )}

            {/* Starting status overlay */}
            {cameraState === "starting" && !uploadedSrc && (
              <div className="face-cam-status-overlay">
                <div className="face-cam-spinner" />
                <span>Đang kết nối camera…</span>
              </div>
            )}

            {/* Error overlay */}
            {cameraState === "error" && !uploadedSrc && (
              <div className="face-cam-error-overlay">
                <span className="face-cam-error-icon">📷</span>
                <p>{errorMessage}</p>
                <button
                  type="button"
                  className="face-cam-retry-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  📁 Chọn ảnh từ máy tính
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Alignment Controls (Zoom & Pan) */}
        {!capturedFaceUrl && (cameraState === "live" || uploadedSrc) && (
          <div className="face-cam-adjust-panel">
            <div className="face-cam-adjust-heading">
              <span>Kéo trực tiếp trên ảnh để căn nhanh</span>
              <button type="button" onClick={resetAlignment}>Căn lại</button>
            </div>
            <div className="face-cam-slider-row">
              <label htmlFor="face-zoom">🔍 Độ phóng:</label>
              <input
                id="face-zoom"
                type="range"
                min="0.7"
                max="2.2"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
              <span>{Math.round(zoom * 100)}%</span>
            </div>

            <div className="face-cam-slider-row">
              <label htmlFor="face-pan-x">↔ Ngang:</label>
              <input
                id="face-pan-x"
                type="range"
                min="-80"
                max="80"
                step="1"
                value={panX}
                onChange={(e) => setPanX(Number(e.target.value))}
              />
              <span>{panX > 0 ? `+${panX}` : panX}px</span>
            </div>
            <div className="face-cam-slider-row">
              <label htmlFor="face-pan-y">↕ Vị trí dọc:</label>
              <input
                id="face-pan-y"
                type="range"
                min="-60"
                max="60"
                step="1"
                value={panY}
                onChange={(e) => setPanY(Number(e.target.value))}
              />
              <span>{panY > 0 ? `+${panY}` : panY}px</span>
            </div>
            <div className="face-cam-slider-row">
              <label htmlFor="face-roll">↻ Độ nghiêng:</label>
              <input
                id="face-roll"
                type="range"
                min="-12"
                max="12"
                step="0.5"
                value={roll}
                onChange={(e) => setRoll(Number(e.target.value))}
              />
              <span>{roll > 0 ? `+${roll}` : roll}°</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <footer className="face-cam-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            style={{ display: "none" }}
          />

          {!capturedFaceUrl ? (
            <>
              <button
                type="button"
                className="face-cam-btn face-cam-btn-secondary"
                onClick={() => fileInputRef.current?.click()}
                title="Tải ảnh khuôn mặt từ thiết bị"
              >
                📁 Tải ảnh
              </button>

              {cameraState === "live" && (
                <button
                  type="button"
                  className="face-cam-btn face-cam-btn-icon"
                  onClick={switchCamera}
                  title="Đổi camera trước / sau"
                  aria-label="Đổi camera"
                >
                  🔄
                </button>
              )}

              <button
                type="button"
                className="face-cam-btn face-cam-btn-primary face-cam-shutter-btn"
                onClick={captureFace}
                disabled={cameraState !== "live" && !uploadedSrc}
                data-testid="face-cam-snap-btn"
              >
                📸 Chụp khuôn mặt
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="face-cam-btn face-cam-btn-secondary"
                onClick={handleRetake}
                data-testid="face-cam-retake-btn"
              >
                🔄 Chụp lại
              </button>
              <button
                type="button"
                className="face-cam-btn face-cam-btn-primary face-cam-confirm-btn"
                onClick={handleConfirm}
                data-testid="face-cam-confirm-btn"
              >
                ✨ Ghép vào nhân vật
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
