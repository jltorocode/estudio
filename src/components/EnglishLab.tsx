"use client";

// Laboratorio de los cursos de inglés: pronunciación libre, el vocabulario del curso y repaso espaciado.
import { useEffect, useMemo, useRef, useState } from "react";
import { grade, SRS_DAYS, speechScore, srsNext, today, type DiffPart } from "@/lib/english";
import { shuffle } from "@/lib/format";
import { getPrefs, hasMic, listen, record, speak, stopSpeaking } from "@/lib/speech";
import { IconMic, IconPlay, IconSlow, IconSpeaker, IconStop, Say, VoiceSettings } from "./EnVoice";
import { pkey, useProgress } from "./ProgressProvider";

export type VocabWord = { en: string; es: string; ipa?: string; fig?: string; group: string };
type Props = { courseId: string; vocab: VocabWord[]; groups: string[]; label: string; phrases: { en: string; es: string }[] };

const TABS = [["pronunciar", "Pronunciar"], ["vocabulario", "Vocabulario"], ["repaso", "Repaso espaciado"], ["voz", "Voz y micrófono"]] as const;
type Tab = (typeof TABS)[number][0];

export default function EnglishLab(props: Props) {
  const { ready } = useProgress();
  // La pestaña recordada (el primer render no la usa: espera a que cargue el progreso)
  const [tab, setTab] = useState<Tab>(() => {
    try { const t = localStorage.getItem("cuaderno-lab-ingles") as Tab | null; if (t && TABS.some(([id]) => id === t)) return t; } catch { /* sin almacenamiento local */ }
    return "repaso";
  });
  const go = (t: Tab) => { stopSpeaking(); setTab(t); try { localStorage.setItem("cuaderno-lab-ingles", t); } catch { /* sin almacenamiento local */ } };
  if (!ready) return <div className="empty">Cargando el laboratorio…</div>;
  return (
    <>
      <div className="tabs" role="tablist">
        {TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={"tab" + (tab === id ? " active" : "")} onClick={() => go(id)}>{id === "vocabulario" ? props.label : label}</button>)}
      </div>
      {tab === "pronunciar" && <Pronounce phrases={props.phrases} />}
      {tab === "vocabulario" && <VocabBrowser {...props} />}
      {tab === "repaso" && <Review {...props} />}
      {tab === "voz" && <div className="panel stack"><VoiceSettings /><MicTest /></div>}
    </>
  );
}

/* ------------------------------- Pronunciación ------------------------------- */

function Pronounce({ phrases }: { phrases: { en: string; es: string }[] }) {
  const [text, setText] = useState("Which is the way to the post office?");
  const [es, setEs] = useState<string | null>("¿Cuál es el camino a la oficina de correos?");
  const [at, setAt] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [heard, setHeard] = useState("");
  const [score, setScore] = useState<{ pct: number; parts: DiffPart[] } | null>(null);
  const [state, setState] = useState<"idle" | "listening" | "recording">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mode = typeof window !== "undefined" ? getPrefs().recog : "off";

  const tokens = useMemo(() => {
    const out: { t: string; start: number }[] = [];
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) out.push({ t: m[0], start: m.index });
    return out;
  }, [text]);

  const play = async (slow: boolean) => {
    if (playing) { stopSpeaking(); setPlaying(false); setAt(-1); return; }
    setPlaying(true);
    await speak(text, { slow, onWord: (c) => setAt(c) });
    setPlaying(false);
    setAt(-1);
  };
  const random = () => {
    if (!phrases.length) return;
    const p = phrases[Math.floor(Math.random() * phrases.length)];
    setText(p.en); setEs(p.es); setHeard(""); setScore(null);
  };
  const recognize = async () => {
    setErr(null); setHeard(""); setScore(null); setState("listening");
    const r = listen({ local: mode === "local", onInterim: setHeard });
    stopRef.current = r.stop;
    try {
      const { text: said, alts } = await r.result;
      const best = (alts.length ? alts : [said]).map((a) => ({ a, s: speechScore(a, text) })).sort((p, q) => q.s.pct - p.s.pct)[0];
      setHeard(best.a); setScore(best.s);
    } catch (e) { setErr((e as Error).message); }
    setState("idle");
  };
  const rec = async () => {
    setErr(null);
    try {
      const r = await record(20000);
      stopRef.current = r.stop;
      setState("recording");
      const blob = await r.result;
      if (url) URL.revokeObjectURL(url);
      setUrl(URL.createObjectURL(blob));
      setTimeout(() => audioRef.current?.play().catch(() => {}), 50);
    } catch { setErr("No se pudo usar el micrófono (revisa el permiso del navegador)."); }
    setState("idle");
  };
  const activeTok = at < 0 ? -1 : tokens.findIndex((t, i) => at >= t.start && (i + 1 >= tokens.length || at < tokens[i + 1].start));

  return (
    <div className="stack">
      <div className="panel stack">
        <div className="spread">
          <span className="eyebrow">Escribe o pega cualquier texto en inglés</span>
          {phrases.length > 0 && <button className="btn small" onClick={random}>🎲 Frase del curso</button>}
        </div>
        <textarea className="lab-text" rows={3} value={text} onChange={(e) => { setText(e.target.value); setEs(null); setScore(null); setHeard(""); }} lang="en" spellCheck />
        {es && <span className="faint">{es}</span>}
        <p className="karaoke" lang="en" aria-live="off">
          {tokens.map((t, i) => <span key={i} className={i === activeTok ? "on" : ""}>{t.t} </span>)}
        </p>
        <div className="row">
          <button className="btn primary" onClick={() => play(false)}>{playing ? <><IconStop /> Detener</> : <><IconSpeaker /> Escuchar</>}</button>
          <button className="btn" onClick={() => play(true)} disabled={playing}><IconSlow /> Despacio</button>
          {mode !== "off" && (state === "listening"
            ? <button className="btn rec-on" onClick={() => stopRef.current?.()}><IconStop /> Escuchando…</button>
            : <button className="btn" onClick={recognize}><IconMic /> Decirlo y corregir</button>)}
          {typeof window !== "undefined" && hasMic() && (state === "recording"
            ? <button className="btn rec-on" onClick={() => stopRef.current?.()}><IconStop /> Grabando…</button>
            : <button className="btn" onClick={rec}><IconMic /> Grabarme</button>)}
          {url && <button className="btn small" onClick={async () => { await speak(text); setTimeout(() => audioRef.current?.play().catch(() => {}), 300); }}><IconPlay /> Modelo + mi voz</button>}
          <audio ref={audioRef} src={url || undefined} controls={!!url} className="lab-audio" />
        </div>
        {heard && (
          <div className={"heard" + (score ? (score.pct >= 80 ? " ok" : " ko") : "")}>
            <span className="faint">Te entendí:</span> <b lang="en">«{heard}»</b>
            {score && <><br /><span className="faint">Coincidencia: {score.pct} %</span> {score.parts.map((d, i) => <span key={i} className={"d-" + d.k}>{d.t} </span>)}</>}
          </div>
        )}
        {err && <p className="callout warn" style={{ margin: 0 }}><span className="lbl">Ojo</span><span>{err}</span></p>}
        {mode === "off" && <p className="faint" style={{ margin: 0 }}>Para que la plataforma corrija tu pronunciación, elige un modo de reconocimiento en la pestaña «Voz y micrófono».</p>}
      </div>
    </div>
  );
}

/* ------------------------------ Vocabulario del curso ------------------------------ */

const boxLabel = (b: number | undefined) => (b == null ? "nueva" : b >= 3 ? "dominada" : "aprendiendo");

function VocabBrowser({ courseId, vocab, groups }: Props) {
  const { p } = useProgress();
  const [q, setQ] = useState("");
  const [g, setG] = useState<string>("");
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const list = vocab.filter((w) => (!g || w.group === g) && (!q || norm(w.en).includes(norm(q)) || norm(w.es).includes(norm(q))));
  if (!vocab.length) return <div className="empty">El vocabulario aparecerá cuando estén las secciones con sus listas de palabras.</div>;
  const srs = p.srs || {};
  return (
    <div className="stack">
      <div className="panel stack" style={{ gap: 10 }}>
        <input className="search-input" placeholder="Buscar en inglés o en español…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar palabra" />
        <div className="row" style={{ gap: 6 }}>
          <button className={"btn small" + (!g ? " primary" : "")} onClick={() => setG("")}>Todas ({vocab.length})</button>
          {groups.map((x) => <button key={x} className={"btn small" + (g === x ? " primary" : "")} onClick={() => setG(x)}>{x} ({vocab.filter((w) => w.group === x).length})</button>)}
        </div>
      </div>
      <p className="faint" style={{ margin: 0 }}>{list.length} palabras. El punto indica tu estado en el repaso espaciado: gris = nueva, azul = aprendiendo, verde = dominada.</p>
      <div className="en-words">
        {list.map((w) => {
          const st = srs[pkey(courseId, "w/" + w.en.toLowerCase())];
          return (
            <div key={w.en} className="en-word">
              <div className="en-word-top">
                <b className="en-w" lang="en">{w.en}</b>
                <Say text={w.en} slow />
              </div>
              {w.ipa && <span className="en-ipa">{w.ipa}</span>}
              {w.fig && <span className="en-fig">«{w.fig}»</span>}
              <span className="en-es">{w.es}</span>
              <span className={"srs-dot " + boxLabel(st?.[0])} title={boxLabel(st?.[0])} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ Repaso espaciado ------------------------------ */

type Dir = "en-es" | "es-en";

function Review({ courseId, vocab, groups }: Props) {
  const { p, update } = useProgress();
  const srs = p.srs || {};
  const k = (w: VocabWord) => pkey(courseId, "w/" + w.en.toLowerCase());
  const day = today();
  const due = vocab.filter((w) => srs[k(w)] && srs[k(w)][1] <= day);
  const fresh = vocab.filter((w) => !srs[k(w)]);
  const learned = vocab.filter((w) => (srs[k(w)]?.[0] ?? 0) >= 3).length;
  const seen = vocab.length - fresh.length;
  const [dir, setDir] = useState<Dir>("en-es");
  const [newCount, setNewCount] = useState(10);
  const [group, setGroup] = useState("");
  const [session, setSession] = useState<VocabWord[] | null>(null);
  const [i, setI] = useState(0);
  const [stats, setStats] = useState({ ok: 0, ko: 0 });

  if (!vocab.length) return <div className="empty">El repaso espaciado se activa cuando estén las secciones con sus listas de palabras.</div>;

  const start = () => {
    const pool = fresh.filter((w) => !group || w.group === group).slice(0, newCount);
    setSession([...shuffle(due), ...pool]);
    setI(0);
    setStats({ ok: 0, ko: 0 });
  };
  const answer = (w: VocabWord, ok: boolean) => {
    update((d) => { d.srs = d.srs || {}; d.srs[k(w)] = srsNext(d.srs[k(w)], ok, day); });
    setStats((s) => (ok ? { ...s, ok: s.ok + 1 } : { ...s, ko: s.ko + 1 }));
    // lo que fallas vuelve al final de la sesión
    if (!ok && session) setSession([...session, w]);
    setI(i + 1);
  };

  if (session && i < session.length) {
    return <ReviewCard key={i} w={session[i]} dir={dir} n={i + 1} total={session.length} onAnswer={(ok) => answer(session[i], ok)} onExit={() => setSession(null)} />;
  }

  return (
    <div className="stack">
      {session && (
        <div className="panel drill-result ok" style={{ display: "flex", gap: 18, alignItems: "center" }}>
          <div className="score-ring" style={{ ["--pct" as string]: stats.ok + stats.ko ? Math.round((stats.ok / (stats.ok + stats.ko)) * 100) : 100 }}><b className="num">{stats.ok}</b><span>aciertos</span></div>
          <div><h3 style={{ margin: 0 }}>Sesión terminada</h3><p className="muted" style={{ margin: 0 }}>{stats.ko ? `${stats.ko} fallo${stats.ko > 1 ? "s" : ""}: esas palabras vuelven mañana.` : "Sin fallos. Vuelve mañana para los siguientes repasos."}</p></div>
        </div>
      )}
      <div className="srs-stats">
        <div className="panel"><b className="num">{due.length}</b><span>para repasar hoy</span></div>
        <div className="panel"><b className="num">{seen}</b><span>vistas de {vocab.length}</span></div>
        <div className="panel"><b className="num">{learned}</b><span>dominadas (caja 3+)</span></div>
        <div className="panel"><b className="num">{fresh.length}</b><span>nuevas por aprender</span></div>
      </div>
      <div className="bar good" style={{ height: 10 }}><i style={{ width: `${(learned / vocab.length) * 100}%` }} /></div>
      <div className="panel stack">
        <span className="eyebrow">Nueva sesión</span>
        <div className="row">
          <div className="seg" role="group" aria-label="Dirección">
            <button className={dir === "en-es" ? "on" : ""} onClick={() => setDir("en-es")}>Inglés → español (reconocer)</button>
            <button className={dir === "es-en" ? "on" : ""} onClick={() => setDir("es-en")}>Español → inglés (escribir)</button>
          </div>
        </div>
        <div className="row">
          <label className="row" style={{ gap: 6 }}><span className="faint">Palabras nuevas:</span>
            <select value={newCount} onChange={(e) => setNewCount(+e.target.value)}>{[0, 5, 10, 15, 20, 30].map((n) => <option key={n} value={n}>{n}</option>)}</select>
          </label>
          <label className="row" style={{ gap: 6 }}><span className="faint">Del grupo:</span>
            <select value={group} onChange={(e) => setGroup(e.target.value)}><option value="">Todos (en orden)</option>{groups.map((g) => <option key={g} value={g}>{g}</option>)}</select>
          </label>
        </div>
        <button className="btn primary" style={{ alignSelf: "flex-start" }} onClick={start} disabled={!due.length && !newCount}>
          Empezar · {due.length} repaso{due.length === 1 ? "" : "s"} + {Math.min(newCount, fresh.filter((w) => !group || w.group === group).length)} nueva{newCount === 1 ? "" : "s"}
        </button>
        <p className="faint" style={{ margin: 0 }}>
          Repetición espaciada (sistema Leitner): cada acierto pasa la palabra a la caja siguiente y la aleja en el tiempo ({SRS_DAYS.slice(1).join(", ")} días); cada fallo la devuelve a la caja 0 para repasarla hoy. Con 10 minutos diarios (unas 10 palabras nuevas al día) dominas las {vocab.length} palabras en unos {Math.max(1, Math.round(vocab.length / 10 / 30))} meses.
        </p>
      </div>
    </div>
  );
}

function ReviewCard({ w, dir, n, total, onAnswer, onExit }: { w: VocabWord; dir: Dir; n: number; total: number; onAnswer: (ok: boolean) => void; onExit: () => void }) {
  const [shown, setShown] = useState(false);
  const [v, setV] = useState("");
  const [res, setRes] = useState<{ ok: boolean; exp: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (dir === "en-es") { const t = setTimeout(() => speak(w.en), 200); return () => clearTimeout(t); }
    input.current?.focus();
  }, [dir, w.en]);
  const check = () => {
    // Se acepta la palabra con o sin «to» delante (to come = come)
    const g = grade(v.replace(/^\s*to\s+/i, ""), [w.en.replace(/^to\s+/i, "")], { lang: "en" });
    setRes({ ok: g.correct, exp: w.en });
    speak(w.en);
  };
  return (
    <div className="stack" style={{ alignItems: "center" }}>
      <div className="spread" style={{ width: "min(620px,100%)" }}>
        <span className="faint num">Tarjeta {n} de {total} · {w.group}</span>
        <button className="btn small ghost" onClick={onExit}>Terminar</button>
      </div>
      <div className="review-card panel">
        {dir === "en-es" ? (
          <>
            <b className="rc-word" lang="en">{w.en}</b>
            <div className="row" style={{ justifyContent: "center" }}><Say text={w.en} slow big /></div>
            {w.ipa && <span className="en-ipa">{w.ipa}</span>}
            {shown ? <span className="rc-es">{w.es}</span> : <button className="btn primary" onClick={() => setShown(true)} autoFocus>Mostrar significado</button>}
            {shown && (
              <div className="row" style={{ justifyContent: "center" }}>
                <button className="btn" onClick={() => onAnswer(false)}>No la sabía</button>
                <button className="btn primary" onClick={() => onAnswer(true)} autoFocus>La sabía</button>
              </div>
            )}
          </>
        ) : (
          <>
            <span className="rc-es">{w.es}</span>
            <input ref={input} className={"drill-input" + (res ? (res.ok ? " ok" : " ko") : "")} value={v} onChange={(e) => setV(e.target.value)} readOnly={!!res}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (!res && v.trim()) check(); else if (res) onAnswer(res.ok); } }}
              placeholder="En inglés…" lang="en" spellCheck={false} autoCapitalize="off" autoComplete="off" aria-label="La palabra en inglés" />
            {res && <span className={res.ok ? "good-text" : "bad-text"}>{res.ok ? "✓ Correcto" : "✗ Era"}: <b lang="en">{w.en}</b> {w.ipa && <span className="en-ipa">{w.ipa}</span>} <Say text={w.en} slow /></span>}
            {!res ? <button className="btn primary" onClick={check} disabled={!v.trim()}>Comprobar</button> : <button className="btn primary" onClick={() => onAnswer(res.ok)} autoFocus>Continuar →</button>}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Prueba del micrófono ------------------------------ */

function MicTest() {
  const [state, setState] = useState<"idle" | "rec">("idle");
  const [url, setUrl] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (typeof window !== "undefined" && !hasMic()) return <p className="faint">Este navegador no permite grabar el micrófono.</p>;
  const go = async () => {
    setErr(null);
    try {
      const r = await record(8000);
      stopRef.current = r.stop;
      setState("rec");
      const b = await r.result;
      if (url) URL.revokeObjectURL(url);
      setUrl(URL.createObjectURL(b));
    } catch { setErr("No se pudo usar el micrófono: revisa el permiso del navegador para 127.0.0.1."); }
    setState("idle");
  };
  return (
    <div className="stack" style={{ gap: 8 }}>
      <span className="eyebrow">Prueba del micrófono</span>
      <div className="row">
        {state === "rec" ? <button className="btn rec-on" onClick={() => stopRef.current?.()}><IconStop /> Grabando… (pulsa para parar)</button> : <button className="btn" onClick={go}><IconMic /> Grabar 8 segundos</button>}
        {url && <audio src={url} controls />}
      </div>
      {err && <p className="faint">{err}</p>}
      <p className="faint" style={{ margin: 0 }}>Las grabaciones se quedan en esta pestaña del navegador: no se guardan ni se envían a ningún sitio.</p>
    </div>
  );
}
