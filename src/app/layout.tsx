import type { Metadata } from "next";
import { Atkinson_Hyperlegible_Next, Big_Shoulders, IBM_Plex_Mono } from "next/font/google";
import { ProgressProvider } from "@/components/ProgressProvider";
import "./globals.css";

// Tipografía: señalética de montaña para títulos, lectura hiperlegible para el estudio y mono para cotas y datos.
const body = Atkinson_Hyperlegible_Next({ variable: "--font-body", subsets: ["latin", "latin-ext"], style: ["normal", "italic"] });
const display = Big_Shoulders({ variable: "--font-display", subsets: ["latin", "latin-ext"], axes: ["opsz"] });
const mono = IBM_Plex_Mono({ variable: "--font-mono", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: { default: "Cuaderno de Certificaciones", template: "%s · Cuaderno" },
  description: "Mi cuaderno de ruta personal para preparar certificaciones."
};

// Aplica el tema guardado antes de pintar para evitar parpadeos.
const themeScript = `try{var t=localStorage.getItem("cuaderno-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${body.variable} ${display.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ProgressProvider>{children}</ProgressProvider>
      </body>
    </html>
  );
}
