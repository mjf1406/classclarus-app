import { Navbar } from "@/components/NavBar";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Navbar />
      <div className="flex w-full items-center justify-center">
        <div className="mt-5 flex w-full max-w-4xl flex-col items-center justify-center gap-10 px-6 sm:px-6 md:px-4 lg:min-w-3xl lg:px-0">
          {children}
        </div>
      </div>
    </>
  );
}
