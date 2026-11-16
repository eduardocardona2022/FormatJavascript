import { Braces, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/app/theme-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Braces className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight sm:text-base">
            FormatJavascript
          </p>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Prettier · Clean Architecture
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className="hidden sm:inline-flex">
            v1.0
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            title={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          >
            {isDark ? <Sun /> : <Moon />}
          </Button>
        </div>
      </div>
    </header>
  );
}
