import { CircleHelp } from "lucide-react";

/** App logo: question mark in a circle — fits the “unknown knowledge” theme. */
export default function LogoMark({
  size = 18,
  color = "#fff",
}: {
  size?: number;
  color?: string;
}) {
  return <CircleHelp size={size} color={color} strokeWidth={2.25} aria-hidden />;
}
