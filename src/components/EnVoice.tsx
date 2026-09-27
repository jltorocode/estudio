"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  defaultPrefs, englishVoices, getPrefs, hasMic, hasTTS, installLocal, onPrefs, onVoices, recogSupport, setPrefs, speak, stopSpeaking,
  type RecogSupport, type VoicePrefs
} from "@/lib/speech";

/* --------------------------------- Iconos --------------------------------- */

export const IconSpeaker = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" stroke="none" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    <path d="M18.5 5.5a9 9 0 0 1 0 13" />
  </svg>
);
export const IconSlow = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 16c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    <path d="M2 16h20" />
    <path d="M9.5 8.4 8 16M14.5 8.4 16 16" />
    <circle cx="21" cy="11.5" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);
export const IconMic = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);
export const IconPlay = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16l13-8z" fill="currentColor" /></svg>
);
export const IconStop = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" /></svg>
);

/* ------------------------------ Botón de audio ------------------------------ */

/** Botón 🔊 que lee un texto en inglés. `slow` añade el botón de velocidad lenta al lado. */
export function Say({ text, slow = false, big = false, speaker, label, autoPlay = false }: { text: string; slow?: boolean; big?: boolean; speaker?: number; label?: string; autoPlay?: boolean }) {
  const [on, setOn] = useState<"n" | "s" | null>(null);
  const play = async (mode: "n" | "s") => {
    if (on === mode) { stopSpeaking(); setOn(null); return; }
    setOn(mode);
    await speak(text, { slow: mode === "s", speaker });
    setOn((m) => (m === mode ? null : m));
  };
  const played = useRef(false);
  useEffect(() => {
    if (autoPlay && !played.current) { played.current = true; const t = setTimeout(() => play("n"), 250); return () => clearTimeout(t); }
  }, [autoPlay]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (on) stopSpeaking(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span className={"say" + (big ? " big" : "")}>
      <button type="button" className={"say-btn" + (on === "n" ? " on" : "")} onClick={() => play("n")} aria-label={`Escuchar: ${text}`} title="Escuchar">
        <IconSpeaker size={big ? 22 : 15} />{label && <span>{label}</span>}
      </button>
      {slow && (
        <button type="button" className={"say-btn slow" + (on === "s" ? " on" : "")} onClick={() => play("s")} aria-label={`Escuchar despacio: ${text}`} title="Más despacio">
          <IconSlow size={big ? 22 : 15} />
        </button>
      )}
    </span>
  );
}

/* ------------------------------ Ajustes de voz ------------------------------ */

function usePrefs(): VoicePrefs {
  return useSyncExternalStore(onPrefs, getPrefs, defaultPrefs);
}

export function useVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => onVoices(() => setVoices(englishVoices())), []);
  return voices;
}

/** Preferencias de voz y reconocimiento (también las usan los ejercicios). */
export function useVoicePrefs() { return usePrefs(); }

const SAMPLE = "Hello! This is how I sound. The weather is fine today, isn't it?";

/** Panel completo de voz: voz, velocidad, reconocimiento de voz y prueba del micrófono. */
export function VoiceSettings({ compact = false }: { compact?: boolean }) {
  const prefs = usePrefs();
  const voices = useVoices();
  const [sup, setSup] = useState<RecogSupport | null>(null);
  const [installing, setInstalling] = useState(false);
  useEffect(() => { recogSupport().then(setSup); }, []);
  const tts = typeof window !== "undefined" && hasTTS();
  const chosen = voices.find((v) => v.voiceURI === prefs.voice) || voices[0];
  const onlyBasic = voices.length > 0 && !voices.some((v) => /premium|enhanced|siri|mejorad/i.test(v.name));

  const install = async () => {
    setInstalling(true);
    await installLocal();
    setSup(await recogSupport());
    setInstalling(false);
  };

  return (
    <div className={"voice-settings" + (compact ? " compact" : "")}>
      {!tts ? (
        <p className="faint">Este navegador no puede leer en voz alta. Usa Chrome, Edge o Safari.</p>
      ) : (
        <>
          <label className="vs-row">
            <span className="eyebrow">Voz</span>
            <select value={chosen?.voiceURI || ""} onChange={(e) => setPrefs({ voice: e.target.value })}>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} · {v.lang.replace("_", "-")}{v.localService ? "" : " · en línea"}
                </option>
              ))}
            </select>
          </label>
          <label className="vs-row">
            <span className="eyebrow">Velocidad · {prefs.rate.toFixed(2)}×</span>
            <input type="range" min={0.6} max={1.3} step={0.05} value={prefs.rate} onChange={(e) => setPrefs({ rate: +e.target.value })} />
          </label>
          <div className="row">
            <button type="button" className="btn small" onClick={() => speak(SAMPLE)}><IconSpeaker /> Probar la voz</button>
            <button type="button" className="btn small ghost" onClick={() => speak(SAMPLE, { slow: true })}><IconSlow /> Despacio</button>
          </div>
          {onlyBasic && !compact && (
            <p className="faint vs-tip">
              Para una voz mucho más natural, descarga una voz «Premium» o «Mejorada» en inglés: <b>Ajustes del Sistema → Accesibilidad → Contenido leído → Voz del sistema → Gestionar voces…</b> (por ejemplo, Ava, Zoe o Evan en inglés de EE. UU.). Luego vuelve a abrir el navegador y elígela aquí.
            </p>
          )}
        </>
      )}

      <fieldset className="vs-recog">
        <legend className="eyebrow">Corrección de tu pronunciación</legend>
        <label className="check-line">
          <input type="radio" name="recog" checked={prefs.recog === "off"} onChange={() => setPrefs({ recog: "off" })} />
          <span><b>Me grabo y me comparo</b> <span className="faint">— tu voz se graba solo en este equipo y la escuchas junto al modelo.</span></span>
        </label>
        <label className={"check-line" + (sup && sup.api && sup.local !== "unavailable" ? "" : " disabled")}>
          <input type="radio" name="recog" disabled={!sup || !sup.api || sup.local === "unavailable"} checked={prefs.recog === "local"} onChange={() => setPrefs({ recog: "local" })} />
          <span>
            <b>Reconocimiento en este equipo</b>{" "}
            <span className="faint">
              — el navegador transcribe lo que dices sin enviar el audio.{" "}
              {!sup ? "Comprobando…" : !sup.api ? "Este navegador no lo tiene." : sup.local === "available" ? "Listo." : sup.local === "downloadable" ? "Hay que descargar el paquete de inglés (una vez)." : sup.local === "downloading" ? "Descargando…" : sup.local === "unknown" ? "Este navegador no permite exigir que sea local." : "No disponible en este navegador."}
            </span>
            {sup?.local === "downloadable" && <button type="button" className="btn small" style={{ marginLeft: 8 }} disabled={installing} onClick={install}>{installing ? "Descargando…" : "Descargar inglés"}</button>}
          </span>
        </label>
        <label className={"check-line" + (sup?.api ? "" : " disabled")}>
          <input type="radio" name="recog" disabled={!sup?.api} checked={prefs.recog === "online"} onChange={() => setPrefs({ recog: "online" })} />
          <span><b>Reconocimiento en línea</b> <span className="faint">— más preciso, pero el navegador envía el audio de cada intento a su servicio de voz (Google en Chrome, Apple en Safari).</span></span>
        </label>
        {!compact && typeof window !== "undefined" && !hasMic() && <p className="faint">No se detecta micrófono o este navegador no permite grabar.</p>}
      </fieldset>
    </div>
  );
}

/** Botón «Voz» con el panel de ajustes desplegable (para cabeceras de bloques y ejercicios). */
export function VoiceMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [open]);
  return (
    <div className="voice-menu" ref={ref}>
      <button type="button" className="btn small ghost" aria-expanded={open} onClick={() => setOpen(!open)} title="Voz, velocidad y micrófono">
        <IconSpeaker /> Voz
      </button>
      {open && <div className="voice-pop panel"><VoiceSettings compact /></div>}
    </div>
  );
}
