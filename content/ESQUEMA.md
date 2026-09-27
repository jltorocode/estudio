# Esquema de contenido de un curso

Cada sección de un curso es un archivo JS en `courses/<courseId>/sNN.js` con UNA llamada:

```js
STUDY.section("ai-901", {
  id: "s03",                 // igual que el nombre del archivo
  order: 3,
  title: "Título corto de la sección",
  domain: "concepts",        // "concepts" (Identificar conceptos, 40–45%) | "implement" (Implementar con Foundry, 55–60%) | "extra"
  summary: "2–3 frases: qué aprendes y por qué importa en el examen.",
  objectives: ["Objetivo oficial del temario, en español (con el texto en inglés entre paréntesis)"],
  lessons: [
    {
      id: "s03-l1",
      title: "Título de la lección",
      minutes: 12,
      blocks: [
        { type: "p", text: "Párrafo. Admite **negrita**, `código` y *cursiva*." },
        { type: "h", text: "Subtítulo dentro de la lección" },
        { type: "list", items: ["punto 1", "punto 2"], ordered: false },
        { type: "table", head: ["Col A", "Col B"], rows: [["a", "b"]] },
        { type: "diagram", title: "Qué muestra", mermaid: "flowchart LR\n  A[\"Entrada\"] --> B[\"Modelo\"]" , caption: "opcional" },
        { type: "code", lang: "python", code: "print('hola')", caption: "opcional" },
        { type: "callout", variant: "exam", text: "Lo que el examen suele preguntar sobre esto." },
        { type: "callout", variant: "tip", text: "Truco para recordarlo." },
        { type: "callout", variant: "warn", text: "Error típico / trampa." },
        { type: "terms", items: [{ term: "Token", en: "Token", def: "Definición breve" }] }
      ]
    }
  ],
  flashcards: [ { front: "Pregunta/concepto", back: "Respuesta corta" } ],
  labs: [
    {
      id: "s03-lab1",
      title: "Nombre de la práctica",
      goal: "Qué vas a construir o comprobar",
      minutes: 30,
      cost: "Gratis / céntimos / requiere suscripción Azure",
      prereqs: ["Suscripción de Azure", "Python 3.10+"],
      steps: [
        { title: "Paso", detail: "Qué hacer, dónde hacer clic (nombres de menús en inglés tal como aparecen en el portal).", code: "opcional", lang: "bash|python|json" }
      ],
      verify: ["Cómo sabes que funcionó"],
      cleanup: "Cómo borrar recursos para no pagar",
      challenge: "Reto opcional para ir más allá"
    }
  ],
  quiz: [
    { id: "s03-q1", type: "single", q: "Enunciado", options: ["A", "B", "C", "D"], answer: [1], explain: "Por qué B es correcta y por qué las otras no." },
    { id: "s03-q2", type: "multi",  q: "Enunciado (Selecciona DOS.)", options: ["A","B","C","D","E"], answer: [0, 3], explain: "..." },
    { id: "s03-q3", type: "yesno",  q: "Para cada afirmación, indica Sí o No.", statements: [ { text: "Afirmación", answer: true }, { text: "Otra", answer: false } ], explain: "..." }
  ],
  sources: [ { title: "Nombre de la página", url: "https://learn.microsoft.com/..." } ]
});
```

## Reglas
- Idioma: español neutro. Términos técnicos y nombres de servicios/menús en inglés tal como aparecen en Azure/examen (p. ej. "Speech to text", "Content Understanding", "Prompt agent"). La primera vez que aparezca un término, da su equivalente.
- Formato inline permitido en cualquier texto: `**negrita**`, `*cursiva*`, `` `código` ``. Nada de HTML.
- `answer` usa índices base 0 de `options`.
- Diagramas Mermaid: usa solo `flowchart`, `sequenceDiagram`, `mindmap`, `timeline` o `classDiagram`. Pon SIEMPRE las etiquetas de nodos entre comillas dobles (`A["Texto (con paréntesis)"]`). No uses `%%{init}%%`, ni estilos/colores (`style`, `classDef`), el tema lo pone la plataforma. Evita `;` dentro de etiquetas. En sequenceDiagram no uses comillas en los mensajes; evita `:` extra y `;` en el texto del mensaje.
- Cada pregunta de quiz debe tener `explain` que justifique la correcta Y descarte las incorrectas.
- Nada inventado: si una API, nombre de analizador, método o característica no lo puedes confirmar en documentación oficial actual (2026), no lo pongas.
- Valida tu archivo con: `node /Users/jltorocode/Documents/code/IA/plataforma-estudio/tools/check.js <ruta-del-archivo>` hasta que diga OK.
- Valida también los diagramas con: `node /Users/jltorocode/Documents/code/IA/plataforma-estudio/tools/mmd.mjs <ruta-del-archivo>` hasta que diga "Mermaid OK".
