"use client";

import Link from "next/link";
import { useState } from "react";
import { fmt, plain } from "@/lib/format";

type T = { term: string; en?: string; def: string; sec: string; lesson: string; lessonTitle: string };

export default function GlossaryClient({ courseId, terms }: { courseId: string; terms: T[] }) {
  const [f, setF] = useState("");
  const q = f.toLowerCase();
  const items = terms.filter((t) => !q || `${plain(t.term)} ${t.en || ""} ${plain(t.def)}`.toLowerCase().includes(q));
  return (
    <div className="stack">
      <div className="spread">
        <div><div className="eyebrow">{terms.length} términos</div><h1 style={{ fontSize: "clamp(48px,7vw,92px)", marginTop: 8 }}>Glosario</h1></div>
        <input className="search" style={{ maxWidth: 320 }} type="search" placeholder="Filtrar términos…" aria-label="Filtrar términos" value={f} onChange={(e) => setF(e.target.value)} />
      </div>
      <div className="terms">
        {items.length ? items.map((t) => (
          <div className="term" key={t.term + t.lesson}>
            <b dangerouslySetInnerHTML={{ __html: fmt(t.term) }} />
            {t.en && t.en !== t.term && <span className="en">{t.en}</span>}
            <div className="muted" dangerouslySetInnerHTML={{ __html: fmt(t.def) }} />
            <Link className="btn ghost small" style={{ paddingLeft: 0 }} href={`/${courseId}/${t.sec}/${t.lesson}`}>{t.lessonTitle} →</Link>
          </div>
        )) : <div className="empty">Sin resultados.</div>}
      </div>
    </div>
  );
}
