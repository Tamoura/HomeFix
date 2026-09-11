// Small inline SVG icons (24×24, stroke-based) used on the landing pages.
import { raw } from '../lib/html.js';

function icon(paths) {
  return raw(
    `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`,
  );
}

export const CATEGORY_ICONS = {
  plumbing: icon('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'),
  electrical: icon('<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>'),
  air_conditioning: icon('<path d="M9.59 4.59A2 2 0 1 1 11 8H2"/><path d="M12.59 19.41A2 2 0 1 0 14 16H2"/><path d="M17.73 7.73A2.5 2.5 0 1 1 19.5 12H2"/>'),
  painting: icon('<rect x="3" y="4" width="13" height="5" rx="1"/><path d="M16 6.5h3a2 2 0 0 1 2 2V11h-9v3"/><rect x="10" y="14" width="4" height="7" rx="1"/>'),
  carpentry: icon('<path d="M15 3l6 6-3 3-6-6z"/><path d="M12 6l-9 9 3 3 9-9"/>'),
  appliance_repair: icon('<rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="13" r="5"/><path d="M8 6h.01M11 6h4"/>'),
  roofing: icon('<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
  pest_control: icon('<path d="M8 2l1.5 2M16 2l-1.5 2"/><rect x="7" y="7" width="10" height="13" rx="5"/><path d="M12 7v13M3 12h4M17 12h4M4 19l3-2M20 19l-3-2M4 6l3 2M20 6l-3 2"/>'),
  cleaning: icon('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M5 18l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/><path d="M19 15l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5z"/>'),
  general: icon('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>'),
};

export const BENEFIT_ICONS = [
  icon('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'),
  icon('<path d="M12 3v18"/><path d="M5 7h14"/><path d="M3 15l3-8 3 8a3 3 0 0 1-6 0z"/><path d="M15 15l3-8 3 8a3 3 0 0 1-6 0z"/>'),
  icon('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>'),
  icon('<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>'),
];

export const TECH_BENEFIT_ICONS = [
  icon('<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>'),
  icon('<circle cx="12" cy="12" r="9"/><path d="M14.5 9.5a2.5 2.5 0 0 0-5 0c0 2.5 5 2.5 5 5a2.5 2.5 0 0 1-5 0"/><path d="M12 6v1.5M12 16.5V18"/>'),
  icon('<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>'),
];

export function categoryIcon(key) {
  return CATEGORY_ICONS[key] ?? CATEGORY_ICONS.general;
}
