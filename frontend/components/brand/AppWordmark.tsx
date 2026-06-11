import { APP_NAME } from "@/lib/brand";

/** Product title for headers and sidebar. */
export default function AppWordmark({
  size = "md",
}: {
  size?: "sm" | "md" | "lg";
}) {
  const fontSize = size === "lg" ? 22 : size === "sm" ? 13 : 15;
  const lineHeight = size === "sm" ? 1.3 : 1.25;

  return (
    <span
      style={{
        fontFamily: "var(--font-display)",
        fontSize,
        lineHeight,
        letterSpacing: "-0.02em",
        color: "var(--text-primary)",
        fontWeight: 500,
      }}
    >
      {APP_NAME}
    </span>
  );
}
