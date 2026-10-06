"use client";
import { DropdownMenu } from "radix-ui";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Button } from "./button";

/** Loaded on first interaction, so every page avoids the menu runtime at startup. */
export default function ThemeMenu({ label }: { label: string }) {
  const t = useTranslations("theme");
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <DropdownMenu.Root defaultOpen>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label={label}>
          {resolvedTheme === "dark" ? <Moon /> : <Sun />}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          onFocus={(event) => {
            if (event.target === event.currentTarget)
              event.currentTarget
                .querySelector<HTMLElement>('[role="menuitemradio"]')
                ?.focus();
          }}
          align="end"
          sideOffset={8}
          className="z-50 min-w-44 rounded-xl border bg-surface-raised p-1.5 text-sm shadow-lift"
        >
          <DropdownMenu.RadioGroup value={theme} onValueChange={setTheme}>
            {(
              [
                { value: "light", Icon: Sun },
                { value: "dark", Icon: Moon },
                { value: "system", Icon: Monitor },
              ] as const
            ).map(({ value, Icon }) => (
              <DropdownMenu.RadioItem
                key={value}
                value={value}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 outline-none data-[highlighted]:bg-muted"
              >
                <Icon size={17} />
                {t(value)}
                <DropdownMenu.ItemIndicator className="ml-auto">
                  <Check size={16} />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
