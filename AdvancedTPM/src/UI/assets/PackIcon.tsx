import React, { useState } from 'react';

/**
 * PackIcon - renders an icon for an asset pack.
 *
 * Priority:
 *  1. If `iconUrl` is provided by the backend (preferred - resolved server-side via
 *     ImageSystem.GetThumbnail() or "Media/DLC/{name}.svg"), use it directly.
 *  2. Base Game (no pack / empty) → inline SVG city badge.
 *  3. Fallback: try to guess the DLC svg path from the pack name.
 *  4. If all img loads fail → inline SVG gold-star badge.
 *
 * Works for:
 *  - Official DLC / Region Packs  (Media/DLC/*.svg)
 *  - PDX Mod / user asset packs   (coui:// thumbnail URL from ImageSystem)
 *  - Base Game                    (inline SVG)
 */

// Map known DLC display-names → exact SVG filename stem (no extension)
const PACK_NAME_MAP: Record<string, string> = {
  'bridges & ports': 'BridgesAndPorts',
  'bridges and ports': 'BridgesAndPorts',
  'bridgesports': 'BridgesAndPorts',
  'san francisco': 'SanFranciscoSet',
  'san francisco set': 'SanFranciscoSet',
  'sanfranciscoset': 'SanFranciscoSet',
  'deluxe edition': 'DeluxeEdition',
  'deluxeedition': 'DeluxeEdition',
  'leisure venues': 'LeisureVenues',
  'leisurevenues': 'LeisureVenues',
  'beach properties': 'BeachProperties',
  'beachproperties': 'BeachProperties',
  'modern hearth': 'ModernHearth',
  'modernhearth': 'ModernHearth',
};

const BASE_NAMES = new Set(['', 'base game', 'basegame', 'city', 'all', 'base']);

interface PackIconProps {
  pack?: string;
  /** Resolved icon URL from backend (Media/DLC/*.svg for DLC, coui:// for mod packs). Empty string = not provided. */
  iconUrl?: string;
  size?: number;
  style?: React.CSSProperties;
}

const PackIcon: React.FC<PackIconProps> = ({ pack = 'Base Game', iconUrl, size = 18, style }) => {
  const p = (pack || 'Base Game').toLowerCase().trim();
  const isBase = BASE_NAMES.has(p);

  const [imgIndex, setImgIndex] = useState(0);

  // ── Base Game ─────────────────────────────────────────────────────────────
  if (isBase) {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" style={style} aria-label="Base Game">
        <circle cx="10" cy="10" r="8.5" fill="#344a5f" stroke="#a0b0c0" strokeWidth="1.2" />
        <path d="M6 13V9h8v4H6zm4-7.5L5.5 9h9L10 5.5z" fill="#a0b0c0" />
      </svg>
    );
  }

  // ── Build URL candidates ──────────────────────────────────────────────────
  // Candidate 0: backend-provided URL (preferred)
  // Candidate 1: name-based DLC SVG guess
  // Candidate 2: fallback inline SVG (rendered below)
  const candidates: string[] = [];

  if (iconUrl && iconUrl.trim() !== '') {
    candidates.push(iconUrl.trim());
  }

  // Name-based guess for DLC svgs
  const mapped = PACK_NAME_MAP[p];
  const dlcStem = mapped ?? pack.replace(/[^a-zA-Z0-9]/g, '');
  const guessedUrl = `Media/DLC/${dlcStem}.svg`;
  // Only add guess if it's different from the iconUrl already in candidates
  if (!candidates.includes(guessedUrl)) {
    candidates.push(guessedUrl);
  }

  // ── Try img candidates ────────────────────────────────────────────────────
  if (imgIndex < candidates.length) {
    return (
      <img
        src={candidates[imgIndex]}
        width={size}
        height={size}
        style={{ ...style, objectFit: 'contain' }}
        onError={() => setImgIndex(i => i + 1)}
        alt={pack}
      />
    );
  }

  // ── Inline SVG fallbacks ──────────────────────────────────────────────────
  const isDlc = p.includes('dlc') || p.includes('deluxe') || p.includes('san francisco')
    || p.includes('bridge') || p.includes('port') || p.includes('beach')
    || p.includes('leisure') || p.includes('hearth');

  if (isDlc) {
    // Gold star — official paid DLC / region pack
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" style={style} aria-label={pack}>
        <circle cx="10" cy="10" r="8.5" fill="#194a80" stroke="#ffd024" strokeWidth="1.2" />
        <polygon points="10,4.5 11.6,8.2 15.6,8.2 12.3,10.6 13.5,14.5 10,12.2 6.5,14.5 7.7,10.6 4.4,8.2 8.4,8.2" fill="#ffd024" />
      </svg>
    );
  }

  // Puzzle-piece — PDX mod / custom user pack
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" style={style} aria-label={pack}>
      <circle cx="10" cy="10" r="8.5" fill="#2a3a55" stroke="#7ec8e3" strokeWidth="1.2" />
      <path d="M13 7h-1V6a1 1 0 0 0-2 0v1H9a1 1 0 0 0-1 1v1H7a1 1 0 1 0 0 2h1v1a1 1 0 0 0 1 1h1v1a1 1 0 0 0 2 0v-1h1a1 1 0 0 0 1-1v-1h1a1 1 0 1 0 0-2h-1V8a1 1 0 0 0-1-1z" fill="#7ec8e3" />
    </svg>
  );
};

export default PackIcon;
