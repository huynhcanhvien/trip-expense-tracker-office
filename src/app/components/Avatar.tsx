// Colored initials avatar (legacy-inspired). Color is derived deterministically
// from the name, so we get consistent pastel avatars without storing a color.

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const letters = parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
  return letters || "?";
}

function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  return `hsl(${hash} 68% 80%)`;
}

export default function Avatar({ name, size }: { name: string; size?: "sm" | "lg" }) {
  return (
    <span
      className={"avatar" + (size ? ` ${size}` : "")}
      style={{ background: avatarColor(name) }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}
