"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PoolEntry, Question } from "@/lib/types";
import { fmt, fmtBlock, shuffle } from "@/lib/format";
import { pkey, useProgress } from "./ProgressProvider";
import { Say } from "./EnVoice";

type Answer = number[] | Record<number, boolean> | undefined;
type Item = PoolEntry & { perm: number[] };

const NO_SHUFFLE = /(todas las anteriores|ninguna de las anteriores|ambas|all of the above|none of the above|a y b|b y c)/i;

export function makeItems(entries: PoolEntry[]): Item[] {
  return entries.map((e) => {
    const opts = e.q.type === "yesno" ? [] : e.q.options;
    const idx = opts.map((_, i) => i);
    return { ...e, perm: opts.some((o) => NO_SHUFFLE.test(o)) ? idx : shuffle(idx) };
  });
}

export function scoreItem(q: Question, ans: Answer): number {
  if (!ans) return 0;
  if (q.type === "yesno") {
    const a = ans as Record<number, boolean>;
    return q.statements.filter((s, i) => a[i] === s.answer).length / q.statements.length;
  }
  const sel = new Set(ans as number[]);
  if (q.type === "single") return sel.size === 1 && sel.has(q.answer[0]) ? 1 : 0;
  const right = q.answer.filter((a) => sel.has(a)).length;
  const wrong = [...sel].filter((a) => !q.answer.includes(a)).length;
  return Math.max(0, (right - wrong) / q.answer.length);
}

function isAnswered(q: Question, ans: Answer) {
  if (!ans) return false;
  if (q.type === "yesno") return q.statements.every((_, i) => typeof (ans as Record<number, boolean>)[i] === "boolean");
  return (ans as number[]).length === (q.type === "multi" ? q.answer.length : 1);
}

export type Result = { pct: number; points: number; total: number; score: number; secs: number; bySec: Record<string, [number, number]> };

type Props = {
  courseId: string;
  entries: PoolEntry[];
  mode: "practice" | "exam";
  minutes?: number;
  /** Id de sección para guardar la mejor nota del test. */
  quizKey?: string;
  exam: { passScore: number; maxScore: number };
  sectionNames: Record<string, string>;
  onRestart: () => void;
  restartLabel: string;
};

export default function QuizRunner({ courseId, entries, mode, minutes, quizKey, exam, sectionNames, onRestart, restartLabel }: Props) {
  const { update } = useProgress();
  const [items] = useState(() => makeItems(entries));
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [flags, setFlags] = useState<Record<number, boolean>>({});
  const [startedAt] = useState(() => Date.now());
  const [deadline] = useState(() => (minutes ? Date.now() + minutes * 60000 : null));
  const [now, setNow] = useState(() => Date.now());
  const [result, setResult] = useState<Result | null>(null);
  const [answersAtEnd, setAnswersAtEnd] = useState<Record<number, Answer>>({});
  const [confirming, setConfirming] = useState(false);
  const [onlyWrong, setOnlyWrong] = useState(false);
  const [notice, setNotice] = useState("");

  const practice = mode === "practice";
  const it = items[idx];
  const ans = answers[idx];

  const recordWrong = useCallback((q: Question, sc: number) => {
    update((d) => {
      const k = pkey(courseId, q.id);
      if (sc < 1) d.wrong[k] = { n: (d.wrong[k]?.n || 0) + 1, at: Date.now() };
      else delete d.wrong[k];
    });
  }, [courseId, update]);

  const finish = useCallback((final: Record<number, Answer>) => {
    let points = 0;
    const bySec: Record<string, [number, number]> = {};
    const scores = items.map((x, i) => scoreItem(x.q, final[i]));
    items.forEach((x, i) => {
      points += scores[i];
      const t = x.topic;
      bySec[t] = bySec[t] || [0, 0];
      bySec[t][0] += scores[i];
      bySec[t][1] += 1;
    });
    const pct = items.length ? points / items.length : 0;
    const r: Result = { pct, points: Math.round(points * 10) / 10, total: items.length, score: Math.round(pct * exam.maxScore), secs: Math.round((Date.now() - startedAt) / 1000), bySec };
    update((d) => {
      items.forEach((x, i) => {
        const k = pkey(courseId, x.q.id);
        if (scores[i] < 1) d.wrong[k] = { n: (d.wrong[k]?.n || 0) + (practice ? 0 : 1), at: Date.now() };
        else delete d.wrong[k];
      });
      if (!practice) {
        d.exams.push({ id: "e" + Date.now(), courseId, at: Date.now(), score: r.score, pct: Math.round(pct * 100), total: r.total, passed: r.score >= exam.passScore, bySec: Object.fromEntries(Object.entries(bySec).map(([k, v]) => [k, [Math.round(v[0] * 10) / 10, v[1]]])) });
        d.exams = d.exams.slice(-100);
      } else if (quizKey) {
        const k = pkey(courseId, quizKey);
        const prev = d.quiz[k];
        const p = Math.round(pct * 100);
        d.quiz[k] = { best: Math.max(prev?.best || 0, p), last: p, attempts: (prev?.attempts || 0) + 1, at: Date.now() };
      }
    });
    setAnswersAtEnd(final);
    setResult(r);
    window.scrollTo(0, 0);
  }, [items, exam, startedAt, update, courseId, practice, quizKey]);

  // Cronómetro: al llegar a cero entrega con las respuestas que haya
  const answersRef = useRef(answers);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => {
    if (!deadline || result) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= deadline) {
        clearInterval(t);
        setNotice("Se acabó el tiempo. Examen entregado.");
        finish(answersRef.current);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [deadline, result, finish]);

  // Atajos de teclado: A–H eligen opción, flechas navegan
  const choose = useCallback((orig: number) => {
    if (practice && checked[idx]) return;
    const q = items[idx].q;
    if (q.type === "yesno") return;
    setAnswers((prev) => {
      let a = ((prev[idx] as number[]) || []).slice();
      if (q.type === "single") a = [orig];
      else if (a.includes(orig)) a = a.filter((x) => x !== orig);
      else if (a.length < q.answer.length) a.push(orig);
      else { setNotice(`Esta pregunta pide exactamente ${q.answer.length} respuestas. Quita una primero.`); return prev; }
      setNotice("");
      return { ...prev, [idx]: a };
    });
  }, [idx, items, practice, checked]);

  useEffect(() => {
    if (result) return;
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.target as HTMLElement).matches("input, textarea")) return;
      const cur = items[idx];
      if (cur.q.type !== "yesno" && /^[a-h]$/i.test(ev.key)) {
        const pos = ev.key.toLowerCase().charCodeAt(0) - 97;
        if (pos < cur.perm.length) choose(cur.perm[pos]);
      } else if (ev.key === "ArrowRight" && idx < items.length - 1) setIdx(idx + 1);
      else if (ev.key === "ArrowLeft" && idx > 0) setIdx(idx - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, items, choose, result]);

  const answeredCount = useMemo(() => items.filter((x, i) => isAnswered(x.q, answers[i])).length, [items, answers]);

  if (result) {
    const passed = result.score >= exam.passScore;
    const lines = Object.entries(result.bySec).sort((a, b) => a[1][0] / a[1][1] - b[1][0] / b[1][1]);
    const list = items.map((x, i) => ({ x, i, sc: scoreItem(x.q, answersAtEnd[i]) })).filter((r) => !onlyWrong || r.sc < 1);
    return (
      <div className="stack">
        {notice && <div className="callout warn"><span className="lbl">Aviso</span><div>{notice}</div></div>}
        <div className="panel">
          <div className="spread" style={{ alignItems: "flex-end" }}>
            <div>
              <div className="eyebrow">{practice ? "Resultado del test" : "Resultado del simulacro"}</div>
              <div className="score-big">{practice ? Math.round(result.pct * 100) : result.score}<small>{practice ? " %" : ` / ${exam.maxScore}`}</small></div>
            </div>
            <div className="stack" style={{ gap: 8, alignItems: "flex-end" }}>
              {!practice && <span className={"pill " + (passed ? "good" : "bad")}>{passed ? "Aprobado" : "No aprobado"} · se aprueba con {exam.passScore}</span>}
              <span className="faint num">{result.points} de {result.total} puntos · {Math.floor(result.secs / 60)} min {result.secs % 60} s</span>
            </div>
          </div>
          {!practice && <p className="faint" style={{ margin: "12px 0 0" }}>La puntuación es una estimación lineal sobre {exam.maxScore}. En los exámenes oficiales las notas se escalan y el peso de cada pregunta puede variar.</p>}
        </div>
        <div className="panel stack">
          <div className="eyebrow">Por sección (de peor a mejor)</div>
          <div className="breakdown">
            {lines.map(([id, [ok, n]]) => {
              const p = Math.round((ok / n) * 100);
              return (
                <div className="line" key={id}>
                  <span>{sectionNames[id] || id}</span>
                  <div className={"bar" + (p >= 70 ? " good" : "")}><i style={{ width: p + "%" }} /></div>
                  <span className="num faint">{p}%</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="row">
          <button className="btn primary" onClick={onRestart}>{restartLabel}</button>
          <button className="btn ghost" onClick={() => setOnlyWrong(!onlyWrong)}>{onlyWrong ? "Ver todas" : "Ver solo las falladas"}</button>
        </div>
        {list.length ? list.map(({ x, i }) => <QuestionCard key={i} item={x} ans={answersAtEnd[i]} reveal idx={i} total={items.length} />) : <div className="empty">No fallaste ninguna. ¡Muy bien!</div>}
      </div>
    );
  }

  const reveal = practice && !!checked[idx];
  const ready = isAnswered(it.q, ans);
  const left = deadline ? Math.max(0, deadline - now) : 0;

  const nav = (
    <div className="qnav">
      {items.map((x, i) => {
        let c = i === idx ? " current" : "";
        if (practice && checked[i]) c += scoreItem(x.q, answers[i]) >= 1 ? " right" : " wrong";
        else if (isAnswered(x.q, answers[i])) c += " answered";
        if (flags[i]) c += " flag";
        return <button key={i} className={"num" + c} onClick={() => setIdx(i)} aria-label={`Ir a la pregunta ${i + 1}`}>{i + 1}</button>;
      })}
    </div>
  );

  const submit = () => {
    const unanswered = items.length - answeredCount;
    const flagged = Object.values(flags).filter(Boolean).length;
    if (!practice && (unanswered || flagged) && !confirming) {
      setConfirming(true);
      return;
    }
    finish(answers);
  };

  const controls = (
    <div className="spread" style={{ marginTop: 16 }}>
      <button className="btn" onClick={() => setIdx(idx - 1)} disabled={idx === 0}>← Anterior</button>
      <div className="row">
        {!practice && <button className="btn ghost" onClick={() => setFlags({ ...flags, [idx]: !flags[idx] })}>{flags[idx] ? "★ Marcada para revisar" : "☆ Marcar para revisar"}</button>}
        {practice && !reveal && (
          <button className="btn primary" disabled={!ready} onClick={() => { setChecked({ ...checked, [idx]: true }); recordWrong(it.q, scoreItem(it.q, ans)); }}>Comprobar</button>
        )}
        {idx < items.length - 1
          ? <button className={"btn" + (reveal ? " primary" : "")} onClick={() => { setIdx(idx + 1); window.scrollTo(0, 0); }}>Siguiente →</button>
          : <button className="btn primary" onClick={submit}>{practice ? "Ver resultado" : "Entregar examen"}</button>}
      </div>
    </div>
  );

  const question = (
    <QuestionCard
      item={it}
      ans={ans}
      reveal={reveal}
      idx={idx}
      total={items.length}
      onChoose={choose}
      onYesNo={(i, v) => setAnswers((prev) => ({ ...prev, [idx]: { ...((prev[idx] as Record<number, boolean>) || {}), [i]: v } }))}
    />
  );

  if (!practice) {
    const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
    return (
      <div className="exam-layout">
        <div>{question}{notice && <p className="faint" role="status">{notice}</p>}{controls}</div>
        <aside className="exam-side panel">
          <div><div className="eyebrow">Tiempo restante</div><div className={"timer" + (left < 300000 ? " low" : "")}>{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</div></div>
          <div className="faint num">{answeredCount} de {items.length} respondidas</div>
          {nav}
          <button className="btn primary" onClick={submit}>{confirming ? "Confirmar entrega" : "Entregar examen"}</button>
          {confirming && <div className="faint">Te quedan <b>{items.length - answeredCount}</b> sin responder y <b>{Object.values(flags).filter(Boolean).length}</b> marcadas. Pulsa otra vez para entregar.</div>}
        </aside>
      </div>
    );
  }

  return (
    <div className="stack">
      {question}
      {notice && <p className="faint" role="status" style={{ margin: 0 }}>{notice}</p>}
      {controls}
      <details><summary className="faint" style={{ cursor: "pointer" }}>Mapa de preguntas</summary><div style={{ marginTop: 10 }}>{nav}</div></details>
    </div>
  );
}

export function QuestionCard({ item, ans, reveal, idx, total, onChoose, onYesNo }: {
  item: Item; ans: Answer; reveal: boolean; idx: number; total: number;
  onChoose?: (orig: number) => void; onYesNo?: (i: number, v: boolean) => void;
}) {
  const q = item.q;
  const need = q.type === "multi" ? `Elige ${q.answer.length}` : q.type === "yesno" ? "Sí / No por afirmación" : "Una respuesta";
  let body: React.ReactNode;
  if (q.type === "yesno") {
    const a = (ans as Record<number, boolean>) || {};
    const cls = (i: number, b: boolean) => {
      if (!reveal) return a[i] === b ? "sel" : "";
      if (q.statements[i].answer === b) return "right";
      return a[i] === b ? "wrong" : "";
    };
    body = (
      <div>
        {q.statements.map((st, i) => (
          <div className="yn" key={i}>
            <span dangerouslySetInnerHTML={{ __html: fmt(st.text) }} />
            <span className="yn-btns">
              <button className={cls(i, true)} disabled={reveal} onClick={() => onYesNo?.(i, true)}>Sí</button>
              <button className={cls(i, false)} disabled={reveal} onClick={() => onYesNo?.(i, false)}>No</button>
            </span>
          </div>
        ))}
      </div>
    );
  } else {
    const sel = new Set((ans as number[]) || []);
    body = (
      <div className="opts">
        {item.perm.map((orig, pos) => {
          let c = sel.has(orig) ? " sel" : "";
          if (reveal) c = q.answer.includes(orig) ? " right" : sel.has(orig) ? " wrong" : "";
          return (
            <button key={orig} className={"opt" + (q.type === "multi" ? " multi" : "") + c} disabled={reveal} onClick={() => onChoose?.(orig)}>
              <span className="key">{String.fromCharCode(65 + pos)}</span>
              <span dangerouslySetInnerHTML={{ __html: fmt(q.options[orig]) }} />
            </button>
          );
        })}
      </div>
    );
  }
  const sc = scoreItem(q, ans);
  return (
    <div className="q-card">
      <div className="spread"><span className="eyebrow num">Pregunta {idx + 1} de {total}</span><span className="pill">{need}</span></div>
      <div className="q-text" dangerouslySetInnerHTML={{ __html: fmtBlock(q.q) }} />
      {q.say && <div className="q-say"><Say text={q.say} slow big label="Escuchar" />{reveal && <span lang="en">«{q.say}»</span>}</div>}
      {body}
      {reveal && (
        <div className="explain">
          <div className={"verdict " + (sc >= 1 ? "ok" : "ko")}>{sc >= 1 ? "Correcta" : sc > 0 ? "Parcialmente correcta" : "Incorrecta"}</div>
          <div dangerouslySetInnerHTML={{ __html: fmtBlock(q.explain) }} />
        </div>
      )}
    </div>
  );
}
