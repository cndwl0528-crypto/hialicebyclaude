'use client';

/**
 * BookCoverIllustration — Generates themed SVG illustrations for book covers
 * based on book metadata (synopsis, themes, characters, emotional_keywords).
 *
 * When Canva MCP or external image URLs are available, falls back to <Image>.
 * Otherwise renders a rich SVG scene per book.
 */

// ── Level‑based color palettes (Ghibli‑inspired) ──────────────────────────
const LEVEL_PALETTES = {
  Beginner: {
    sky: '#E8F5E9',
    ground: '#C8E6C9',
    accent: '#66BB6A',
    warm: '#FFCC80',
    highlight: '#FFF9C4',
  },
  Intermediate: {
    sky: '#E3F2FD',
    ground: '#BBDEFB',
    accent: '#42A5F5',
    warm: '#FFB74D',
    highlight: '#FFF3E0',
  },
  Advanced: {
    sky: '#EDE7F6',
    ground: '#D1C4E9',
    accent: '#7E57C2',
    warm: '#FF8A65',
    highlight: '#FCE4EC',
  },
};

// ── Per-book illustration scene definitions ────────────────────────────────
const BOOK_SCENES = {
  'The Very Hungry Caterpillar': ({ p }) => (
    <g>
      {/* Sun */}
      <circle cx="280" cy="40" r="30" fill={p.warm} opacity="0.8" />
      {/* Leaf */}
      <ellipse cx="150" cy="130" rx="90" ry="30" fill={p.accent} transform="rotate(-15 150 130)" />
      <line x1="150" y1="100" x2="150" y2="160" stroke="#388E3C" strokeWidth="2" />
      {/* Caterpillar body */}
      {[0, 1, 2, 3, 4].map((i) => (
        <circle
          key={i}
          cx={100 + i * 22}
          cy={110 - Math.sin(i * 0.8) * 8}
          r={i === 0 ? 14 : 12}
          fill={i === 0 ? '#D32F2F' : '#66BB6A'}
          stroke="#2E7D32"
          strokeWidth="1.5"
        />
      ))}
      {/* Caterpillar eyes */}
      <circle cx="98" cy="106" r="3" fill="white" />
      <circle cx="98" cy="106" r="1.5" fill="#1B5E20" />
      {/* Antennae */}
      <line x1="94" y1="97" x2="86" y2="82" stroke="#2E7D32" strokeWidth="1.5" />
      <line x1="104" y1="97" x2="112" y2="82" stroke="#2E7D32" strokeWidth="1.5" />
      <circle cx="86" cy="82" r="2.5" fill={p.warm} />
      <circle cx="112" cy="82" r="2.5" fill={p.warm} />
      {/* Fruits */}
      <circle cx="220" cy="80" r="14" fill="#F44336" /> {/* Apple */}
      <rect x="218" y="62" width="3" height="8" rx="1" fill="#5D4037" />
      <ellipse cx="250" cy="95" rx="10" ry="13" fill="#FBC02D" /> {/* Pear */}
      <circle cx="275" cy="85" r="8" fill="#E040FB" /> {/* Plum */}
      {/* Butterfly hint */}
      <g transform="translate(260, 35) scale(0.5)" opacity="0.6">
        <ellipse cx="0" cy="0" rx="18" ry="12" fill="#FF8A65" transform="rotate(-30)" />
        <ellipse cx="0" cy="0" rx="18" ry="12" fill="#FFB74D" transform="rotate(30)" />
        <ellipse cx="0" cy="0" rx="2" ry="8" fill="#5D4037" />
      </g>
      {/* Grass */}
      {Array.from({ length: 15 }, (_, i) => (
        <line
          key={`g${i}`}
          x1={20 + i * 22}
          y1="160"
          x2={20 + i * 22 + (i % 2 ? 4 : -4)}
          y2={145 + (i % 3) * 5}
          stroke="#388E3C"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}
    </g>
  ),

  "Charlotte's Web": ({ p }) => (
    <g>
      {/* Moon */}
      <circle cx="270" cy="35" r="22" fill={p.highlight} opacity="0.9" />
      {/* Barn */}
      <rect x="20" y="75" width="120" height="85" rx="4" fill="#8D6E63" />
      <polygon points="80,30 20,75 140,75" fill="#A1887F" />
      <rect x="60" y="110" width="30" height="50" rx="2" fill="#5D4037" />
      {/* Web */}
      <g stroke="#BDBDBD" strokeWidth="0.8" fill="none" opacity="0.7">
        <circle cx="220" cy="80" r="20" />
        <circle cx="220" cy="80" r="40" />
        <circle cx="220" cy="80" r="55" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <line
            key={a}
            x1="220"
            y1="80"
            x2={220 + Math.cos((a * Math.PI) / 180) * 55}
            y2={80 + Math.sin((a * Math.PI) / 180) * 55}
          />
        ))}
      </g>
      {/* Spider Charlotte */}
      <circle cx="220" cy="80" r="5" fill="#424242" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line
          key={`l${a}`}
          x1="220"
          y1="80"
          x2={220 + Math.cos((a * Math.PI) / 180) * 12}
          y2={80 + Math.sin((a * Math.PI) / 180) * 12}
          stroke="#424242"
          strokeWidth="1.2"
        />
      ))}
      {/* Wilbur the pig */}
      <ellipse cx="85" cy="140" rx="22" ry="16" fill="#F8BBD0" />
      <circle cx="70" cy="132" r="10" fill="#F8BBD0" />
      <ellipse cx="67" cy="135" rx="5" ry="4" fill="#F48FB1" />
      <circle cx="66" cy="130" r="2" fill="#1B5E20" />
      {/* Pig ears */}
      <ellipse cx="62" cy="124" rx="5" ry="7" fill="#F48FB1" transform="rotate(-20 62 124)" />
      <ellipse cx="78" cy="124" rx="5" ry="7" fill="#F48FB1" transform="rotate(20 78 124)" />
      {/* Stars */}
      {[
        [180, 25],
        [240, 15],
        [300, 40],
      ].map(([x, y], i) => (
        <text key={i} x={x} y={y} fill={p.warm} fontSize="8" opacity="0.6">
          ✦
        </text>
      ))}
    </g>
  ),

  'A Wrinkle in Time': ({ p }) => (
    <g>
      {/* Deep space background gradient overlay */}
      <rect x="0" y="0" width="320" height="170" fill="url(#spaceGrad)" opacity="0.3" />
      <defs>
        <radialGradient id="spaceGrad" cx="50%" cy="50%">
          <stop offset="0%" stopColor={p.accent} stopOpacity="0.4" />
          <stop offset="100%" stopColor={p.sky} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Stars */}
      {Array.from({ length: 30 }, (_, i) => (
        <circle
          key={i}
          cx={10 + ((i * 97) % 300)}
          cy={5 + ((i * 53) % 155)}
          r={0.5 + (i % 3) * 0.5}
          fill="white"
          opacity={0.4 + (i % 4) * 0.15}
        />
      ))}
      {/* Tesseract / Wormhole */}
      <g transform="translate(160, 80)">
        <circle r="45" fill="none" stroke={p.accent} strokeWidth="1.5" opacity="0.5" />
        <circle r="32" fill="none" stroke={p.warm} strokeWidth="1" opacity="0.6" />
        <circle r="18" fill="none" stroke={p.highlight} strokeWidth="1.5" opacity="0.7" />
        <circle r="6" fill={p.highlight} opacity="0.9" />
        {/* Swirl lines */}
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <line
            key={a}
            x1={Math.cos((a * Math.PI) / 180) * 18}
            y1={Math.sin((a * Math.PI) / 180) * 18}
            x2={Math.cos(((a + 15) * Math.PI) / 180) * 45}
            y2={Math.sin(((a + 15) * Math.PI) / 180) * 45}
            stroke={p.accent}
            strokeWidth="0.8"
            opacity="0.4"
          />
        ))}
      </g>
      {/* Girl silhouette */}
      <g transform="translate(70, 55)">
        <circle cx="0" cy="0" r="8" fill="#5D4037" /> {/* Head */}
        <rect x="-6" y="8" width="12" height="20" rx="3" fill="#5D4037" /> {/* Body */}
        <line x1="-6" y1="12" x2="-14" y2="22" stroke="#5D4037" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="6" y1="12" x2="14" y2="5" stroke="#5D4037" strokeWidth="2.5" strokeLinecap="round" /> {/* Reaching */}
        <rect x="-4" y="28" width="4" height="14" rx="2" fill="#5D4037" />
        <rect x="1" y="28" width="4" height="14" rx="2" fill="#5D4037" />
        {/* Hair */}
        <ellipse cx="-3" cy="-3" rx="10" ry="6" fill="#4E342E" />
      </g>
      {/* Planets */}
      <circle cx="280" cy="35" r="12" fill={p.warm} opacity="0.7" />
      <circle cx="282" cy="33" r="12" fill={p.sky} opacity="0.3" /> {/* Shadow */}
      <ellipse cx="280" cy="35" rx="20" ry="3" fill="none" stroke={p.warm} strokeWidth="0.8" opacity="0.5" />
      <circle cx="40" cy="130" r="8" fill={p.accent} opacity="0.5" />
    </g>
  ),
};

// ── Fallback generic scene ─────────────────────────────────────────────────
function GenericBookScene({ p, emoji }) {
  return (
    <g>
      <circle cx="160" cy="70" r="50" fill={p.accent} opacity="0.15" />
      <text x="160" y="90" textAnchor="middle" fontSize="48">
        {emoji || '📖'}
      </text>
    </g>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function BookCoverIllustration({ book, className = '' }) {
  const level = book.level || 'Beginner';
  const palette = LEVEL_PALETTES[level] || LEVEL_PALETTES.Beginner;

  // If the book has a real cover_image URL, use that instead of SVG
  if (book.cover_image) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <img
          src={book.cover_image}
          alt={`${book.title} cover illustration`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  // Look up a dedicated scene, else use generic
  const SceneFn = BOOK_SCENES[book.title];

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <svg
        viewBox="0 0 320 170"
        className="w-full h-full"
        role="img"
        aria-label={`${book.title} illustration`}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Sky */}
        <rect width="320" height="170" fill={palette.sky} />
        {/* Ground */}
        <ellipse cx="160" cy="185" rx="200" ry="40" fill={palette.ground} />

        {SceneFn ? (
          <SceneFn p={palette} />
        ) : (
          <GenericBookScene p={palette} emoji={book.cover} />
        )}
      </svg>

      {/* Subtle overlay gradient for text readability */}
      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
    </div>
  );
}
