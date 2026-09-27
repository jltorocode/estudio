"use client";

import { useState } from "react";
import { fmt, shuffle } from "@/lib/format";
import { useProgress } from "./ProgressProvider";
import { Say } from "./EnVoice";

/** `say`: texto en inglés que se puede escuchar (curso de inglés). */
export type Card = { k: string; front: string; back: string; secTitle?: string; say?: string };

export default function Deck({ cards }: { cards: Card[] }) {
  const { ready } = useProgress();
  if (!cards.length) return <div className="empty">No hay tarjetas.</div>;
  if (!ready) return <div className="empty">Barajando…</div>;
  return <DeckInner cards={cards} />;
}

function DeckInner({ cards }: { cards: Card[] }) {
  const { p, update } = useProgress();
  const pick = (onlyPending: boolean) => {
    const pend = cards.filter((c) => p.cards[c.k] !== "known");
    return shuffle(onlyPending && pend.length ? pend : cards);
  };
  const [order, setOrder] = useState<Card[]>(() => pick(true));
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const start = (onlyPending: boolean) => {
    setOrder(pick(onlyPending));
    setI(0);
    setFlipped(false);
  };
  const known = cards.filter((c) => p.cards[c.k] === "known").length;

  if (i >= order.length) {
    return (
      <div className="flash-stage">
        <div className="panel" style={{ textAlign: "center", maxWidth: 520 }}>
          <h3>Ronda terminada</h3>
          <p className="muted">Te sabes {known} de {cards.length} tarjetas.</p>
          <div className="row" style={{ justifyContent: "center" }}>
            <button className="btn primary" onClick={() => start(true)}>Repasar las pendientes</button>
            <button className="btn" onClick={() => start(false)}>Repasar todas</button>
          </div>
        </div>
      </div>
    );
  }
  const card = order[i];
  const mark = (v: "known" | "again") => {
    update((d) => { d.cards[card.k] = v; });
    setI(i + 1);
    setFlipped(false);
  };
  return (
    <div className="flash-stage">
      <div className="spread" style={{ width: "min(620px,100%)" }}>
        <span className="faint num">Tarjeta {i + 1} de {order.length}{card.secTitle ? " · " + card.secTitle : ""}</span>
        <span className="faint num">Sabidas: {known}/{cards.length}</span>
      </div>
      <button className={"flash" + (flipped ? " flipped" : "")} onClick={() => setFlipped(!flipped)} aria-label="Girar tarjeta">
        <div className="flash-inner">
          <div className="flash-face"><span className="eyebrow">Pregunta</span><div dangerouslySetInnerHTML={{ __html: fmt(card.front) }} /></div>
          <div className="flash-face back"><span className="eyebrow">Respuesta</span><div dangerouslySetInnerHTML={{ __html: fmt(card.back) }} /></div>
        </div>
      </button>
      <div className="row" style={{ justifyContent: "center" }}>
        {card.say && <Say key={card.k} text={card.say} slow label="Escuchar" />}
        {flipped ? (
          <>
            <button className="btn" onClick={() => mark("again")}>Repasar otra vez</button>
            <button className="btn primary" onClick={() => mark("known")}>La sé</button>
          </>
        ) : (
          <button className="btn primary" onClick={() => setFlipped(true)}>Mostrar respuesta</button>
        )}
      </div>
      <span className="faint">Consejo: intenta responder en voz alta antes de girarla.</span>
    </div>
  );
}
