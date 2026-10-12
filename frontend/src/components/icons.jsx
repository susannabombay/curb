import React from "react";

// Small inline stroke icons shared across screens (24x24, currentColor).
function Icon({ children, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {children}
    </svg>
  );
}

export const BackIcon = () => <Icon><path d="M15 18l-6-6 6-6" /></Icon>;
export const ArrowIcon = () => <Icon><path d="M5 12h14M13 6l6 6-6 6" /></Icon>;
export const SearchIcon = () => <Icon><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></Icon>;
export const PinIcon = () => <Icon><path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></Icon>;
export const ClockIcon = () => <Icon><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>;
export const CheckIcon = () => <Icon strokeWidth="3"><path d="M5 12.5l4.5 4.5L19 7.5" /></Icon>;
export const AlertIcon = () => <Icon><path d="M12 3l9.5 17h-19L12 3z" /><path d="M12 10v4M12 17.5v.01" /></Icon>;
export const NavIcon = () => <Icon><polygon points="3 11 22 2 13 21 11 13 3 11" /></Icon>;
export const UserIcon = () => <Icon><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></Icon>;
export const CarIcon = () => (
  <Icon>
    <path d="M5 17H4a1 1 0 0 1-1-1v-3l2.2-5.1A2 2 0 0 1 7 6.7h10a2 2 0 0 1 1.8 1.2L21 13v3a1 1 0 0 1-1 1h-1" />
    <path d="M3 13h18M9.5 17h5" />
    <circle cx="7" cy="17" r="2" />
    <circle cx="17" cy="17" r="2" />
  </Icon>
);
export const CardIcon = () => <Icon><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18" /></Icon>;

export function LogoGlyph({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#2b1b00" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" fill="#2b1b00" stroke="none" />
    </svg>
  );
}
