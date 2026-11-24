import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { AppNav } from "@/components/AppNav";
import "./globals.css";

// next/font descarga las fuentes en build y las sirve desde el propio
// dominio: ninguna peticion a Google en tiempo de ejecucion.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Omnium",
    template: "%s · Omnium",
  },
  description:
    "Planifica comidas, batch cooking y compra optimizando el coste por gramo de proteína.",
};

export const viewport: Viewport = {
  themeColor: "#0d0e0b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`dark ${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <AppNav />
        <div className="flex flex-1 flex-col pb-24 md:pb-0">{children}</div>
      </body>
    </html>
  );
}
