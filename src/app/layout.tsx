import { ThemeProvider } from "@/components/theme-provider";
import "@/styles/globals.css";
import { type Metadata } from "next";
import { Nunito } from "next/font/google";

export const metadata: Metadata = {
  title: `ClassClarus - App`,
  description: `ClassClarus offers various tools and worksheet generators to help teachers create engaging and effective learning materials for their students.`,
  keywords: `ClassClarus, teacher tools, worksheet generator, education, classroom resources`,
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${nunito.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
