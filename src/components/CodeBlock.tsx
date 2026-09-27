"use client";

import { useEffect, useRef, useState } from "react";
import hljs from "highlight.js/lib/common";

export default function CodeBlock({ code, lang, caption }: { code: string; lang?: string; caption?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [label, setLabel] = useState("Copiar");
  const l = (lang || "").toLowerCase();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (l && hljs.getLanguage(l)) {
      el.removeAttribute("data-highlighted");
      el.textContent = code;
      hljs.highlightElement(el);
    }
  }, [code, l]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setLabel("Copiado");
    } catch {
      const r = document.createRange();
      if (ref.current) r.selectNodeContents(ref.current);
      const sel = getSelection();
      sel?.removeAllRanges();
      sel?.addRange(r);
      setLabel("Seleccionado");
    }
    setTimeout(() => setLabel("Copiar"), 1500);
  };

  return (
    <div>
      <div className="codebox">
        <div className="codehead"><span>{l || "código"}</span><button className="copy" onClick={copy}>{label}</button></div>
        <pre><code ref={ref} className={l ? "language-" + l : undefined}>{code}</code></pre>
      </div>
      {caption && <div className="codecap" dangerouslySetInnerHTML={{ __html: caption }} />}
    </div>
  );
}
