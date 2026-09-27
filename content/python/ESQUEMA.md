# Curso de Python — formato de una sección

Cada sección es un archivo `content/python/sNN.json`. Todo el texto en **español neutro**; código, identificadores y términos técnicos en inglés cuando es lo habitual (con su traducción la primera vez).

Las prácticas se hacen **dentro de la plataforma**: el alumno escribe código en un editor y se ejecuta con **Pyodide (CPython 3.14 en WebAssembly)**. No hay nada que instalar. Por eso cada ejercicio trae tests que se ejecutan de verdad.

```jsonc
{
  "id": "s06", "order": 6,
  "title": "Funciones",
  "domain": "basico",               // "basico" | "intermedio" | "avanzado" | "experto" | "extra"
  "summary": "2–3 frases: qué aprendes y por qué importa.",
  "goal": "Meta de la sección en UNA frase medible (≤ 35 palabras).",
  "objectives": ["Resultados de aprendizaje de la sección (5–8), verbo observable en infinitivo"],
  "lessons": [
    {
      "id": "s06-l1", "title": "…", "minutes": 15,
      "goals": ["2–4 objetivos: verbo observable en infinitivo (nunca entender/conocer/saber)"],
      "takeaways": ["3–5 ideas esenciales, cortas y precisas"],
      "blocks": [
        { "type": "p", "text": "Párrafo. Admite **negrita**, *cursiva* y `código`." },
        { "type": "h", "text": "Subtítulo" },
        { "type": "list", "items": ["…"], "ordered": false },
        { "type": "table", "head": ["A", "B"], "rows": [["a", "b"]] },
        { "type": "diagram", "title": "…", "mermaid": "flowchart LR\n  A[\"x\"] --> B[\"y\"]", "caption": "…" },
        { "type": "code", "lang": "python", "code": "print('hola')", "run": true, "stdin": ["opcional", "entradas para input()"], "caption": "…" },
        { "type": "code", "lang": "bash", "code": "python -m venv .venv" },
        { "type": "callout", "variant": "tip|warn|exam", "text": "…" },
        { "type": "terms", "items": [{ "term": "Iterable", "en": "iterable", "def": "…" }] }
      ]
    }
  ],
  "exercises": [
    {
      "id": "s06-e1",
      "title": "Nombre corto",
      "level": "facil",            // "facil" | "medio" | "dificil" | "proyecto"
      "minutes": 10,
      "prompt": ["Párrafo 1 del enunciado (inline md).", "Párrafo 2…"],
      "examples": [{ "call": "suma(2, 3)", "result": "5" }],
      "starter": "def suma(a, b):\n    # Escribe tu código aquí\n    pass\n",
      "solution": "def suma(a, b):\n    return a + b\n",
      "setup": "",                 // opcional: código que se ejecuta antes de los tests
      "tests": [
        { "name": "Suma dos positivos", "code": "assert suma(2, 3) == 5, 'suma(2, 3) debería devolver 5'" }
      ],
      "hints": ["Pista 1 (suave)", "Pista 2 (más concreta)"],
      "explain": "Por qué funciona la solución, complejidad y alternativas."
    }
  ],
  "labs": [],
  "flashcards": [{ "front": "…", "back": "…" }],
  "quiz": [
    { "id": "s06-q1", "type": "single", "q": "…", "options": ["A", "B", "C", "D"], "answer": [1], "explain": "…" },
    { "id": "s06-q2", "type": "multi", "q": "… (Selecciona DOS.)", "options": ["A","B","C","D","E"], "answer": [0, 3], "explain": "…" },
    { "id": "s06-q3", "type": "yesno", "q": "Indica Sí o No.", "statements": [{ "text": "…", "answer": true }], "explain": "…" }
  ],
  "sources": [{ "title": "…", "url": "https://docs.python.org/3/…" }]
}
```

## Cómo se ejecutan los ejercicios
1. Se ejecuta el código del alumno (o `solution` en la validación) en un espacio de nombres limpio.
2. Se ejecuta `setup` (si existe).
3. Se ejecuta **cada test por separado**; un test pasa si no lanza excepción. El mensaje del `assert` es lo que ve el alumno: escríbelo claro y en español.

Hay una función auxiliar disponible en los tests (y en el código del alumno):

```python
capturar(funcion, *args, entradas=None, **kwargs) -> str
# Ejecuta funcion(*args, **kwargs) capturando lo que imprime con print() y devuelve ese texto.
# entradas: lista de cadenas que devolverán las llamadas a input(), en orden.
```

Ejemplo de test para un programa con `input()`/`print()` (encapsúlalo en una función `main()`):
`assert capturar(main, entradas=["Ana"]) == "Hola, Ana\n", "Con la entrada Ana debe imprimir exactamente: Hola, Ana"`

## Reglas de calidad (obligatorias)
- La `solution` pasa **todos** los tests y el `starter` **falla al menos uno** (el validador lo comprueba).
- Los tests cubren casos normales, bordes (vacío, cero, negativos, unicode…) y errores esperados (`pytest`-style con `try/except` o comprobando que se lanza la excepción).
- Nada de `threading` (no se pueden arrancar hilos), `multiprocessing`, `subprocess`, sockets ni `pip` en ejercicios ni en ejemplos `run` (el navegador no lo permite). Explícalos en la lección con bloques de código **sin** `run`.
- `asyncio` funciona, pero **no uses `asyncio.run()`** (requiere una capacidad que no todos los navegadores tienen). En su lugar, los tests y los ejemplos `run` usan `await` directamente en el nivel superior: `assert await descargar(3) == [...]`. `asyncio.gather`, `TaskGroup`, `wait_for`, `Queue`, `sleep`, etc. funcionan. En la lección explica que en un script normal se usa `asyncio.run(main())`.
- El sistema de archivos es virtual y cada ejecución empieza en una carpeta vacía: `open`, `pathlib`, `csv`, `json`, `sqlite3`, `zipfile` funcionan. Si un ejercicio necesita un archivo de entrada, créalo en `setup`.
- Python de los ejercicios: **3.14** (Pyodide). Puedes usar `match`, `TaskGroup`, `except*`, genéricos con `[T]`, etc.
- Los ejemplos de código de las lecciones marcados con `"run": true` deben ejecutarse sin error (el validador lo comprueba). Los que muestran errores a propósito, o usan algo no disponible en el navegador, van sin `run`.
- Nada inventado: APIs, comportamientos y versiones verificados en la documentación oficial (docs.python.org, PEPs). Python de referencia: **3.14**; indica "desde 3.X" cuando una característica sea reciente.
- Diagramas Mermaid: solo `flowchart`, `sequenceDiagram`, `classDiagram`, `stateDiagram-v2`, `mindmap` o `timeline`; etiquetas entre comillas dobles; sin `style`/`classDef`/`%%{init}`.

## Validar
```bash
cd /Users/jltorocode/Documents/code/IA/cuaderno-next
node scripts/validate-course.mjs content/python/sNN.json
```
Repite hasta que diga `OK`.

## Código dentro de preguntas y enunciados
En `quiz[].q`, `quiz[].explain`, `exercises[].prompt[]` y `exercises[].explain` puedes incluir un bloque de código con triple comilla invertida (se mostrará con formato):

    "q": "¿Qué imprime este código?\n```python\nx = [1, 2]\ny = x\ny.append(3)\nprint(x)\n```"

## Estilo del código
- PEP 8, `snake_case`. Identificadores en español **sin tildes ni ñ** (`anio`, `calcular_total`) en los niveles 1–2; en 3–4 lo natural (inglés o español) mientras sea coherente dentro de la sección. APIs estándar tal cual.
- Nada de trucos crípticos en las soluciones: código que enseñe. Si hay una versión "pro" más corta, muéstrala en `explain`.

## `__name__` al ejecutar y al comprobar (el código corre en un módulo real)
El código del alumno se ejecuta dentro de un módulo real registrado en `sys.modules`, así que `typing.get_type_hints(Clase)`, `pickle` de clases propias, `dataclasses` con anotaciones en cadena y `logging.getLogger(__name__)` funcionan como en un script normal. `inspect.getsource` sigue sin poder leer el fuente de funciones del alumno (no hay archivo `.py`).
- Ejemplos `run` y botón **Ejecutar**: el código corre como un script → `__name__ == "__main__"` (el bloque `if __name__ == "__main__":` SÍ se ejecuta; si llama a `input()`, añade `stdin`).
- **Comprobar** (tests): el código se importa como módulo llamado `solucion` → `__name__ == "solucion"` y el bloque `if __name__ == "__main__":` NO se ejecuta, igual que al importar un módulo con pytest. Por eso los ejercicios pueden (y deben, cuando tenga sentido) usar ese patrón.
