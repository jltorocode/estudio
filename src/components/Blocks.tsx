import type { Block } from "@/lib/types";
import { fmt } from "@/lib/format";
import CodeBlock from "./CodeBlock";
import { DialogBlock, PatternBlock, PhrasesBlock, TextBlock, WordsBlock } from "./EnBlocks";
import Mermaid from "./Mermaid";
import GitDemo from "./GitDemo";
import PgDemo from "./PgDemo";
import PgSessions from "./PgSessions";
import RunnableCode from "./RunnableCode";

const H = ({ html, as: Tag = "span" }: { html: string; as?: "span" | "p" | "div" | "h3" | "li" | "td" | "th" | "b" }) => (
  <Tag dangerouslySetInnerHTML={{ __html: fmt(html) }} />
);

const LABEL = { exam: "En el examen", tip: "Truco", warn: "Ojo" } as const;

type Ctx = { course: string; section: string; lesson: string };

export function BlockView({ b, ctx, index = 0 }: { b: Block; ctx?: Ctx; index?: number }) {
  switch (b.type) {
    case "p": return <H as="p" html={b.text} />;
    case "h": return <H as="h3" html={b.text} />;
    case "list": {
      const items = b.items.map((it, i) => <H key={i} as="li" html={it} />);
      return b.ordered ? <ol>{items}</ol> : <ul>{items}</ul>;
    }
    case "table":
      return (
        <div className="table-wrap">
          <table>
            <thead><tr>{b.head.map((h, i) => <H key={i} as="th" html={h} />)}</tr></thead>
            <tbody>{b.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <H key={j} as="td" html={c} />)}</tr>)}</tbody>
          </table>
        </div>
      );
    case "diagram":
      return (
        <figure className="diagram">
          {b.title && <div className="dtitle" dangerouslySetInnerHTML={{ __html: fmt(b.title) }} />}
          <Mermaid code={b.mermaid} />
          {b.caption && <figcaption dangerouslySetInnerHTML={{ __html: fmt(b.caption) }} />}
        </figure>
      );
    case "code":
      if (b.run && b.lang === "bash" && ctx) return <GitDemo code={b.code} caption={b.caption ? fmt(b.caption) : undefined} ids={{ ...ctx, block: index }} />;
      if (b.run && b.lang === "sql" && ctx) return <PgDemo code={b.code} caption={b.caption ? fmt(b.caption) : undefined} scenario={{ key: `${ctx.course}/${ctx.lesson}-b${index}`, dataset: b.dataset, database: b.database || b.dataset || "postgres", setup: b.setup || "", extra: b.extra }} />;
      return b.run && b.lang === "python"
        ? <RunnableCode code={b.code} stdin={b.stdin} caption={b.caption ? fmt(b.caption) : undefined} />
        : <CodeBlock code={b.code} lang={b.lang} caption={b.caption ? fmt(b.caption) : undefined} />;
    case "callout":
      return (
        <div className={"callout " + b.variant}>
          <span className="lbl">{LABEL[b.variant] || "Nota"}</span>
          <H as="div" html={b.text} />
        </div>
      );
    case "terms":
      return (
        <div className="terms">
          {b.items.map((t, i) => (
            <div className="term" key={i}>
              <H as="b" html={t.term} />
              {t.en && t.en !== t.term && <span className="en">{t.en}</span>}
              <div className="muted" dangerouslySetInnerHTML={{ __html: fmt(t.def) }} />
            </div>
          ))}
        </div>
      );
    // Curso de inglés
    case "words": return <WordsBlock title={b.title} items={b.items} />;
    case "phrases": return <PhrasesBlock title={b.title} items={b.items} />;
    case "dialog": return <DialogBlock title={b.title} lines={b.lines} caption={b.caption} />;
    case "pattern": return <PatternBlock title={b.title} slots={b.slots} rows={b.rows} es={b.es} caption={b.caption} />;
    case "text": return <TextBlock {...b} />;
    case "sessions": return <PgSessions b={b} />;
  }
}

export default function Blocks({ blocks, ctx }: { blocks: Block[]; ctx?: Ctx }) {
  return <div className="prose">{blocks.map((b, i) => <BlockView key={i} b={b} ctx={ctx} index={i} />)}</div>;
}
