"use client";

import { useEffect, useRef } from "react";
import { EditorView, basicSetup, minimalSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { indentUnit, HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { python } from "@codemirror/lang-python";
import { sql, PostgreSQL } from "@codemirror/lang-sql";
import { tags as t } from "@lezer/highlight";

// Colores de sintaxis a juego con los bloques de código del cuaderno (fondo siempre oscuro)
const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.definitionKeyword, t.moduleKeyword], color: "#8EC0EA" },
  { tag: [t.string, t.special(t.string)], color: "#B5DB8E" },
  { tag: t.comment, color: "#6E857A", fontStyle: "italic" },
  { tag: [t.number, t.bool, t.null], color: "#FFB27F" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#FF9B6E" },
  { tag: [t.className, t.definition(t.className)], color: "#F2CC8F" },
  { tag: [t.self, t.special(t.variableName)], color: "#C9A7E8" },
  { tag: t.operator, color: "#DCE6E0" },
  { tag: t.propertyName, color: "#DCE6E0" }
]);

const theme = EditorView.theme(
  {
    "&": { backgroundColor: "var(--code-bg)", color: "var(--code-ink)", fontSize: "14px", borderRadius: "6px" },
    ".cm-content": { fontFamily: "var(--mono)", padding: "10px 0", caretColor: "#FF7440" },
    ".cm-gutters": { backgroundColor: "var(--code-bg)", color: "#5C6F66", border: "none" },
    ".cm-activeLine": { backgroundColor: "rgba(255,255,255,.04)" },
    ".cm-activeLineGutter": { backgroundColor: "rgba(255,255,255,.06)", color: "#9DB3A8" },
    "&.cm-focused": { outline: "2px solid #FF7440", outlineOffset: "1px" },
    "&.cm-focused .cm-cursor": { borderLeftColor: "#FF7440", borderLeftWidth: "2px" },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": { backgroundColor: "rgba(255,116,64,.28) !important" },
    ".cm-matchingBracket": { backgroundColor: "rgba(255,255,255,.12)", outline: "none" },
    ".cm-tooltip": { backgroundColor: "#15231E", color: "#DCE6E0", border: "1px solid #2A3D35" },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "#FF7440", color: "#1B0A03" },
    ".cm-scroller": { lineHeight: "1.6" }
  },
  { dark: true }
);

type Props = {
  value: string;
  onChange?: (v: string) => void;
  onRun?: () => void;
  onTest?: () => void;
  minHeight?: number;
  maxHeight?: number;
  label?: string;
  /** "python" (por defecto), "sql" (dialecto PostgreSQL) o "text" para archivos de texto (mensajes de commit, rebase -i…). */
  language?: "python" | "sql" | "text";
};

export default function CodeEditor({ value, onChange, onRun, onTest, minHeight = 120, maxHeight = 560, label = "Editor de código Python", language = "python" }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const cb = useRef({ onChange, onRun, onTest });
  useEffect(() => { cb.current = { onChange, onRun, onTest }; });

  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          // En texto (mensajes de commit, rebase -i) nada de autocompletado: Enter siempre es un salto de línea
          ...(language === "python" ? [basicSetup, python()] : language === "sql" ? [basicSetup, sql({ dialect: PostgreSQL, upperCaseKeywords: true })] : [minimalSetup, lineNumbers(), highlightActiveLine(), highlightActiveLineGutter(), EditorView.lineWrapping]),
          indentUnit.of(language === "sql" ? "  " : "    "),
          EditorState.tabSize.of(language === "sql" ? 2 : 4),
          syntaxHighlighting(highlight),
          theme,
          EditorView.theme({ ".cm-scroller": { minHeight: `${minHeight}px`, maxHeight: `${maxHeight}px` } }),
          keymap.of([
            { key: "Mod-Enter", run: () => { cb.current.onRun?.(); return true; } },
            { key: "Shift-Enter", run: () => { if (!cb.current.onTest) return false; cb.current.onTest(); return true; } },
            indentWithTab
          ]),
          EditorView.contentAttributes.of({ "aria-label": label }),
          EditorView.updateListener.of((u) => { if (u.docChanged) cb.current.onChange?.(u.state.doc.toString()); })
        ]
      })
    });
    view.current = v;
    return () => { v.destroy(); view.current = null; };
    // El editor se crea una vez; el valor externo se sincroniza en el efecto siguiente
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si el valor cambia desde fuera (reiniciar, restaurar), actualiza el documento
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  return <div ref={host} className="code-editor" />;
}
