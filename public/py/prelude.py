# Utilidades disponibles en los ejercicios y en el laboratorio del Cuaderno.
import builtins as _builtins
import contextlib as _contextlib
import io as _io

_input_original = _builtins.input


def capturar(funcion, *args, entradas=None, **kwargs):
    """Ejecuta funcion(*args, **kwargs) y devuelve como texto todo lo que imprime.

    entradas: lista de cadenas que devolverán, en orden, las llamadas a input().
    El texto del prompt de input() no se incluye en la salida capturada.
    """
    pendientes = [str(x) for x in (entradas or [])]

    def _input(prompt=""):
        if not pendientes:
            raise EOFError("input() se llamó más veces que entradas proporcionadas")
        return pendientes.pop(0)

    salida = _io.StringIO()
    anterior = _builtins.input
    _builtins.input = _input
    try:
        with _contextlib.redirect_stdout(salida):
            funcion(*args, **kwargs)
    finally:
        _builtins.input = anterior
    return salida.getvalue()


def _instalar_entradas(lineas):
    """Para ejecutar programas libres: input() lee de `lineas` y hace eco como en una terminal."""
    pendientes = [str(x) for x in (lineas or [])]

    def _input(prompt=""):
        print(prompt, end="")
        if not pendientes:
            raise EOFError("El programa pidió más datos con input() de los que escribiste en «Entrada».")
        valor = pendientes.pop(0)
        print(valor)
        return valor

    _builtins.input = _input


def _restaurar_entradas():
    _builtins.input = _input_original
