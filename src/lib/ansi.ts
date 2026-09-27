import { esc } from "./format";

const COLORS = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];

/** Convierte la salida con colores ANSI de Git (SGR) en HTML seguro con clases .a-*. */
export function ansiToHtml(raw: string): string {
  // Las barras de progreso reescriben la línea con \r: como en una terminal, queda solo el último estado
  const text = raw.replace(/\r\n/g, "\n").split("\n").map((l) => (l.includes("\r") ? l.split("\r").filter((x) => x.length).pop() ?? "" : l)).join("\n");
  let html = "";
  let open = false;
  const re = /\x1b\[([0-9;]*)m/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const state = { bold: false, dim: false, fg: "" };
  const apply = () => {
    if (open) { html += "</span>"; open = false; }
    const cls = [state.bold && "a-bold", state.dim && "a-dim", state.fg && "a-" + state.fg].filter(Boolean).join(" ");
    if (cls) { html += `<span class="${cls}">`; open = true; }
  };
  while ((m = re.exec(text))) {
    html += esc(text.slice(last, m.index));
    last = re.lastIndex;
    const codes = m[1] ? m[1].split(";").map(Number) : [0];
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i];
      if (c === 0) { state.bold = false; state.dim = false; state.fg = ""; }
      else if (c === 1) state.bold = true;
      else if (c === 2) state.dim = true;
      else if (c === 22) { state.bold = false; state.dim = false; }
      else if (c >= 30 && c <= 37) state.fg = COLORS[c - 30];
      else if (c >= 90 && c <= 97) state.fg = "b" + COLORS[c - 90];
      else if (c === 39) state.fg = "";
      else if (c === 38 && codes[i + 1] === 5) i += 2; // 256 colores: se ignora
      else if (c === 38 && codes[i + 1] === 2) i += 4;
    }
    apply();
  }
  html += esc(text.slice(last).replace(/\x1b\[[0-9;]*[A-Za-z]/g, ""));
  if (open) html += "</span>";
  return html;
}
