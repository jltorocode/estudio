# Funciones auxiliares para los scripts de preparación (setup) y de comprobación (checks) del curso de Git.
# Compatibles con bash 3.2 (macOS). Se cargan antes de cada script.

# ---------- Preparación de escenarios ----------

# fecha "2026-09-01 10:00" -> fija la fecha de autor y de commit de los siguientes commits (historia reproducible)
fecha() { export GIT_AUTHOR_DATE="$1 -0300"; export GIT_COMMITTER_DATE="$1 -0300"; }

# autor "Ana Pérez" "ana@ejemplo.com" -> los siguientes commits los firma esa persona
autor() { export GIT_AUTHOR_NAME="$1" GIT_AUTHOR_EMAIL="$2" GIT_COMMITTER_NAME="$1" GIT_COMMITTER_EMAIL="$2"; }

# yo -> vuelve a la identidad del alumno
yo() { unset GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL GIT_COMMITTER_NAME GIT_COMMITTER_EMAIL; }

# nuevo_repo carpeta -> crea un repositorio con rama main y entra en él
nuevo_repo() { mkdir -p "$1" && cd "$1" && git init -q -b main; }

# escribir archivo "contenido" -> crea o reemplaza un archivo (crea carpetas si hace falta)
escribir() { mkdir -p "$(dirname "$1")"; printf '%s\n' "$2" > "$1"; }

# anexar archivo "linea" -> añade una línea al final
anexar() { printf '%s\n' "$2" >> "$1"; }

# commit_archivo archivo "contenido" "mensaje" -> escribe, prepara y confirma en un paso
commit_archivo() { escribir "$1" "$2"; git add -- "$1"; git commit -q -m "$3"; }

# ---------- Comprobaciones ----------

# falla "mensaje" -> la comprobación no se cumple; el mensaje es lo que verá el alumno
falla() { echo "$1"; exit 1; }

es_repo() { git rev-parse --git-dir >/dev/null 2>&1 || falla "${1:-Aquí no hay un repositorio de Git (¿ejecutaste git init?)}"; }
rama_existe() { git show-ref --verify --quiet "refs/heads/$1" || falla "${2:-No existe la rama $1}"; }
rama_no_existe() { git show-ref --verify --quiet "refs/heads/$1" && falla "${2:-La rama $1 todavía existe}"; return 0; }
rama_actual() { git symbolic-ref --quiet --short HEAD 2>/dev/null; }
en_rama() { [ "$(rama_actual)" = "$1" ] || falla "${2:-Deberías estar en la rama $1 (estás en: $(rama_actual || echo 'HEAD separado'))}"; }
limpio() { [ -z "$(git status --porcelain)" ] || falla "${1:-Hay cambios sin confirmar (revisa git status)}"; }
num_commits() { git rev-list --count "${1:-HEAD}" 2>/dev/null || echo 0; }
mensaje() { git log -1 --format=%s "${1:-HEAD}" 2>/dev/null; }
mensaje_es() { [ "$(mensaje "$1")" = "$2" ] || falla "${3:-El mensaje de $1 debería ser «${2}» (es «$(mensaje "$1")»)}"; }
contenido() { git show "$1:$2" 2>/dev/null; }
archivo_tiene() { grep -qF -- "$2" "$1" 2>/dev/null || falla "${3:-El archivo $1 debería contener «${2}»}"; }
archivo_existe() { [ -e "$1" ] || falla "${2:-Falta el archivo $1}"; }
sin_conflictos() { [ -z "$(git diff --name-only --diff-filter=U)" ] || falla "${1:-Todavía hay conflictos sin resolver}"; grep -rqs '^<<<<<<<' --exclude-dir=.git . && falla "${1:-Quedan marcadores de conflicto (<<<<<<<) en algún archivo}"; return 0; }
ancestro() { git merge-base --is-ancestor "$1" "$2" 2>/dev/null; }
es_merge() { [ "$(git rev-list --parents -n 1 "${1:-HEAD}" | wc -w | tr -d ' ')" -ge 3 ]; }
sin_operacion_en_curso() {
  local g; g="$(git rev-parse --git-dir)"
  [ -e "$g/MERGE_HEAD" ] && falla "Hay un merge a medias (termínalo o usa git merge --abort)"
  [ -d "$g/rebase-merge" ] || [ -d "$g/rebase-apply" ] && falla "Hay un rebase a medias (git rebase --continue o --abort)"
  [ -e "$g/CHERRY_PICK_HEAD" ] && falla "Hay un cherry-pick a medias"
  [ -e "$g/REVERT_HEAD" ] && falla "Hay un revert a medias"
  return 0
}
