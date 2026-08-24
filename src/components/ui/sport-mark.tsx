import type { SportType } from "@/types/domain";
import { getSport } from "@/lib/sports";

interface SportMarkProps {
  sport: SportType;
  size?: number;
  className?: string;
}

/**
 * A recognisable piece of equipment per sport, drawn in that sport's identity
 * colour. Used anywhere a game needs to be identifiable at a glance.
 */
export const SportMark = ({ sport, size = 24, className }: SportMarkProps) => {
  const color = getSport(sport).color;
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 32 32",
    fill: "none",
    stroke: color,
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className
  };

  switch (sport) {
    case "football":
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="12.5" />
          <path d="m16 9.5 5.2 3.8-2 6.2h-6.4l-2-6.2Z" fill={color} fillOpacity="0.22" />
          <path d="M16 3.5v6M5.2 12.4l5.6 4.1M26.8 12.4l-5.6 4.1M10.3 27.4l2.5-7.9M21.7 27.4l-2.5-7.9" />
        </svg>
      );
    case "basketball":
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="12.5" />
          <path d="M16 3.5v25M3.5 16h25" />
          <path d="M7.2 7.2c4.8 4.4 4.8 13.2 0 17.6M24.8 7.2c-4.8 4.4-4.8 13.2 0 17.6" />
        </svg>
      );
    case "tennis":
      return (
        <svg {...common}>
          <ellipse cx="13" cy="12" rx="8" ry="9.5" transform="rotate(-30 13 12)" />
          <path d="m18.4 18.6 7.4 8.6" />
          <path d="M8.4 7.6c3.4 1.4 6.6 4.6 8.2 8.4M7.2 12.4c3 .8 6.4 3.4 8 6.6" strokeWidth="1.1" />
        </svg>
      );
    case "volleyball":
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="12.5" />
          <path d="M16 3.5c-4 5.6-4 15.4 0 21M3.9 12.6c6.2 2.4 13.6 8.2 16.6 14.6M28.1 12.6c-6.2 2.4-13.6 8.2-16.6 14.6" />
        </svg>
      );
    case "running":
      return (
        <svg {...common}>
          <circle cx="19.5" cy="6.5" r="3" />
          <path d="m6 27 4.4-7 4.6-3-1.6-6.4L9 13.4 5.5 12" />
          <path d="m13.4 10.6 5.4-2.2 3.6 5.6 4.6 1.4M15 17l4.4 3.4 1.4 6.6" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="12.5" />
          <path d="m16 8.8 2.2 4.6 5 .7-3.6 3.6.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.6 5-.7Z" fill={color} fillOpacity="0.22" />
        </svg>
      );
  }
};
