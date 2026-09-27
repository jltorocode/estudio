"use client";

import { useEffect, useId, useRef, useState } from "react";

const cache = new Map<string, string>();
let themeKeyInited = "";

function currentDark() {
  const t = document.documentElement.getAttribute("data-theme");
  if (t) return t === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Vuelve a dibujar cuando cambia el tema (sistema o selector). */
function useThemeKey() {
  const [key, setKey] = useState("");
  useEffect(() => {
    const upd = () => setKey(currentDark() ? "d" : "l");
    upd();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", upd);
    const mo = new MutationObserver(upd);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { mq.removeEventListener("change", upd); mo.disconnect(); };
  }, []);
  return key;
}

/**
 * Mermaid lee las etiquetas como Markdown: una que empieza por «1. », «+ », «- » o «# » se toma como
 * lista o título y se dibuja «Unsupported markdown: list». Un espacio duro tras la marca lo evita sin cambiar lo que se ve.
 */
export function escapeLabelMarkdown(code: string) {
  return code.replace(/"([^"\n]*)"/g, (m, label: string) =>
    '"' + label.replace(/^(\s*)(\d{1,9}[.)]|[-+*]|#{1,6}) /, "$1$2 ") + '"'
  );
}

export default function Mermaid({ code: raw }: { code: string }) {
  const code = escapeLabelMarkdown(raw);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const themeKey = useThemeKey();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!themeKey) return;
    let alive = true;
    (async () => {
      const ck = themeKey + "|" + code;
      if (cache.has(ck)) { if (ref.current) ref.current.innerHTML = cache.get(ck)!; return; }
      const mermaid = (await import("mermaid")).default;
      if (themeKeyInited !== themeKey) {
        const cs = getComputedStyle(document.documentElement);
        const v = (n: string) => cs.getPropertyValue(n).trim();
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          darkMode: themeKey === "d",
          fontFamily: cs.getPropertyValue("--font-body") || "system-ui",
          flowchart: { htmlLabels: true, curve: "basis", useMaxWidth: true },
          themeVariables: {
            background: v("--surface"), primaryColor: v("--accent-soft"), primaryTextColor: v("--ink"), primaryBorderColor: v("--accent"),
            secondaryColor: v("--amber-soft"), secondaryTextColor: v("--ink"), secondaryBorderColor: v("--amber"),
            tertiaryColor: v("--surface-2"), tertiaryTextColor: v("--ink"), tertiaryBorderColor: v("--rule"),
            lineColor: v("--ink-3"), textColor: v("--ink"), mainBkg: v("--accent-soft"), nodeBorder: v("--accent"),
            clusterBkg: v("--surface-2"), clusterBorder: v("--rule"), edgeLabelBackground: v("--surface"), titleColor: v("--ink"),
            actorBkg: v("--accent-soft"), actorBorder: v("--accent"), actorTextColor: v("--ink"), actorLineColor: v("--ink-3"),
            signalColor: v("--ink-2"), signalTextColor: v("--ink"), labelBoxBkgColor: v("--surface-2"), labelTextColor: v("--ink"),
            noteBkgColor: v("--amber-soft"), noteTextColor: v("--ink"), noteBorderColor: v("--amber"), fontSize: "14px"
          }
        });
        themeKeyInited = themeKey;
      }
      try {
        const { svg } = await mermaid.render("m" + id + themeKey + Date.now(), code);
        cache.set(ck, svg);
        if (alive && ref.current) ref.current.innerHTML = svg;
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; };
  }, [code, id, themeKey]);

  if (failed) return <pre className="faint" style={{ whiteSpace: "pre-wrap", margin: 0, font: "13px var(--mono)" }}>{code}</pre>;
  return <div className="canvas" ref={ref}><span className="faint">Dibujando diagrama…</span></div>;
}
