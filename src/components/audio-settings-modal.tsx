"use client";

import { useEffect, useState } from "react";
import {
  getAudioSettings,
  updateAudioSettings,
  subscribeAudioSettings,
  type AudioSettings,
} from "@/lib/audio-manager";
import { playSound } from "@/lib/sound-effects";

interface AudioSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function AudioSettingsModal({ open, onClose }: AudioSettingsModalProps) {
  const [settings, setSettings] = useState<AudioSettings>(() => getAudioSettings());

  useEffect(() => {
    setSettings(getAudioSettings());
    return subscribeAudioSettings(setSettings);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        playSound("panelClose");
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const isMuted = settings.masterVolume === 0;

  return (
    <div
      className="audio-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          playSound("panelClose");
          onClose();
        }
      }}
    >
      <div
        className="audio-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audio-settings-title"
      >
        {/* Header */}
        <div className="audio-modal-header">
          <div className="audio-modal-title-wrap">
            <svg className="audio-modal-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <h2 id="audio-settings-title">Audio Settings</h2>
          </div>
          <button
            type="button"
            className="audio-modal-close"
            onClick={() => {
              playSound("panelClose");
              onClose();
            }}
            aria-label="Close sound settings"
            data-testid="audio-modal-close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body content */}
        <div className="audio-modal-body">
          {/* Master Volume (reduces ALL sounds) */}
          <div className="audio-setting-section master-section">
            <div className="audio-setting-row">
              <div className="audio-setting-info">
                <span className="audio-section-icon" aria-hidden="true">
                  {isMuted ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <line x1="23" y1="9" x2="17" y2="15" />
                      <line x1="17" y1="9" x2="23" y2="15" />
                    </svg>
                  ) : settings.masterVolume > 50 ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </svg>
                  )}
                </span>
                <div>
                  <span className="audio-setting-name">Overall Volume</span>
                  <span className="audio-setting-desc">Master level for all sounds</span>
                </div>
              </div>

              <button
                type="button"
                className="audio-mute-btn"
                onClick={() => {
                  updateAudioSettings({ masterVolume: isMuted ? 100 : 0 });
                  playSound("tap");
                }}
                title={isMuted ? "Unmute all" : "Mute all"}
                aria-label={isMuted ? "Unmute all" : "Mute all"}
              >
                {isMuted ? "Unmute" : "Mute"}
              </button>
            </div>

            {/* Master volume slider */}
            <div className="audio-slider-wrap">
              <span className="audio-slider-level" aria-hidden="true">
                {settings.masterVolume}%
              </span>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={settings.masterVolume}
                onChange={(e) => {
                  updateAudioSettings({ masterVolume: Number(e.target.value) });
                }}
                onPointerUp={() => playSound("tap")}
                onKeyUp={() => playSound("tap")}
                className="audio-range-slider master-slider"
                aria-label="Master volume level"
                data-testid="master-volume-slider"
              />
            </div>
          </div>

          {/* Background Music (BGM) */}
          <div className="audio-setting-section">
            <div className="audio-setting-row">
              <div className="audio-setting-info">
                <span className="audio-section-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                </span>
                <div>
                  <span className="audio-setting-name">Music</span>
                  <span className="audio-setting-desc">Background melody</span>
                </div>
              </div>

              {/* Toggle switch */}
              <label className="audio-toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.bgmEnabled}
                  onChange={(e) => {
                    updateAudioSettings({ bgmEnabled: e.target.checked });
                    playSound("tap");
                  }}
                  data-testid="bgm-toggle"
                  aria-label="Toggle background music"
                />
                <span className="audio-toggle-slider" />
              </label>
            </div>

            {/* Volume slider */}
            <div className={`audio-slider-wrap ${!settings.bgmEnabled ? "is-disabled" : ""}`}>
              <span className="audio-slider-level" aria-hidden="true">
                {settings.bgmEnabled ? `${settings.bgmVolume}%` : "Off"}
              </span>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={settings.bgmVolume}
                disabled={!settings.bgmEnabled}
                onChange={(e) => {
                  updateAudioSettings({ bgmVolume: Number(e.target.value) });
                }}
                className="audio-range-slider"
                aria-label="Background music volume"
                data-testid="bgm-volume-slider"
              />
            </div>
          </div>

          {/* Sound Effects (SFX) */}
          <div className="audio-setting-section">
            <div className="audio-setting-row">
              <div className="audio-setting-info">
                <span className="audio-section-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 10s3-3 3-8" />
                    <path d="M22 10s-3-3-3-8" />
                    <path d="M10 2c1 2 2 5 2 7s-1 5-2 7" />
                    <path d="M14 2c-1 2-2 5-2 7s1 5 2 7" />
                    <circle cx="12" cy="18" r="3" />
                  </svg>
                </span>
                <div>
                  <span className="audio-setting-name">Sound Effects</span>
                  <span className="audio-setting-desc">Clicks & dress-up sparkles</span>
                </div>
              </div>

              {/* Toggle switch */}
              <label className="audio-toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.sfxEnabled}
                  onChange={(e) => {
                    updateAudioSettings({ sfxEnabled: e.target.checked });
                    if (e.target.checked) playSound("tap");
                  }}
                  data-testid="sfx-toggle"
                  aria-label="Toggle sound effects"
                />
                <span className="audio-toggle-slider" />
              </label>
            </div>

            {/* Volume slider (No preview button as requested) */}
            <div className={`audio-slider-wrap ${!settings.sfxEnabled ? "is-disabled" : ""}`}>
              <span className="audio-slider-level" aria-hidden="true">
                {settings.sfxEnabled ? `${settings.sfxVolume}%` : "Off"}
              </span>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={settings.sfxVolume}
                disabled={!settings.sfxEnabled}
                onChange={(e) => {
                  updateAudioSettings({ sfxVolume: Number(e.target.value) });
                }}
                onPointerUp={() => playSound("tap")}
                onKeyUp={() => playSound("tap")}
                className="audio-range-slider"
                aria-label="Sound effects volume"
                data-testid="sfx-volume-slider"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="audio-modal-footer">
          <button
            type="button"
            className="audio-done-btn"
            onClick={() => {
              playSound("panelClose");
              onClose();
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
