"use client";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { Button } from "./button";
const subscribe = () => () => {};
export default function ThemeToggle({ label }: { label?: string }) {
  const t = useTranslations("theme");
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [Menu, setMenu] = useState<
    typeof import("./theme-menu").default | null
  >(null);
  if (Menu) return <Menu label={label || t("label")} />;
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label || t("label")}
      aria-haspopup="menu"
      aria-expanded={false}
      onClick={async () => {
        const { default: LoadedMenu } = await import("./theme-menu");
        setMenu(() => LoadedMenu);
      }}
    >
      {mounted && resolvedTheme === "dark" ? <Moon /> : <Sun />}
    </Button>
  );
}
