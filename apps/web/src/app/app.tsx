import { ThemeProvider } from '@/app/theme-provider';
import { Header } from '@/components/layout/header';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { FormatterPage } from '@/features/formatter/presentation/formatter-page';

export function App() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
            <FormatterPage />
          </main>
          <footer className="border-t">
            <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
              <p>FormatJavascript · Formateo con Prettier</p>
              <p>React · Fastify · Clean Architecture</p>
            </div>
          </footer>
          <Toaster />
        </div>
      </TooltipProvider>
    </ThemeProvider>
  );
}
