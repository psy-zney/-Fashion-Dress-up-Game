"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import { readLook, renderLook } from "@/lib/studio-look";
import { playSound } from "@/lib/sound-effects";

const art = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/game/photoshoot`;
type CameraState = "off" | "starting" | "live" | "error";
type Placement = { x: number; y: number; scale: number };
const initialPlacement: Placement = { x: 0.5, y: 0.5, scale: 0.94 };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function cameraError(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Camera permission denied. Please allow camera access in your browser and try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera found. Please connect a camera and try again.";
  if (name === "NotReadableError") return "Camera is busy. Please close other applications using the camera and try again.";
  return "Unable to open camera. Please check your device and try again.";
}

export function Photoshoot() {
  const [lookUrl, setLookUrl] = useState("");
  const [lookState, setLookState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [camera, setCamera] = useState<CameraState>("off");
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [placement, setPlacement] = useState(initialPlacement);
  const [photo, setPhoto] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Turn on camera to place your styled look into your real world.");
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const characterRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef(0);
  const mounted = useRef(false);
  const busyRef = useRef(false);
  const drag = useRef<{ x: number; y: number; placement: Placement } | null>(null);

  function stopCamera() {
    requestRef.current++;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; stopCamera(); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const look = readLook();
    if (!look.selected.tops || !look.selected.bottoms || !look.selected.shoes) {
      setLookState("empty");
      setStatus("Please select a top, bottom, and shoes to begin the photoshoot.");
      return;
    }
    setLookState("loading");
    renderLook(look).then((canvas) => {
      if (cancelled) return;
      characterRef.current = canvas;
      setLookUrl(canvas.toDataURL("image/png"));
      setLookState("ready");
    }).catch(() => {
      if (cancelled) return;
      setLookState("error");
      setStatus("Unable to load outfit graphics. Please try reloading.");
    });
    return () => { cancelled = true; };
  }, [loadAttempt]);

  async function startCamera(nextFacing = facing) {
    stopCamera();
    setPhoto("");
    setFacing(nextFacing);
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCamera("error");
      setStatus("Camera requires HTTPS or localhost and a supported browser.");
      return;
    }
    const request = requestRef.current;
    setCamera("starting");
    setStatus("Starting camera… Please allow access when prompted.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: nextFacing }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
      if (!mounted.current || request !== requestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) { stopCamera(); return; }
      video.srcObject = stream;
      await video.play();
      if (!mounted.current || request !== requestRef.current) return;
      const actualFacing = stream.getVideoTracks()[0]?.getSettings().facingMode;
      setFacing(actualFacing === "user" ? "user" : actualFacing === "environment" ? "environment" : nextFacing);
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (!mounted.current || request !== requestRef.current) return;
        stopCamera();
        setCamera("error");
        setStatus("Camera disconnected. Please reconnect and try again.");
      });
      setCamera("live");
      setStatus("Drag character, adjust scale, then tap camera to take a photo.");
    } catch (error) {
      if (!mounted.current || request !== requestRef.current) return;
      stopCamera();
      setCamera("error");
      setStatus(cameraError(error));
    }
  }

  function moveCharacter(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current || !frameRef.current) return;
    const bounds = frameRef.current.getBoundingClientRect();
    setPlacement({ ...drag.current.placement,
      x: clamp(drag.current.placement.x + (event.clientX - drag.current.x) / bounds.width, 0, 1),
      y: clamp(drag.current.placement.y + (event.clientY - drag.current.y) / bounds.height, 0, 1),
    });
  }

  function moveWithKeys(event: KeyboardEvent<HTMLDivElement>) {
    const delta: Record<string, [number, number]> = { ArrowLeft: [-0.02, 0], ArrowRight: [0.02, 0], ArrowUp: [0, -0.02], ArrowDown: [0, 0.02] };
    if (!delta[event.key]) return;
    event.preventDefault();
    const [x, y] = delta[event.key];
    setPlacement((p) => ({ ...p, x: clamp(p.x + x, 0, 1), y: clamp(p.y + y, 0, 1) }));
  }

  async function compose(): Promise<HTMLCanvasElement> {
    const character = characterRef.current;
    const frame = frameRef.current;
    const scene = sceneRef.current;
    if (!character || !frame || !scene) throw new Error("Look not ready");
    const canvas = document.createElement("canvas");
    const live = camera === "live";
    const frameBounds = frame.getBoundingClientRect();
    const bounds = live ? frameBounds : scene.getBoundingClientRect();
    canvas.width = live ? 1024 : 1440;
    canvas.height = Math.round(canvas.width * bounds.height / bounds.width);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    if (live) {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !video.videoWidth) throw new Error("Camera not ready");
      // Match the preview's object-fit: cover crop exactly.
      const ratio = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
      context.save();
      if (facing === "user") { context.translate(canvas.width, 0); context.scale(-1, 1); }
      context.drawImage(video, (canvas.width - video.videoWidth * ratio) / 2, (canvas.height - video.videoHeight * ratio) / 2, video.videoWidth * ratio, video.videoHeight * ratio);
      context.restore();
    } else {
      const background = new Image();
      background.src = `${art}/background.png`;
      await background.decode();
      const ratio = Math.max(canvas.width / background.width, canvas.height / background.height);
      context.drawImage(background, (canvas.width - background.width * ratio) / 2, (canvas.height - background.height * ratio) / 2, background.width * ratio, background.height * ratio);
    }
    const factor = canvas.width / bounds.width;
    const height = frameBounds.height * placement.scale * factor;
    const width = height * character.width / character.height;
    const x = ((live ? 0 : frameBounds.left - bounds.left) + frameBounds.width * placement.x) * factor - width / 2;
    const y = ((live ? 0 : frameBounds.top - bounds.top) + frameBounds.height * placement.y) * factor - height / 2;
    context.drawImage(character, x, y, width, height);
    return canvas;
  }

  async function takePhoto() {
    if (busyRef.current || camera !== "live") return;
    busyRef.current = true;
    setBusy(true);
    try {
      const canvas = await compose();
      setPhoto(canvas.toDataURL("image/png"));
      stopCamera();
      setCamera("off");
      playSound("showcase");
      setStatus("Photo taken! Click SAVE to download or RETAKE.");
    } catch { setStatus("Could not take photo. Please wait for camera to be ready and try again."); }
    finally { busyRef.current = false; setBusy(false); }
  }

  async function savePhoto() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const url = photo || (await compose()).toDataURL("image/png");
      const link = document.createElement("a");
      link.href = url;
      link.download = "fashion-photoshoot.png";
      link.click();
      setStatus("PNG photo downloaded to your device.");
    } catch { setStatus("Could not save photo. Please wait for image to load and try again."); }
    finally { busyRef.current = false; setBusy(false); }
  }

  const canShoot = lookState === "ready" && !busy;
  const cameraFrame = camera === "live" || camera === "starting" || Boolean(photo);
  return (
    <main className="photoshoot-shell" lang="en">
      <div className="photoshoot-scene" ref={sceneRef}>
        <img className="photoshoot-background" src={`${art}/background.png`} alt="" draggable={false} />
        <section className="photoshoot-panel" aria-labelledby="photoshoot-title">
          <p className="photoshoot-sticker">TIME FOR YOUR</p>
          <h1 id="photoshoot-title">PHOTOSHOOT</h1>
          <button className="photoshoot-shutter" type="button" aria-label={photo ? "Retake photo" : camera === "live" ? "Take photo" : "Turn on camera"}
            disabled={!canShoot || camera === "starting"} onClick={() => { playSound("click"); if (camera === "live") void takePhoto(); else void startCamera(); }}>
            <img src={`${art}/camera.svg`} alt="" draggable={false} />
          </button>
          <span className="photoshoot-shutter-label">{photo ? "RETAKE" : camera === "live" ? "TAKE PHOTO" : camera === "starting" ? "STARTING CAMERA…" : "TURN ON CAMERA"}</span>
          <div className="photoshoot-tools">
            {camera === "live" && !photo && <>
              <div className="photoshoot-camera-actions">
                <button type="button" disabled={busy} onClick={() => { playSound("click"); void startCamera(facing === "user" ? "environment" : "user"); }}>Switch camera ↻</button>
                <button type="button" disabled={busy} onClick={() => { playSound("click"); stopCamera(); setCamera("off"); setPlacement(initialPlacement); setStatus("Camera turned off. You can save your photo with the photoshoot background."); }}>Turn off camera</button>
              </div>
              <label className="photoshoot-scale">Scale
                <input aria-label="Character scale" type="range" min="0.3" max="1.3" step="0.01" value={placement.scale} disabled={busy} onChange={(e) => setPlacement((p) => ({ ...p, scale: Number(e.target.value) }))} />
              </label>
              <button className="photoshoot-reset" type="button" onClick={() => { playSound("click"); setPlacement(initialPlacement); }}>Reset position</button>
            </>}
            {lookState === "error" && <button type="button" onClick={() => { playSound("click"); setLoadAttempt((value) => value + 1); }}>Reload outfit</button>}
          </div>
          <nav className="photoshoot-menu" aria-label="Photoshoot">
            <button type="button" disabled={!canShoot || camera === "starting"} onClick={() => { playSound("click"); void savePhoto(); }}><span aria-hidden="true">▸</span> {busy ? "SAVING…" : "SAVE"}</button>
            <Link href="/" onClick={() => { stopCamera(); playSound("back"); }}><span aria-hidden="true">▸</span> MAIN MENU</Link>
            <Link href="/play" onClick={() => { stopCamera(); playSound("back"); }}><span aria-hidden="true">▸</span> GO BACK</Link>
          </nav>
          <p className="photoshoot-status" role="status">{status}</p>
        </section>
        <div className={`photoshoot-frame ${cameraFrame ? "has-camera" : ""}`} ref={frameRef} data-testid="photoshoot-frame">
          <video ref={videoRef} className={facing === "user" ? "is-mirrored" : ""} autoPlay muted playsInline aria-label="Live camera feed" hidden={!cameraFrame || Boolean(photo)} />
          {photo ? <img className="photoshoot-result" src={photo} alt="Captured photo: character wearing styled outfit on live camera background" data-testid="photoshoot-result" /> :
            lookUrl && <div className={`photoshoot-character ${camera === "live" ? "is-movable" : ""}`} style={{ left: `${placement.x * 100}%`, top: `${placement.y * 100}%`, height: `${placement.scale * 100}%` }}
              role={camera === "live" ? "group" : undefined} tabIndex={camera === "live" ? 0 : undefined} aria-label="Character placement" aria-description="Drag or use arrow keys to position character inside frame."
              onKeyDown={moveWithKeys} onPointerDown={(event) => {
                if (camera !== "live" || busy || event.button !== 0) return;
                drag.current = { x: event.clientX, y: event.clientY, placement };
                event.currentTarget.setPointerCapture(event.pointerId);
              }} onPointerMove={moveCharacter} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
              <img src={lookUrl} alt="Character dressed in your styled outfit" draggable={false} data-testid="photoshoot-look" />
            </div>}
          {lookState === "empty" && <div className="photoshoot-empty"><p>Your outfit is waiting ✧</p><Link href="/play">Style outfit now ↗</Link></div>}
          {lookState === "loading" && <p className="photoshoot-loading">Preparing your outfit…</p>}
          {camera === "live" && <span className="photoshoot-live" aria-hidden="true">● LIVE</span>}
        </div>
      </div>
    </main>
  );
}
