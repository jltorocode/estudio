// Transcripción IPA (inglés americano, diccionario CMU) y comprobación ortográfica.
// Uso: node scripts/ipa.mjs light working "The sky is blue"
import { enWords, ipaAll, known } from "./en-dict.mjs";

const args = process.argv.slice(2);
if (!args.length) { console.log('Uso: node scripts/ipa.mjs palabra ... "frase completa"'); process.exit(1); }
for (const a of args) {
  const ws = enWords(a);
  if (ws.length > 1) {
    const line = ws.map((w) => (ipaAll(w)[0] || `?${w}?`)).join(" ");
    console.log(`${a}\n  /${line}/`);
    const bad = ws.filter((w) => !known(w));
    if (bad.length) console.log(`  ⚠ no están en el diccionario: ${bad.join(", ")}`);
  } else for (const w of ws) {
    const all = ipaAll(w);
    console.log(all.length ? `${w}  /${all[0]}/${all.length > 1 ? "   (también: " + all.slice(1).map((x) => "/" + x + "/").join(" ") + ")" : ""}` : `${w}  ⚠ no está en el diccionario (¿falta de ortografía?)`);
  }
}
