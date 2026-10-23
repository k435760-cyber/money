import {
  BriefcaseBusiness,
  Bus,
  Clapperboard,
  Coffee,
  Coins,
  Ellipsis,
  HeartPulse,
  House,
  ShoppingBag,
  Utensils,
} from "lucide-react";
import type { Category } from "../lib/book";

const icons = {
  food: Utensils,
  cafe: Coffee,
  shopping: ShoppingBag,
  transport: Bus,
  living: House,
  culture: Clapperboard,
  health: HeartPulse,
  other: Ellipsis,
  salary: BriefcaseBusiness,
  extra: Coins,
};
export function CategoryIcon({
  category,
  size = 19,
}: {
  category: Category;
  size?: number;
}) {
  const Icon = icons[category];
  return <Icon size={size} strokeWidth={1.6} aria-hidden="true" />;
}
export function Brand({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand ${small ? "brand-small" : ""}`}>
      <svg viewBox="0 0 38 38" aria-hidden="true">
        <path
          d="M9 29V8m0 14c11-13 20-6 20 2v5"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <circle cx="31" cy="8" r="3.2" fill="currentColor" />
      </svg>
      <span>
        한푼<span className="brand-dot">.</span>
      </span>
    </span>
  );
}
export function Sprout({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 220 150"
      fill="none"
      aria-hidden="true"
    >
      <ellipse cx="111" cy="130" rx="67" ry="7" fill="#dce1ce" />
      <path
        d="M75 94h72l-10 30c-1 4-7 7-12 7H97c-5 0-11-3-12-7L75 94Z"
        fill="#c8d0b5"
        stroke="#67764f"
        strokeWidth="1.6"
      />
      <path
        d="M72 91c0-3 3-5 6-5h67c4 0 6 2 6 5v5H72v-5Z"
        fill="#e1e5d3"
        stroke="#67764f"
        strokeWidth="1.6"
      />
      <path
        d="M111 86c-3-27 1-43 14-63m-15 48c-13-13-20-25-20-41m25 24c13-4 25-13 32-25"
        stroke="#67764f"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M120 36c-1-17 11-25 26-26-3 15-10 26-26 26Z"
        fill="#92a170"
        stroke="#67764f"
        strokeWidth="1.2"
      />
      <path
        d="M109 65C87 65 74 51 72 36c22 1 35 10 37 29Z"
        fill="#b5c095"
        stroke="#67764f"
        strokeWidth="1.2"
      />
      <path
        d="M127 48c9-17 23-21 41-16-9 16-22 22-41 16Z"
        fill="#b5c095"
        stroke="#67764f"
        strokeWidth="1.2"
      />
      <path
        d="M90 43c-15-2-22-12-22-24 16 1 24 9 22 24Z"
        fill="#d3d9bf"
        stroke="#67764f"
        strokeWidth="1.2"
      />
      <circle
        cx="58"
        cy="114"
        r="12"
        fill="#e8d5af"
        stroke="#a88f65"
        strokeWidth="1.3"
      />
      <path
        d="M58 108v12m-3-9h6m-6 6h6"
        stroke="#a88f65"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="m167 76 3 4 5-1-3 4 1 5-4-3-4 2 1-5-3-3 5-1-1-2Z"
        fill="#c4b38c"
      />
    </svg>
  );
}
export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.52h3.24c1.9-1.75 2.98-4.32 2.98-7.37Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.4l-3.24-2.52c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.6-4.12H3.05v2.6A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.4 13.92A6 6 0 0 1 6.08 12c0-.67.11-1.32.32-1.92v-2.6H3.05A10 10 0 0 0 2 12c0 1.61.38 3.14 1.05 4.52l3.35-2.6Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.96c1.47 0 2.79.51 3.83 1.5l2.87-2.88A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.48l3.35 2.6C7.2 7.72 9.4 5.96 12 5.96Z"
      />
    </svg>
  );
}
