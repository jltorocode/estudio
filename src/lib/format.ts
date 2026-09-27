const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s: string) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

/** Formato en línea del contenido: `código`, **negrita**, *cursiva* y enlaces. Devuelve HTML seguro. */
export function fmt(text: string): string {
  return String(text ?? "")
    .split("`")
    .map((part, i) => {
      if (i % 2) return `<code>${esc(part)}</code>`;
      return esc(part)
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<em>$2</em>")
        .replace(/(https?:\/\/[^\s<)]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    })
    .join("");
}

export const plain = (t: string) => String(t ?? "").replace(/[`*]/g, "");

export const pad2 = (n: number) => String(n).padStart(2, "0");

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Datos de un dominio/nivel del curso y su clase de color (dom-0, dom-1…; "extra" siempre ámbar). */
export function domainOf(course: { domains: { id: string; name: string; short?: string; weight: string }[] }, id: string) {
  const i = course.domains.findIndex((d) => d.id === id);
  const d = course.domains[i];
  return { label: d?.short || d?.name || id, name: d?.name || id, weight: d?.weight || "", cls: `dom-${Math.max(0, i)}${id === "extra" ? " extra" : ""}` };
}

/** Como fmt, pero admite párrafos y bloques de código con ``` (preguntas, enunciados, explicaciones). */
export function fmtBlock(text: string): string {
  const parts = String(text ?? "").split(/```([\w+-]*)[ \t]*\n?([\s\S]*?)```/);
  let html = "";
  for (let i = 0; i < parts.length; i += 3) {
    const t = parts[i];
    if (t && t.trim()) html += t.trim().split(/\n{2,}/).map((par) => `<p>${fmt(par).replace(/\n/g, "<br>")}</p>`).join("");
    if (i + 2 < parts.length) html += `<pre class="qcode"><code>${esc(parts[i + 2].replace(/\n$/, ""))}</code></pre>`;
  }
  return html;
}

export const levelLabel = (l: string) => ({ facil: "Fácil", medio: "Medio", dificil: "Difícil", proyecto: "Proyecto" } as Record<string, string>)[l] || l;
