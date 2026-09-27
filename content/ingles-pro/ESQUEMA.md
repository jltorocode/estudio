# Inglés Pro (A2 → C2): formato de una sección

Cada sección es un archivo `content/ingles-pro/sNN.json`. Lee también `content/ingles-pro/PLAN.md` (el alumno, el método, el alcance de TU sección y las reglas de calidad) antes de escribir.

- **Explicaciones en español neutro.** El alumno es chileno: nada de voseo ni jerga de España; se dice «ustedes», no «vosotros», y «computador», «auto», «celular». Cuando convenga, el vocabulario chileno sirve de ejemplo.
- **Todo el inglés va en inglés correcto y natural** y la plataforma lo **lee en voz alta** con la síntesis de voz del sistema, en inglés americano. Esto incluye palabras, frases, diálogos, patrones, lecturas, `say`, respuestas y modelos.
- **El inglés pasa por un corrector ortográfico** (diccionario CMU). Una falta de ortografía en inglés rompe la validación. La grafía es americana (*color*, *center*, *organize*); la británica se menciona en notas.

```jsonc
{
  "id": "s04", "order": 4,
  "title": "Experiencias: el present perfect",
  "domain": "b1",                     // "a2" | "b1" | "b2" | "c1" | "c2" | "extra"
  "summary": "2–3 frases: qué vas a poder HACER en inglés al terminar (hablar de…, entender…, escribir…).",
  "goal": "Meta de la sección en UNA frase medible (≤ 35 palabras), en términos de lo que el alumno hace.",
  "objectives": ["5–8 resultados con verbo observable en infinitivo: contar, preguntar, distinguir, escribir, pronunciar…"],
  "lessons": [
    {
      "id": "s04-l1", "title": "…", "minutes": 25,
      "goals": ["2–4 objetivos observables (nunca entender/conocer/saber/comprender/aprender)"],
      "takeaways": ["3–6 ideas esenciales, cortas y precisas"],
      "blocks": [ /* ver «Bloques» */ ]
    }
  ],
  "exercises": [ /* ver «Ejercicios» */ ],
  "labs": [],
  "flashcards": [{ "front": "¿Alguna vez has estado en Londres?", "back": "Have you ever been to London?", "say": "Have you ever been to London?" }],
  "quiz": [ /* ver «Test» */ ],
  "sources": [
    { "title": "Cambridge Dictionary — Grammar: Present perfect", "url": "https://dictionary.cambridge.org/grammar/british-grammar/present-perfect-simple-i-have-worked" },
    { "title": "British Council LearnEnglish — Present perfect", "url": "https://learnenglish.britishcouncil.org/grammar/b1-b2-grammar/present-perfect" }
  ],
  "allow": ["Valparaíso"]            // opcional: nombres propios que el diccionario no conoce (solo con mayúscula)
}
```

## Bloques de una lección

**Bloques generales**
- `p`, `h` y `list`.
- `table` (`head` + `rows`, todas las filas con el mismo nº de columnas).
- `diagram` (Mermaid, ver abajo).
- `callout` (`tip` = Truco, `warn` = Ojo, `exam` = «En el examen»).
- `terms`: términos de gramática para el glosario, `[{ "term", "en"?, "def" }]`.

**Texto en línea**
- Se usa `**negrita**`, `*cursiva*` y `` `código` ``.
- Dentro de un párrafo en español, el inglés va en *cursiva*: «el verbo *get* tiene muchos usos».

**Bloques propios del curso**, **todos con audio**: el alumno pulsa 🔊 en cada elemento o «Escuchar todo».

```jsonc
// Vocabulario: palabra o expresión, traducción, IPA y nota opcional (uso, colocaciones, falso amigo, registro).
{ "type": "words", "title": "El trabajo: verbos y colocaciones", "items": [
  { "en": "Deadline", "es": "Plazo, fecha límite", "ipa": "/ˈdɛdˌlaɪn/", "note": "*meet a deadline* = cumplir un plazo; *miss a deadline* = no cumplirlo." },
  { "en": "Actually", "es": "En realidad, de hecho", "ipa": "/ˈæktʃuəli/", "note": "Falso amigo: «actualmente» es *currently* / *nowadays*." }
]}
// ipa: inglés americano del diccionario CMU. NO la escribas a mano: ejecuta el validador con --fix-ipa y se rellena sola.
//   - Si una entrada es una expresión de varias palabras, la IPA es la de cada palabra seguida («/meɪk ə ˈdɪsɪʒən/»).
//   - Si una palabra tiene varias pronunciaciones (record sustantivo/verbo), el validador acepta cualquiera del
//     diccionario; elige la que corresponda. `node scripts/ipa.mjs palabra` las muestra.
// Sin campo "fig" (eso era del libro de Ghio).

// Frases de ejemplo inglés ↔ español (el alumno puede tapar una columna para autoevaluarse).
{ "type": "phrases", "title": "Experiencias con ever y never", "items": [
  { "en": "Have you ever eaten sushi?", "es": "¿Alguna vez has comido sushi?" },
  { "en": "I've never been to Europe.", "es": "Nunca he estado en Europa.", "note": "*been to* = haber ido y vuelto." }
]}

// Diálogo con 2–4 personajes (voces distintas cuando el sistema tiene varias; el alumno puede hacer un papel).
{ "type": "dialog", "title": "Una entrevista de trabajo", "caption": "opcional", "lines": [
  { "who": "Interviewer", "en": "Have you ever worked in a team?", "es": "¿Has trabajado alguna vez en equipo?" },
  { "who": "Camila", "en": "Yes, I have. I've worked in software teams for three years.", "es": "Sí. He trabajado en equipos de software durante tres años." }
]}

// Patrón de frase: la estructura como tabla de colores (una columna por función). Es el «diagrama» de la gramática.
{ "type": "pattern", "title": "Present perfect: afirmación", "slots": ["Sujeto", "have / has", "Participio", "Complemento"],
  "rows": [["I", "have", "finished", "the report"], ["She", "has", "been", "to Peru twice"]],
  "es": ["Terminé / He terminado el informe", "Ha estado en Perú dos veces"], "caption": "opcional" }
// rows: tantas celdas como slots; una celda puede ir vacía ("").

// NUEVO — Lectura o audición larga, por párrafos, cada uno con audio y su traducción (tapada hasta que el alumno la pide).
{ "type": "text", "kind": "read",            // "read" = lectura (se ve el texto) | "listen" = audición (texto oculto al principio)
  "title": "The day I missed my flight", "level": "B1",
  "paragraphs": [
    { "en": "Last summer I was supposed to fly from Santiago to Lima…", "es": "El verano pasado se suponía que volaba de Santiago a Lima…" },
    { "en": "…", "es": "…", "note": "opcional: nota de gramática o vocabulario sobre este párrafo" }
  ],
  "glossary": [{ "en": "to be supposed to", "es": "se supone que (plan que no se cumplió)" }],
  "questions": [
    { "q": "Why did the writer miss the flight?", "options": ["Traffic", "The wrong date", "A strike"], "answer": 1, "explain": "Párrafo 2: *I had written down the wrong date*." }
  ],
  "source": "opcional: texto original del curso; o «adaptado de…» si te basas en un texto público",
  "caption": "opcional" }
// Longitud total según el nivel: A2+ 150–250 palabras · B1 250–400 · B2 400–600 · C1 550–800 · C2 700–1000.
// Una audición ("listen") necesita ≥ 3 preguntas. Una lectura debería traer 4–8 preguntas.
// Las preguntas de comprensión van en inglés, desde B1; en A2+ pueden ir en español.
// Los textos son ORIGINALES, escritos por ti: artículos, relatos, correos, entrevistas, podcasts transcritos, anuncios, reseñas…
//   Nunca copies textos con derechos de autor. Textos auténticos: sí, en estilo; nunca copiados.
```

Diagramas Mermaid:
- Solo `flowchart`, `sequenceDiagram`, `stateDiagram-v2`, `mindmap`, `timeline` o `classDiagram`.
- Las etiquetas van SIEMPRE entre comillas dobles: `A["was going to (planes que no se cumplieron)"]`.
- Sin `style`, `classDef` ni `%%{init}`.
- Nada de `;` dentro de las etiquetas.
- En `sequenceDiagram`, los mensajes van sin comillas.

Ideas que funcionan: árboles de decisión («¿present perfect o past simple?», «¿qué condicional uso?»), líneas de tiempo de los tiempos verbales (`timeline` o `flowchart LR`), mapas mentales de familias de palabras y colocaciones (`mindmap`), la transformación de una frase (activa → pasiva → causativa), el esqueleto de un ensayo o de un correo formal, y la conversación como `sequenceDiagram`.

## Ejercicios (la práctica, dentro de la plataforma)

Cada ejercicio es una **serie de ítems** que el alumno responde uno a uno con corrección inmediata. Los que falla vuelven al final hasta que los acierta. Queda **resuelto** si acierta a la primera al menos `pass` % (por defecto 80).

```jsonc
{
  "id": "s04-e1",
  "title": "Nombre corto",
  "level": "facil",                   // "facil" | "medio" | "dificil" | "proyecto"
  "kind": "gramatica",                // "vocabulario" | "gramatica" | "traduccion" | "dictado" | "pronunciacion" | "conversacion"
                                      // | "lectura" | "audicion" | "escritura" | "expresion" | "examen" | "mixto"
  "minutes": 10,
  "prompt": ["Instrucciones en 1–2 párrafos."],
  "items": [ /* 8–15 ítems (6–40 permitidos; en escritura y expresión oral bastan 2–4 ítems free, sin relleno) */ ],
  "pass": 80,                         // opcional
  "hints": ["Consejo general antes de empezar (opcional)"],
  "explain": "Qué practicaste y la regla que tienes que llevarte (se muestra al terminar).",
  "source": "opcional: p. ej. «Formato de Cambridge B1 Preliminary, Reading Part 5»"
}
```

### Tipos de ítem (`t`)

```jsonc
// 1) write — escribir la respuesta: traducir (es→en o en→es), transformar frases y DICTADO (con say).
{ "t": "write", "q": "Traduce al inglés: *Nunca he estado en Cusco.*", "answers": ["I have never been to Cusco.", "I've never been to Cusco."] }
{ "t": "write", "q": "Traduce al español: *She has just left.*", "lang": "es", "answers": ["{Ella} acaba de {irse|salir|marcharse}", "Se acaba de {ir|marchar}", "Recién se fue"] }
{ "t": "write", "q": "Escucha y escribe lo que oyes.", "say": "I've been living here since March.", "answers": ["I have been living here since March."] }   // dictado
{ "t": "write", "q": "Reescribe empezando por *Never*: *I have never seen such a mess.*", "answers": ["Never have I seen such a mess."], "note": "Inversión negativa: auxiliar antes del sujeto." }
{ "t": "write", "q": "Escribe la contracción de *they had*.", "answers": ["They'd"], "strict": true }   // strict: no expande contracciones

// 2) choice — elegir una opción. Con say = COMPRENSIÓN AUDITIVA (se escucha y no se ve el texto; puede ser un párrafo entero).
{ "t": "choice", "q": "¿Cuál es correcta?", "options": ["I've seen him yesterday.", "I saw him yesterday."], "answer": 1, "note": "Con un tiempo terminado (*yesterday*) → past simple." }
{ "t": "choice", "q": "Escucha. ¿Qué quiere decir la mujer?", "say": "Well, I wouldn't say no to another coffee.", "options": ["Quiere otro café.", "No quiere más café.", "Está enojada."], "answer": 0 }

// 3) cloze — completar huecos ___ (uno o varios). answers: lista de patrones aceptados POR hueco.
{ "t": "cloze", "text": "I ___ (live) here ___ 2019.", "answers": [["have lived", "have been living", "'ve lived", "'ve been living"], ["since"]], "es": "Vivo aquí desde 2019." }
// "say": true → primero se escucha la frase completa (hueco auditivo).

// 4) order — ordenar fichas (answer). extra = fichas trampa de UNA palabra (que no esté ya en la respuesta). answers = otros órdenes válidos.
{ "t": "order", "q": "Ordena: *¿Dónde has estado?*", "answer": "Where have you been?", "extra": ["did", "gone"] }

// 5) match — unir parejas inglés ↔ español (3–8 pares). Al tocar el inglés se escucha.
{ "t": "match", "q": "Une cada phrasal verb con su significado.", "pairs": [["give up", "rendirse, dejar"], ["look after", "cuidar"], ["run out of", "quedarse sin"]] }

// 6) speak — PRONUNCIACIÓN de un modelo: se escucha, el alumno lo dice, el reconocimiento de voz lo compara.
{ "t": "speak", "say": "I've been working here for ages.", "es": "Llevo siglos trabajando aquí.", "note": "*I've been* se une: /aɪv bɪn/, con *been* débil." }

// 7) NUEVO — free — PRODUCCIÓN LIBRE: el alumno escribe o HABLA con sus palabras (el navegador transcribe lo que dice).
//    La plataforma comprueba sola las metas (`targets`) y la extensión, después muestra la respuesta modelo con audio
//    y una rúbrica de autoevaluación. Cuenta como acierto si cumple todas las metas, la extensión y ≥ 70 % de la rúbrica.
{ "t": "free", "mode": "speak",                    // "speak" (hablar) | "write" (escribir)
  "q": "Habla 45–60 segundos: cuéntale a un amigo un viaje que te marcó. Usa el present perfect para la experiencia y el past simple para los detalles.",
  "say": "Have you ever had a trip that changed you?",   // opcional: la pregunta se escucha (como en un examen oral)
  "minWords": 60, "maxWords": 140,                       // opcional (el modelo tiene que cumplirlo)
  "targets": [                                           // opcional pero MUY recomendable: 2–4 metas concretas
    { "label": "Usa el present perfect (*I've been / I've never…*)", "any": ["{have|has} been", "{have|has} never", "{have|has} * ever"] },
    { "label": "Usa al menos un conector de tiempo (*when, after that, then*)", "any": ["when", "after that", "then", "later"] }
  ],
  "model": "I've been to quite a few places, but the trip that really changed me was… (60–140 palabras, natural, del nivel)",
  "modelEs": "Traducción del modelo (opcional)",
  "rubric": [                                            // 3–6 criterios observables, en español
    "Respondí a la pregunta completa (qué viaje, qué pasó, por qué me marcó).",
    "Usé el present perfect y el past simple donde correspondía.",
    "Hablé sin pausas largas (usé *well*, *you know*, *I mean* si necesitaba pensar).",
    "Mi pronunciación se entiende (sin «e» delante de s: *Spain*, no «Espain»)."
  ],
  "note": "opcional: explicación final" }
// `any`: patrones como los de answers ({a|b}, (x)); un `*` = «lo que sea en medio, en orden» (`if * had * would have`).
//   Se comparan como palabras completas con las contracciones expandidas (*I've* = *I have*). Una meta se cumple si aparece
//   CUALQUIERA de sus formas: sé generoso con las variantes (have/has, contracciones no hace falta).
//   El validador comprueba que la respuesta MODELO cumple todas sus metas y su extensión.
```

Todos los ítems admiten `note`, la explicación que ve el alumno **después** de responder: por qué es así y cuál es el error típico. Úsala a menudo: es donde se aprende.

### Cómo se corrige (y cómo escribir `answers`)
- **Patrones:**
  - `{a|b}` = alternativas; `(x)` = opcional; se pueden anidar.
  - La **primera** forma es la que se muestra como correcta: ponla completa y natural.
- **Inglés:**
  - Se ignoran mayúsculas, puntuación y guiones.
  - Las contracciones equivalen a la forma larga (*isn't* = *is not*, *I'd* = *I would* / *I had*).
  - **No** hay tolerancia a faltas.
  - Incluye TODAS las respuestas razonables. Por ejemplo: variantes de tiempo igual de correctas (*I've lived* / *I've been living*), *who* / *that* en relativas, *going to* / *will* cuando ambas valen, *the film* / *the movie*.
  - Si una respuesta natural no está, el alumno puede pulsar «Mi respuesta también es correcta». Eso es un fallo del contenido: sé generoso.
- **Español** (`"lang": "es"`):
  - Se acepta sin tildes (con aviso).
  - Da alternativas de género y de sujeto, y sinónimos chilenos y neutros.
- **El validador comprueba que:**
  - la primera forma de cada respuesta se da por buena;
  - las fichas de `order` y los huecos son coherentes;
  - todo el inglés existe;
  - el modelo de cada `free` cumple sus metas.

### Qué ejercicios hacer en cada sección (14–18)
1. **Vocabulario** (2): `match`, `write` es↔en, `choice`, `cloze` con colocaciones.
2. **Gramática** (3–4): `cloze`, `choice` de «¿cuál es correcta?», `order`, `write` de transformación, con `note` en cada ítem.
3. **Traducción** (1–2): frases completas es→en y en→es. El objetivo es decirlo natural, no calcado.
4. **Dictado** (1): `write` con `say`, de frases cortas a largas, con habla conectada desde B2.
5. **Audición** (1–2): `choice` con `say` de párrafos, anuncios, mensajes de voz y fragmentos de conversación. Preguntas por idea principal, detalle, actitud e intención del hablante.
6. **Lectura** (1): `choice` y `cloze` sobre un texto (puedes reutilizar un bloque `text` de las lecciones o citarlo en `q`).
7. **Pronunciación** (1): `speak` con los sonidos, el ritmo, las formas débiles y la entonación de la sección, cada uno con `note`.
8. **Conversación** (1): `choice` de «¿qué respondes?» en situaciones reales, `order` y `speak`, con respuestas naturales.
9. **Escritura** (1, `kind: "escritura"`): 2–3 ítems `free` con `mode: "write"`. Son tareas reales del nivel (correo, reseña, ensayo, informe, mensaje), con metas, modelo y rúbrica.
10. **Expresión oral** (1, `kind: "expresion"`): 2–4 ítems `free` con `mode: "speak"`. Son preguntas de examen oral, monólogos cronometrados, opinar o describir una foto con palabras.
11. **Examen** (1, `"kind": "examen"`, `"level": "proyecto"`): una tarea en el **formato real de Cambridge** del nivel (A2 Key, B1 Preliminary, B2 First, C1 Advanced, C2 Proficiency), por ejemplo *Use of English Part 4* (key word transformations) o *Reading Part 1*. Lleva `"source"` con el nombre del examen y la parte.
12. **Desafío** (1, `"level": "dificil"`, `"kind": "mixto"`): mezcla de todo, sin pistas.

**Mínimos que exige el validador por sección:**
- 6 lecciones, 5 diagramas, 4 patrones y 2 diálogos.
- 4 bloques `words`, 4 bloques `phrases` y 2 bloques `text`.
- 14 ejercicios, entre ellos 1 de examen.
- 10 ítems `speak`, 8 dictados y 20 ítems de audio (`say` o audición).
- 4 ítems `free`: al menos 2 hablados y 2 escritos.
- 50 tarjetas y 40 preguntas.

## Tarjetas
Formato: `{ "front": "…", "back": "…", "say": "texto en inglés que se escucha" }`.

Mezcla tres tipos:
- **Palabras y expresiones:** front = inglés, back = español + nota breve, `say` = la expresión.
- **Frases para decir:** front = español, back = inglés natural, `say` = la frase.
- **Reglas:** por ejemplo «¿*for* o *since*?».

## Test (quiz)
Como en los otros cursos: `single`, `multi` (con «(Selecciona DOS.)») y `yesno`. Cada pregunta lleva `explain`, que justifica la correcta y descarta las otras. Con `"say": "…"` opcional, la pregunta tiene un botón para escuchar ese inglés (comprensión auditiva). En el examen final (s34), cada pregunta lleva `"topic": "sNN"`: la sección de la que sale.

Tipos de pregunta que funcionan:
- ¿Cuál es correcta / natural?
- Encuentra el error.
- Elige la palabra que falta.
- Registro: ¿formal o informal?
- ¿Qué quiere decir el hablante? (con `say`).
- Colocaciones.
- Pronunciación (¿qué sílaba lleva el acento?).
- Transformación de frases.

## Validar
```bash
node --no-warnings scripts/validate-english.mjs --fix-ipa content/ingles-pro/sNN.json   # rellena las IPA que falten y valida
node --no-warnings scripts/validate-english.mjs content/ingles-pro/sNN.json             # solo validar
node scripts/ipa.mjs palabra "una frase"                                                # IPA y ortografía de lo que quieras
```
Repite hasta que diga `OK`.

Los nombres propios que el diccionario no conoce (p. ej. *Valparaíso*) se declaran en `"allow"`, solo si son nombres propios con mayúscula y nunca para tapar una falta. Si una palabra inglesa real y correcta no está en el diccionario (pasa con algunas palabras modernas o raras), reemplázala por un sinónimo que sí esté; no la metas en `allow`.
