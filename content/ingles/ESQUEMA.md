# Curso de inglés — formato de una sección

Cada sección es un archivo `content/ingles/sNN.json`. Explicaciones en **español neutro** (el alumno es chileno: nada de voseo ni jerga de España; «ustedes», no «vosotros»). Todo lo que sea inglés va **en inglés correcto y natural** y la plataforma lo **lee en voz alta** (síntesis de voz del sistema, inglés americano). Por eso el inglés de palabras, frases, diálogos, patrones, `say` y respuestas pasa por un **corrector ortográfico** (diccionario CMU): una falta de ortografía en inglés rompe la validación.

El curso sigue el libro **«Inglés Básico» de Augusto Ghio D.** (método *Basic English* de C. K. Ogden: 850 palabras y 16 verbos). El texto del libro por lección está en `/private/tmp/claude-501/-Users-jltorocode-Documents-code-IA/8f65431a-e446-4af9-b575-2be6c0b7afa8/scratchpad/ingles/libro/leccion-NN.txt` (las marcas `[fin de la pág. N del libro]` son el nº de página del PDF). Lee `content/ingles/PLAN.md` antes de escribir.

```jsonc
{
  "id": "s01", "order": 1,
  "title": "Primeras palabras: is, are y la terminación -ing",
  "domain": "nivel1",                 // "nivel1" | "nivel2" | "nivel3" | "nivel4" | "extra"
  "summary": "2–3 frases: qué aprendes y para qué te sirve al hablar.",
  "goal": "Meta de la sección en UNA frase medible (≤ 35 palabras).",
  "objectives": ["4–8 resultados de aprendizaje con verbo observable en infinitivo"],
  "lessons": [
    {
      "id": "s01-l1", "title": "…", "minutes": 15,
      "goals": ["2–4 objetivos: verbo observable (decir, traducir, pronunciar, construir, distinguir…; nunca entender/conocer/saber/comprender/aprender)"],
      "takeaways": ["3–5 ideas esenciales, cortas y precisas"],
      "blocks": [ /* ver «Bloques» */ ]
    }
  ],
  "exercises": [ /* ver «Ejercicios» */ ],
  "labs": [],
  "flashcards": [{ "front": "Light", "back": "Luz · /laɪt/ (lait)", "say": "Light" }],
  "quiz": [ /* ver «Test» */ ],
  "sources": [
    { "title": "Augusto Ghio D., «Inglés Básico», lección 1 (págs. 11–18)", "url": "/libros/ingles-basico.pdf#page=11" },
    { "title": "Cambridge Dictionary — Grammar: …", "url": "https://dictionary.cambridge.org/grammar/british-grammar/…" }
  ]
}
```

## Bloques de una lección

Los de siempre: `p`, `h`, `list`, `table`, `diagram` (Mermaid), `callout` (`tip` = Truco, `warn` = Ojo, `exam` = «En el examen»), `terms` (términos de gramática para el glosario). Texto en línea: `**negrita**`, `*cursiva*` y `` `código` `` (usa *cursiva* para el inglés dentro de un párrafo en español: «la palabra *light* significa luz»).

Y los propios del curso, **todos con audio** (el alumno pulsa 🔊 en cada elemento, o «Escuchar todo»):

```jsonc
// Vocabulario: tarjetas con palabra, IPA, pronunciación figurada del libro y traducción.
{ "type": "words", "title": "Palabras que ya conoces (cognados)", "items": [
  { "en": "Animal", "es": "Animal", "fig": "ánimal", "ipa": "/ˈænəməl/" },
  { "en": "Light", "es": "Luz", "fig": "lait", "ipa": "/laɪt/", "note": "La *gh* no suena." }
]}
// fig: la pronunciación figurada DEL LIBRO (sin paréntesis). Si el libro no la trae, omítela (no la inventes).
// ipa: inglés americano del diccionario CMU. NO la escribas a mano: ejecuta el validador con --fix-ipa y se rellena sola.
//      Si una palabra tiene varias pronunciaciones (record sustantivo /ˈrɛkɚd/ vs verbo /rəˈkɔrd/), el validador
//      acepta cualquiera del diccionario; elige la que corresponda. `node scripts/ipa.mjs palabra` las muestra.

// Frases de ejemplo inglés ↔ español (el alumno puede ocultar una columna para autoevaluarse).
{ "type": "phrases", "title": "Is y are en frases", "items": [
  { "en": "He is my brother.", "es": "Él es mi hermano." },
  { "en": "They are in the garden.", "es": "Ellos están en el jardín.", "note": "*are* = son / están" }
]}

// Diálogo con 2–4 personajes (cada uno con una voz distinta cuando el sistema tiene varias).
{ "type": "dialog", "title": "En el hotel", "caption": "opcional", "lines": [
  { "who": "Ana", "en": "Is this hotel good?", "es": "¿Es bueno este hotel?" },
  { "who": "Tom", "en": "Yes, it is very good.", "es": "Sí, es muy bueno." }
]}

// Patrón de frase: la estructura de la oración como tabla de colores (una columna por función).
// Es el «diagrama» principal de la gramática: úsalo siempre que haya una estructura que imitar.
{ "type": "pattern", "title": "Afirmación con to be", "slots": ["Sujeto", "to be", "Complemento"],
  "rows": [["He", "is", "my brother"], ["They", "are", "in the garden"], ["The sky", "is", "blue"]],
  "es": ["Él es mi hermano", "Ellos están en el jardín", "El cielo es azul"], "caption": "opcional" }
// rows: tantas celdas como slots; una celda puede ir vacía ("") si esa fila no usa esa función.
```

Diagramas Mermaid: solo `flowchart`, `sequenceDiagram`, `stateDiagram-v2`, `mindmap`, `timeline` o `classDiagram`; etiquetas SIEMPRE entre comillas dobles (`A["is (es / está)"]`); sin `style`, `classDef` ni `%%{init}`; nada de `;` dentro de etiquetas; en `sequenceDiagram` sin comillas en los mensajes. Ideas que funcionan muy bien: árboles de decisión («¿a o an?», «¿this, that, these o those?», «¿do o make?», «¿some o any?»), líneas de tiempo de los tiempos verbales (`timeline` o `flowchart LR` pasado → presente → futuro), mapas mentales de familias de palabras (`mindmap`), cómo se transforma una afirmación en negación y en pregunta (`flowchart`), la conversación como `sequenceDiagram`.

## Ejercicios (la práctica, dentro de la plataforma)

Cada ejercicio es una **serie de ítems** que el alumno responde uno a uno con corrección inmediata. Los que falla vuelven al final hasta que los acierta. Queda **resuelto** si acierta a la primera al menos `pass` % (por defecto 80).

```jsonc
{
  "id": "s01-e1",
  "title": "Nombre corto",
  "level": "facil",                   // "facil" | "medio" | "dificil" | "proyecto"
  "kind": "vocabulario",              // "vocabulario" | "gramatica" | "traduccion" | "dictado" | "pronunciacion" | "conversacion" | "examen" | "mixto"
  "minutes": 8,
  "prompt": ["Instrucciones en 1–2 párrafos."],
  "items": [ /* 8–15 ítems (6–40 permitidos); el examen del libro puede ser más largo */ ],
  "pass": 80,                         // opcional
  "hints": ["Consejo general antes de empezar (opcional)"],
  "explain": "Qué practicaste y la regla que tienes que llevarte (se muestra al terminar).",
  "source": "Libro, pág. 16: examen de la primera lección"   // opcional
}
```

### Tipos de ítem (`t`)

```jsonc
// 1) write — escribir la respuesta. Sirve para traducir (es→en o en→es), transformar frases y DICTADO.
{ "t": "write", "q": "Traduce al inglés: *El cielo es azul.*", "answers": ["The sky is blue."] }
{ "t": "write", "q": "Traduce al español: *They are walking.*", "lang": "es",
  "answers": ["{Ellos|Ellas} están {caminando|paseando}", "Están {caminando|paseando}"] }
{ "t": "write", "q": "Escucha y escribe lo que oyes.", "say": "My sister is in the garden.", "answers": ["My sister is in the garden."] }   // dictado
{ "t": "write", "q": "Pasa a negativa: *He is late.*", "answers": ["He is not late.", "He isn't late."], "note": "La negación con to be: *is not*." }
{ "t": "write", "q": "Escribe la contracción de *I am*.", "answers": ["I'm"], "strict": true }   // strict: no expande contracciones

// 2) choice — elegir una opción (con say = ejercicio de COMPRENSIÓN AUDITIVA: se escucha y no se ve el texto).
{ "t": "choice", "q": "¿Qué significa *yellow*?", "options": ["Azul", "Amarillo", "Verde"], "answer": 1 }
{ "t": "choice", "q": "Escucha. ¿Qué oíste?", "say": "They are crying.", "options": ["Están llorando.", "Están caminando.", "Están pintando."], "answer": 0 }

// 3) cloze — completar huecos ___ (uno o varios). answers: una lista de patrones aceptados POR hueco.
{ "t": "cloze", "text": "He ___ my brother and they ___ my sisters.", "answers": [["is"], ["are"]], "es": "Él es mi hermano y ellas son mis hermanas." }
// "say": true → primero se escucha la frase completa (hueco auditivo). Tras responder siempre se puede escuchar.

// 4) order — ordenar fichas para formar la frase (answer). extra = fichas trampa de UNA palabra. answers = otros órdenes válidos (mismas fichas).
{ "t": "order", "q": "Ordena: *Una casa nueva*", "answer": "A new house", "extra": ["houses", "news"] }
// (una ficha trampa no puede ser una palabra que ya está en la respuesta)

// 5) match — unir parejas inglés ↔ español (3–8 pares). Al tocar el inglés se escucha.
{ "t": "match", "q": "Une cada palabra con su traducción.", "pairs": [["Hat", "Sombrero"], ["Fork", "Tenedor"], ["Sky", "Cielo"], ["River", "Río"]] }

// 6) speak — PRONUNCIACIÓN: el alumno escucha el modelo, se graba y se compara (reconocimiento de voz si
//    está disponible; si no, se autoevalúa escuchando su grabación junto al modelo).
{ "t": "speak", "say": "The sky is blue.", "es": "El cielo es azul.", "note": "*sky*: la s inicial sin «e» delante: /skaɪ/, no «eskai»." }
```

Todos los ítems admiten `note`: la explicación que ve el alumno **después** de responder (por qué es así, el error típico). Úsala a menudo: es donde se aprende.

### Cómo se corrige (y cómo escribir `answers`)
- **Patrones**: `{a|b}` = alternativas, `(x)` = opcional; se anidan. `"(Yo) {tengo|poseo} un sombrero"`. La **primera** forma es la que se muestra como correcta: ponla completa y natural.
- **Inglés**: se ignoran mayúsculas, puntuación y guiones; las contracciones equivalen a la forma larga (*isn't* = *is not*, *it's* = *it is* / *it has*). Si falta el apóstrofo (*dont*) cuenta como bien con aviso. **No** hay tolerancia a faltas: *walk* ≠ *walks* (si está a 1–2 letras se avisa «casi»). Incluye TODAS las traducciones razonables: *you* = tú/usted/ustedes; sujeto omitido en español; sinónimos (*walking* = caminando/paseando). Si una respuesta natural no está en la lista, el alumno puede pulsar «Mi respuesta también es correcta», pero eso es un fallo del contenido: sé generoso.
- **Español** (`"lang": "es"`): además se acepta sin tildes (con aviso). Da alternativas de género y de sujeto: `"{Él|Ella} está pintando"`, `"Está pintando"`.
- El validador comprueba que la primera forma de cada respuesta se da por buena, que las fichas de `order` son coherentes, que los huecos coinciden y que todo el inglés existe.

### Qué ejercicios hacer en cada sección (12–16)
1. **Vocabulario** (2–3): `match` + `write` es→en y en→es + `choice`, con TODAS las palabras nuevas de la lección del libro repartidas.
2. **Gramática** (3–4): `cloze`, `choice`, `order`, `write` de transformación (afirmativa → negativa → pregunta, singular → plural, presente → pasado…) con `note` en cada ítem.
3. **Traducción** (2): frases completas es→en y en→es (las del libro y otras nuevas con el vocabulario ya visto).
4. **Dictado** (1–2): `write` con `say` (frases cortas → más largas).
5. **Pronunciación** (1–2): `speak` con las palabras y frases difíciles, con `note` sobre el sonido (th, sh, h aspirada, vocales largas/cortas, -ed, -s…).
6. **Conversación** (1): diálogo cotidiano con `choice` («¿qué respondes?»), `order` y `speak`.
7. **Examen del libro** (1, `"kind": "examen"`, `"level": "proyecto"`): el examen de la lección TAL CUAL (apartados a, b, c…) con la «Comprobación» del libro como respuesta, corregida si el libro se equivoca (y dilo en `note`). `"source"` con la página.
8. **Desafío** (1, `"level": "dificil"`, `"kind": "mixto"`): mezcla de todo, sin pistas.

Mínimos que exige el validador por sección (s01–s11): 5 lecciones, 4 diagramas, 3 patrones, 1 diálogo, 3 bloques `words`, 3 bloques `phrases`, 12 ejercicios (1 de examen), 8 ítems `speak`, 8 dictados, 12 ítems de audio (`say`), 40 tarjetas y 35 preguntas.

## Tarjetas
`{ "front": "…", "back": "…", "say": "texto en inglés que se escucha" }`. Mezcla: palabras (front = inglés, back = español + IPA + pronunciación del libro, `say` = la palabra), frases (front = español, back = inglés, `say` = la frase en inglés) y reglas («¿Cuándo se usa *an*?»).

## Test (quiz)
Como en los otros cursos: `single`, `multi` (con «(Selecciona DOS.)»), `yesno`; cada pregunta con `explain` que justifica la correcta y descarta las otras. Opcional `"say": "…"` → la pregunta tiene un botón para escuchar ese inglés (comprensión auditiva: «Escucha y elige la traducción»). En el examen final (s12) cada pregunta lleva `"topic": "sNN"` (la sección de la que sale).
Tipos de pregunta que funcionan: traducción, «¿cuál es correcta?», «encuentra el error», elegir la palabra que falta, reglas (¿cuándo *a*/*an*?), pronunciación (¿cómo suena la *th* de *this*?), comprensión auditiva con `say`.

## Reglas de calidad (obligatorias)
- **Fiel al libro y completo**: TODO el vocabulario, las reglas, las frases de ejemplo, los ejercicios de perfeccionamiento y el examen de la lección deben estar en la sección (el alumno no necesita abrir el libro). Las frases del libro van en bloques `phrases`; las palabras, en `words` con la pronunciación figurada del libro en `fig`.
- **Corrige al libro cuando se equivoca** y dilo con un `callout` `warn` («El libro dice… pero lo correcto es…»): hay erratas (*Ligth*), traducciones malas (*rat* = rata, no ratón), palabras que no existen (*darking* → *getting dark*/*darkening*), adjetivos en plural (*very olds* → *very old*), grafías antiguas (*to-day* → *today*).
- **Inglés de hoy**: el *Basic English* evita muchos verbos (dice *have a desire for* en lugar de *want*, *put on* en vez de *wear*…). Enseña lo del libro y añade un `callout` `tip` «En el inglés de todos los días» con la forma natural cuando la del libro suene rara o anticuada. Nunca enseñes algo incorrecto.
- **Pronunciación**: IPA americana del diccionario (`--fix-ipa`); la figurada del libro se conserva en `fig` tal cual (corrigiendo solo erratas evidentes). Explica los sonidos que no existen en español la primera vez que aparecen.
- **Ejemplos, muchos**: cada regla con varias frases con audio. Ejemplos nuevos: con el vocabulario ya visto en esta sección o en las anteriores; lugares y nombres cercanos al alumno (Santiago, Valparaíso, Chile) o neutros.
- **Progresión**: no uses gramática de secciones posteriores (antes de s08 no hay negaciones con *do not*; antes de s09 no hay preguntas con *do*; el pasado llega en s04). Si hace falta algo de más adelante, dilo («lo veremos en la sección 9»).
- **Nada inventado**: reglas y datos verificables en Cambridge Dictionary, British Council LearnEnglish, Merriam-Webster u Oxford Learner's Dictionaries. Cita en `sources` solo lo que consultaste.

## Validar
```bash
cd /Users/jltorocode/Documents/code/IA/cuaderno-next
node --no-warnings scripts/validate-english.mjs --fix-ipa content/ingles/sNN.json   # rellena las IPA que falten y valida
node --no-warnings scripts/validate-english.mjs content/ingles/sNN.json             # solo validar
node scripts/ipa.mjs palabra "una frase"                                            # IPA y ortografía de lo que quieras
```
Repite hasta que diga `OK`. Los nombres propios que el diccionario no conoce (p. ej. *Matanzas*) se declaran en la sección: `"allow": ["Matanzas"]` (solo nombres propios con mayúscula; nunca para tapar una falta).
