# Ejecuta un comando con la salida conectada a una pseudo-terminal (PTY), como en una terminal real,
# y la entrada estándar tal cual (tubería). Así Git colorea y decora solo cuando escribe en la
# terminal, y los hooks o tuberías internas reciben texto limpio, igual que en el computador del alumno.
import fcntl
import os
import pty
import select
import struct
import subprocess
import sys
import termios

master, slave = pty.openpty()
attrs = termios.tcgetattr(slave)
attrs[1] &= ~termios.ONLCR  # sin conversión \n -> \r\n
termios.tcsetattr(slave, termios.TCSANOW, attrs)
fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 40, 100, 0, 0))

proc = subprocess.Popen(sys.argv[1:], stdin=sys.stdin, stdout=slave, stderr=slave)
os.close(slave)
out = sys.stdout.buffer


def drain(timeout):
    while True:
        ready, _, _ = select.select([master], [], [], timeout)
        if not ready:
            return True
        try:
            data = os.read(master, 65536)
        except OSError:
            return False
        if not data:
            return False
        out.write(data)
        out.flush()


while proc.poll() is None:
    if not drain(0.05):
        break
drain(0.05)  # lo que quede tras terminar (sin esperar a procesos en segundo plano)
sys.exit(proc.wait())
