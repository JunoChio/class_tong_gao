"use client";

import React from "react";
import { HomeworkTheme } from "@/types/board";

export function SubjectArt({ theme }: { theme: HomeworkTheme }) {
  switch (theme) {
    case "yellow":
      return (
        <svg viewBox="0 0 64 64" className="w-12 h-12 opacity-85" fill="none">
          <rect x="14" y="14" width="34" height="38" rx="6" fill="#FDE68A" />
          <rect x="18" y="10" width="32" height="38" rx="6" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="1.5" strokeOpacity="0.35" />
          <path d="M24 22H42M24 29H40M24 36H34" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.55" />
          <circle cx="44" cy="40" r="6" fill="#FBBF24" fillOpacity="0.6" />
        </svg>
      );
    case "green":
      return (
        <svg viewBox="0 0 64 64" className="w-12 h-12 opacity-85" fill="none">
          <rect x="16" y="18" width="32" height="34" rx="7" fill="#A7F3D0" />
          <rect x="20" y="14" width="24" height="8" rx="3" fill="#34D399" fillOpacity="0.7" />
          <path d="M24 30H40M24 37H38M24 44H33" stroke="#059669" strokeWidth="2.4" strokeLinecap="round" strokeOpacity="0.5" />
          <path d="M44 12L48 16L37 27L33 27L33 23L44 12Z" fill="#10B981" fillOpacity="0.75" />
        </svg>
      );
    case "blue":
      return (
        <svg viewBox="0 0 64 64" className="w-12 h-12 opacity-85" fill="none">
          <path d="M12 24L32 15L52 24L32 33L12 24Z" fill="#93C5FD" />
          <path d="M16 32L32 39L48 32V42C48 44 38 49 32 49C26 49 16 44 16 42V32Z" fill="#BFDBFE" />
          <circle cx="48" cy="36" r="4" fill="#60A5FA" fillOpacity="0.75" />
        </svg>
      );
    case "pink":
      return (
        <svg viewBox="0 0 64 64" className="w-12 h-12 opacity-85" fill="none">
          <rect x="14" y="14" width="36" height="36" rx="10" fill="#FBCFE8" />
          <path d="M32 22L34.9 28.1L41.6 29L36.7 33.7L37.9 40.3L32 37.1L26.1 40.3L27.3 33.7L22.4 29L29.1 28.1L32 22Z" fill="#F472B6" fillOpacity="0.7" />
        </svg>
      );
    case "purple":
      return (
        <svg viewBox="0 0 64 64" className="w-12 h-12 opacity-85" fill="none">
          <rect x="15" y="16" width="34" height="34" rx="9" fill="#DDD6FE" />
          <circle cx="32" cy="33" r="10" fill="#A78BFA" fillOpacity="0.55" />
          <path d="M32 27V33L36 35" stroke="#6D28D9" strokeWidth="2.4" strokeLinecap="round" strokeOpacity="0.6" />
        </svg>
      );
    case "orange":
    default:
      return (
        <svg viewBox="0 0 64 64" className="w-12 h-12 opacity-85" fill="none">
          <rect x="15" y="16" width="34" height="34" rx="9" fill="#FED7AA" />
          <path d="M23 36L29 28L35 33L42 24" stroke="#EA580C" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.65" />
          <circle cx="42" cy="24" r="3" fill="#FB923C" />
        </svg>
      );
  }
}
