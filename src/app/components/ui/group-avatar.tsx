const tones = [
  "bg-primary-soft text-primary-soft-foreground",
  "bg-accent-soft text-accent-soft-foreground",
  "bg-success-soft text-success",
  "bg-warning-soft text-warning",
  "bg-muted text-foreground",
  "bg-danger-soft text-danger",
];
export function GroupAvatar({ name }: { name: string }) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden="true"
      className={`flex size-12 shrink-0 items-center justify-center rounded-2xl text-xl font-bold ${tones[hash % tones.length]}`}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
