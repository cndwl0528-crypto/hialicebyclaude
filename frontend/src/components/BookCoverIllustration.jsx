'use client';

import Image from 'next/image';

/**
 * BookCoverIllustration — Animated vertical 3:4 book covers for children ages 6-13.
 * Rich SVG illustrations with CSS animation classes defined in globals.css.
 *
 * Animation classes available:
 *   .svg-float       — gentle float up/down (3s)
 *   .svg-twinkle     — opacity pulse (2s)
 *   .svg-sway        — gentle rotation (4s)
 *   .svg-pulse-glow  — glow effect (3s)
 *   .svg-drift       — gentle drift movement (6s)
 *   .svg-spin-slow   — slow spin (12s)
 *   .svg-wiggle      — wiggle rotation (2s)
 *   .svg-crawl       — horizontal crawl (3s)
 *   .anim-delay-1 through .anim-delay-4 — staggered timing
 */

// ── Per-book cover design definitions ─────────────────────────────────────
const BOOK_COVERS = {

  // ── 1. The Very Hungry Caterpillar ──────────────────────────────────────
  'The Very Hungry Caterpillar': {
    gradient: ['#66BB6A', '#2E7D32'],
    accent: '#FFF9C4',
    illustration: (
      <g>
        {/* Sky clouds drifting */}
        <g className="svg-drift anim-delay-1" style={{ transformOrigin: 'center' }}>
          <ellipse cx="55" cy="70" rx="22" ry="10" fill="white" opacity="0.5" />
          <ellipse cx="45" cy="72" rx="14" ry="8" fill="white" opacity="0.4" />
          <ellipse cx="70" cy="72" rx="14" ry="8" fill="white" opacity="0.4" />
        </g>
        <g className="svg-drift anim-delay-3" style={{ transformOrigin: 'center' }}>
          <ellipse cx="185" cy="80" rx="20" ry="9" fill="white" opacity="0.4" />
          <ellipse cx="175" cy="82" rx="12" ry="7" fill="white" opacity="0.35" />
          <ellipse cx="198" cy="82" rx="12" ry="7" fill="white" opacity="0.35" />
        </g>

        {/* Sun with pulsing glow */}
        <g className="svg-pulse-glow" style={{ transformOrigin: '190px 60px' }}>
          <circle cx="190" cy="60" r="22" fill="#FFEE58" opacity="0.25" />
        </g>
        <circle cx="190" cy="60" r="15" fill="#FFD600" opacity="0.9" />
        {/* Sun rays */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <line
            key={a}
            x1={190 + Math.cos((a * Math.PI) / 180) * 17}
            y1={60 + Math.sin((a * Math.PI) / 180) * 17}
            x2={190 + Math.cos((a * Math.PI) / 180) * 24}
            y2={60 + Math.sin((a * Math.PI) / 180) * 24}
            stroke="#FFD600"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.8"
          />
        ))}

        {/* Big leaf with veins */}
        <g className="svg-sway anim-delay-1" style={{ transformOrigin: '120px 205px' }}>
          <ellipse cx="120" cy="205" rx="78" ry="26" fill="#66BB6A" transform="rotate(-8 120 205)" />
          <ellipse cx="120" cy="205" rx="78" ry="26" fill="#81C784" opacity="0.5" transform="rotate(-8 120 205)" />
          <line x1="60" y1="205" x2="180" y2="200" stroke="#388E3C" strokeWidth="1.8" opacity="0.7" />
          {[-5, 0, 5, 10, 15, 20].map((offset, i) => (
            <line
              key={i}
              x1={80 + i * 18}
              y1={207 - i}
              x2={80 + i * 18 + (i % 2 === 0 ? -10 : 10)}
              y2={199 - i}
              stroke="#388E3C"
              strokeWidth="0.8"
              opacity="0.5"
            />
          ))}
        </g>

        {/* Caterpillar crawling along the leaf */}
        <g className="svg-crawl" style={{ transformOrigin: 'center' }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <circle
              key={i}
              cx={72 + i * 22}
              cy={196 - Math.sin(i * 0.9) * 7}
              r={i === 0 ? 13 : 11}
              fill={i === 0 ? '#D32F2F' : (i % 2 === 0 ? '#A5D6A7' : '#81C784')}
              stroke="#2E7D32"
              strokeWidth="1.8"
            />
          ))}
          {/* Body stripes */}
          {[1, 2, 3, 4].map((i) => (
            <line
              key={i}
              x1={72 + i * 22 - 6}
              y1={192 - Math.sin(i * 0.9) * 7}
              x2={72 + i * 22 + 6}
              y2={192 - Math.sin(i * 0.9) * 7}
              stroke="#2E7D32"
              strokeWidth="1.2"
              opacity="0.4"
            />
          ))}
          {/* Head eye */}
          <circle cx="70" cy="192" r="3" fill="white" />
          <circle cx="70" cy="192" r="1.5" fill="#1B5E20" />
          {/* Antennae */}
          <line x1="66" y1="184" x2="58" y2="170" stroke="#2E7D32" strokeWidth="1.5" />
          <line x1="77" y1="184" x2="84" y2="170" stroke="#2E7D32" strokeWidth="1.5" />
          <circle cx="58" cy="170" r="3" fill="#FFCC80" />
          <circle cx="84" cy="170" r="3" fill="#FFCC80" />
          {/* Smile */}
          <path d="M 65 196 Q 70 200 75 196" fill="none" stroke="#1B5E20" strokeWidth="1.2" />
          {/* Tiny legs */}
          {[1, 2, 3, 4].map((i) => (
            <g key={i}>
              <line x1={72 + i * 22 - 5} y1={206 - Math.sin(i * 0.9) * 7} x2={72 + i * 22 - 8} y2={214} stroke="#2E7D32" strokeWidth="1" />
              <line x1={72 + i * 22 + 5} y1={206 - Math.sin(i * 0.9) * 7} x2={72 + i * 22 + 8} y2={214} stroke="#2E7D32" strokeWidth="1" />
            </g>
          ))}
        </g>

        {/* Fruits floating */}
        {/* Apple */}
        <g className="svg-float anim-delay-1" style={{ transformOrigin: '168px 148px' }}>
          <circle cx="168" cy="148" r="13" fill="#EF5350" />
          <path d="M 168 136 Q 172 130 177 133" fill="none" stroke="#388E3C" strokeWidth="1.5" />
          <ellipse cx="164" cy="144" rx="3" ry="4" fill="white" opacity="0.3" />
        </g>
        {/* Pear */}
        <g className="svg-float anim-delay-2" style={{ transformOrigin: '192px 162px' }}>
          <ellipse cx="192" cy="165" rx="9" ry="12" fill="#C8E6C9" />
          <ellipse cx="192" cy="157" rx="6" ry="7" fill="#A5D6A7" />
          <line x1="192" y1="150" x2="193" y2="144" stroke="#388E3C" strokeWidth="1.2" />
        </g>
        {/* Strawberry */}
        <g className="svg-float anim-delay-3" style={{ transformOrigin: '180px 133px' }}>
          <path d="M 180 143 Q 172 136 174 128 Q 180 122 186 128 Q 188 136 180 143 Z" fill="#EF5350" />
          {/* Seeds */}
          {[[-3, -4], [0, -6], [3, -4], [-4, -1], [4, -1]].map(([dx, dy], i) => (
            <ellipse key={i} cx={180 + dx} cy={135 + dy} rx="0.8" ry="1" fill="#B71C1C" opacity="0.5" />
          ))}
          <path d="M 176 126 Q 180 120 184 126" fill="none" stroke="#388E3C" strokeWidth="1" />
        </g>
        {/* Watermelon slice */}
        <g className="svg-float anim-delay-4" style={{ transformOrigin: '145px 165px' }}>
          <path d="M 132 170 Q 145 155 158 170 Z" fill="#4CAF50" />
          <path d="M 134 169 Q 145 157 156 169" fill="#F44336" stroke="none" />
          {[-5, 0, 5].map((dx, i) => (
            <ellipse key={i} cx={145 + dx} cy={165} rx="1" ry="1.5" fill="#1B5E20" opacity="0.6" />
          ))}
        </g>
        {/* Orange */}
        <g className="svg-float" style={{ transformOrigin: '205px 140px' }}>
          <circle cx="205" cy="140" r="8" fill="#FF9800" />
          <ellipse cx="202" cy="137" rx="2" ry="2.5" fill="white" opacity="0.25" />
          <line x1="205" y1="132" x2="206" y2="128" stroke="#388E3C" strokeWidth="1" />
        </g>

        {/* Butterfly fluttering */}
        <g className="svg-wiggle anim-delay-2" style={{ transformOrigin: '55px 130px' }}>
          <g transform="translate(55, 130) scale(0.85)" opacity="0.85">
            {/* Upper wings */}
            <ellipse cx="-12" cy="-6" rx="14" ry="9" fill="#FF7043" transform="rotate(-20 -12 -6)" />
            <ellipse cx="12" cy="-6" rx="14" ry="9" fill="#FF8A65" transform="rotate(20 12 -6)" />
            {/* Lower wings */}
            <ellipse cx="-9" cy="6" rx="10" ry="6" fill="#FFAB91" transform="rotate(20 -9 6)" />
            <ellipse cx="9" cy="6" rx="10" ry="6" fill="#FFCCBC" transform="rotate(-20 9 6)" />
            {/* Body */}
            <ellipse cx="0" cy="0" rx="2.5" ry="8" fill="#4E342E" />
            {/* Antennae */}
            <line x1="-1" y1="-7" x2="-5" y2="-14" stroke="#4E342E" strokeWidth="0.8" />
            <line x1="1" y1="-7" x2="5" y2="-14" stroke="#4E342E" strokeWidth="0.8" />
            <circle cx="-5" cy="-14" r="1.5" fill="#FFD54F" />
            <circle cx="5" cy="-14" r="1.5" fill="#FFD54F" />
          </g>
        </g>
        {/* Second small butterfly */}
        <g className="svg-wiggle anim-delay-4" style={{ transformOrigin: '30px 155px' }}>
          <g transform="translate(30, 155) scale(0.55)" opacity="0.7">
            <ellipse cx="-10" cy="-5" rx="12" ry="7" fill="#CE93D8" transform="rotate(-20 -10 -5)" />
            <ellipse cx="10" cy="-5" rx="12" ry="7" fill="#BA68C8" transform="rotate(20 10 -5)" />
            <ellipse cx="-7" cy="5" rx="8" ry="5" fill="#E1BEE7" transform="rotate(20 -7 5)" />
            <ellipse cx="7" cy="5" rx="8" ry="5" fill="#F3E5F5" transform="rotate(-20 7 5)" />
            <ellipse cx="0" cy="0" rx="2" ry="6" fill="#4E342E" />
          </g>
        </g>
      </g>
    ),
  },

  // ── 2. Where the Wild Things Are ────────────────────────────────────────
  'Where the Wild Things Are': {
    gradient: ['#1A237E', '#311B92'],
    accent: '#FFCC80',
    illustration: (
      <g>
        {/* Night sky with glowing moon */}
        <g className="svg-pulse-glow anim-delay-1" style={{ transformOrigin: '175px 75px' }}>
          <circle cx="175" cy="75" r="38" fill="#FFF9C4" opacity="0.18" />
        </g>
        <circle cx="175" cy="75" r="26" fill="#FFF9C4" opacity="0.92" />
        <circle cx="183" cy="70" r="26" fill="#1A237E" opacity="0.55" />
        {/* Moon texture craters */}
        <circle cx="168" cy="72" r="3" fill="#EEE8AA" opacity="0.4" />
        <circle cx="178" cy="82" r="2" fill="#EEE8AA" opacity="0.3" />

        {/* Stars twinkling */}
        {[
          [30, 50], [55, 35], [80, 55], [100, 40], [130, 30],
          [155, 48], [210, 40], [220, 65], [200, 95], [15, 80],
          [45, 95], [210, 115], [25, 120],
        ].map(([x, y], i) => (
          <circle
            key={i}
            cx={x} cy={y}
            r={1 + (i % 2) * 0.5}
            fill="white"
            opacity={0.4 + (i % 3) * 0.2}
            className={`svg-twinkle anim-delay-${(i % 4) + 1}`}
          />
        ))}

        {/* Fireflies twinkling around */}
        {[[60, 155], [100, 148], [42, 175], [210, 170], [195, 150], [80, 230]].map(([x, y], i) => (
          <g key={i} className={`svg-twinkle anim-delay-${(i % 4) + 1}`}>
            <circle cx={x} cy={y} r="2.5" fill="#FFEE58" opacity="0.7" />
            <circle cx={x} cy={y} r="5" fill="#FFEE58" opacity="0.15" />
          </g>
        ))}

        {/* Left tree — swaying */}
        <g className="svg-sway" style={{ transformOrigin: '48px 230px' }}>
          <rect x="40" y="175" width="14" height="70" rx="4" fill="#4E342E" />
          <ellipse cx="48" cy="162" rx="32" ry="38" fill="#1B5E20" opacity="0.85" />
          <ellipse cx="38" cy="175" rx="18" ry="22" fill="#2E7D32" opacity="0.7" />
          <ellipse cx="60" cy="172" rx="16" ry="20" fill="#388E3C" opacity="0.6" />
          {/* Leaves drifting down */}
          {[[38, 210], [55, 220], [28, 228]].map(([x, y], i) => (
            <g key={i} className={`svg-drift anim-delay-${i + 1}`} style={{ transformOrigin: `${x}px ${y}px` }}>
              <ellipse cx={x} cy={y} rx="4" ry="2.5" fill="#388E3C" opacity="0.7" transform={`rotate(${i * 30})`} />
            </g>
          ))}
        </g>

        {/* Right tree — swaying with delay */}
        <g className="svg-sway anim-delay-2" style={{ transformOrigin: '198px 235px' }}>
          <rect x="191" y="185" width="12" height="60" rx="3" fill="#4E342E" />
          <ellipse cx="197" cy="173" rx="26" ry="32" fill="#2E7D32" opacity="0.8" />
          <ellipse cx="210" cy="182" rx="15" ry="18" fill="#388E3C" opacity="0.65" />
        </g>

        {/* Water/ground */}
        <ellipse cx="120" cy="265" rx="100" ry="18" fill="#0D47A1" opacity="0.5" />
        {/* Boat on water */}
        <g className="svg-float anim-delay-2" style={{ transformOrigin: '120px 260px' }}>
          <path d="M 95 262 Q 120 255 145 262 L 140 272 L 100 272 Z" fill="#8D6E63" />
          <line x1="120" y1="262" x2="120" y2="245" stroke="#5D4037" strokeWidth="2" />
          <path d="M 120 245 L 138 255 L 120 258 Z" fill="#FFCDD2" opacity="0.8" />
        </g>

        {/* Wild Thing — main character */}
        <g className="svg-wiggle anim-delay-1" style={{ transformOrigin: '118px 185px' }}>
          <g transform="translate(118, 195)">
            {/* Body */}
            <ellipse cx="0" cy="8" rx="24" ry="28" fill="#5D4037" />
            {/* Belly */}
            <ellipse cx="0" cy="10" rx="14" ry="18" fill="#795548" opacity="0.5" />
            {/* Head */}
            <circle cx="0" cy="-18" r="20" fill="#5D4037" />
            {/* Horns */}
            <polygon points="-12,-34 -7,-18 -17,-18" fill="#8D6E63" />
            <polygon points="12,-34 7,-18 17,-18" fill="#8D6E63" />
            {/* Eyes glowing */}
            <g className="svg-pulse-glow" style={{ transformOrigin: '-7px -22px' }}>
              <circle cx="-7" cy="-22" r="6" fill="#FFF9C4" opacity="0.7" />
            </g>
            <g className="svg-pulse-glow anim-delay-1" style={{ transformOrigin: '7px -22px' }}>
              <circle cx="7" cy="-22" r="6" fill="#FFF9C4" opacity="0.7" />
            </g>
            <circle cx="-7" cy="-22" r="5" fill="#FFF9C4" />
            <circle cx="7" cy="-22" r="5" fill="#FFF9C4" />
            <circle cx="-7" cy="-22" r="2.5" fill="#1B5E20" />
            <circle cx="7" cy="-22" r="2.5" fill="#1B5E20" />
            {/* Nostrils */}
            <circle cx="-3" cy="-13" r="1.5" fill="#4E342E" />
            <circle cx="3" cy="-13" r="1.5" fill="#4E342E" />
            {/* Claws */}
            <line x1="-20" y1="0" x2="-28" y2="-6" stroke="#5D4037" strokeWidth="3" strokeLinecap="round" />
            <line x1="-22" y1="4" x2="-30" y2="0" stroke="#5D4037" strokeWidth="3" strokeLinecap="round" />
            <line x1="20" y1="0" x2="28" y2="-6" stroke="#5D4037" strokeWidth="3" strokeLinecap="round" />
            <line x1="22" y1="4" x2="30" y2="0" stroke="#5D4037" strokeWidth="3" strokeLinecap="round" />
            {/* Tail */}
            <path d="M 0 36 Q 30 50 20 70" fill="none" stroke="#5D4037" strokeWidth="5" strokeLinecap="round" />
          </g>
        </g>
      </g>
    ),
  },

  // ── 3. Charlotte's Web ───────────────────────────────────────────────────
  "Charlotte's Web": {
    gradient: ['#4E342E', '#3E2723'],
    accent: '#F8BBD0',
    illustration: (
      <g>
        {/* Night sky */}
        {[
          [25, 45], [60, 30], [95, 50], [130, 35], [160, 45],
          [200, 30], [220, 55], [15, 75], [210, 80],
        ].map(([x, y], i) => (
          <circle
            key={i}
            cx={x} cy={y}
            r={1 + (i % 2) * 0.6}
            fill="white"
            opacity={0.5 + (i % 3) * 0.15}
            className={`svg-twinkle anim-delay-${(i % 4) + 1}`}
          />
        ))}

        {/* Barn structure */}
        <rect x="40" y="148" width="140" height="105" rx="3" fill="#8D6E63" />
        <polygon points="110,102 40,148 180,148" fill="#A1887F" />
        {/* Barn door */}
        <rect x="83" y="190" width="32" height="63" rx="2" fill="#6D4C41" />
        <line x1="99" y1="190" x2="99" y2="253" stroke="#5D4037" strokeWidth="1.2" />
        {/* Barn window — glowing warm */}
        <rect x="48" y="165" width="28" height="22" rx="2" fill="#FFD54F" opacity="0.7" />
        <g className="svg-pulse-glow anim-delay-2" style={{ transformOrigin: '62px 176px' }}>
          <rect x="48" y="165" width="28" height="22" rx="2" fill="#FFEE58" opacity="0.3" />
        </g>
        <line x1="62" y1="165" x2="62" y2="187" stroke="#8D6E63" strokeWidth="1" />
        <line x1="48" y1="176" x2="76" y2="176" stroke="#8D6E63" strokeWidth="1" />
        {/* Right window */}
        <rect x="143" y="165" width="28" height="22" rx="2" fill="#FFD54F" opacity="0.65" />
        <g className="svg-pulse-glow anim-delay-4" style={{ transformOrigin: '157px 176px' }}>
          <rect x="143" y="165" width="28" height="22" rx="2" fill="#FFEE58" opacity="0.25" />
        </g>
        <line x1="157" y1="165" x2="157" y2="187" stroke="#8D6E63" strokeWidth="1" />
        <line x1="143" y1="176" x2="171" y2="176" stroke="#8D6E63" strokeWidth="1" />

        {/* Spider web — Charlotte's web */}
        <g className="svg-sway" style={{ transformOrigin: '175px 120px' }}>
          <g stroke="white" strokeWidth="0.6" fill="none" opacity="0.55">
            {[12, 24, 36, 48].map((r) => (
              <circle key={r} cx="175" cy="120" r={r} />
            ))}
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => (
              <line
                key={a}
                x1="175" y1="120"
                x2={175 + Math.cos((a * Math.PI) / 180) * 48}
                y2={120 + Math.sin((a * Math.PI) / 180) * 48}
              />
            ))}
          </g>
          {/* Dewdrops on web */}
          {[
            [175 + Math.cos(0) * 24, 120 + Math.sin(0) * 24],
            [175 + Math.cos((60 * Math.PI) / 180) * 36, 120 + Math.sin((60 * Math.PI) / 180) * 36],
            [175 + Math.cos((150 * Math.PI) / 180) * 24, 120 + Math.sin((150 * Math.PI) / 180) * 24],
            [175 + Math.cos((240 * Math.PI) / 180) * 36, 120 + Math.sin((240 * Math.PI) / 180) * 36],
            [175 + Math.cos((300 * Math.PI) / 180) * 12, 120 + Math.sin((300 * Math.PI) / 180) * 12],
          ].map(([x, y], i) => (
            <circle
              key={i}
              cx={x} cy={y}
              r="2.5"
              fill="#B3E5FC"
              opacity="0.7"
              className={`svg-twinkle anim-delay-${(i % 4) + 1}`}
            />
          ))}
          {/* Charlotte the spider swaying on web */}
          <g className="svg-wiggle anim-delay-1" style={{ transformOrigin: '175px 120px' }}>
            <circle cx="175" cy="120" r="5.5" fill="white" opacity="0.95" />
            {/* Spider legs */}
            {[-40, -20, 20, 40].map((a, i) => (
              <g key={i}>
                <line x1="175" y1="120"
                  x2={175 + Math.cos(((a - 90) * Math.PI) / 180) * 14}
                  y2={120 + Math.sin(((a - 90) * Math.PI) / 180) * 14}
                  stroke="white" strokeWidth="1" opacity="0.8"
                />
                <line x1="175" y1="120"
                  x2={175 + Math.cos(((a + 90) * Math.PI) / 180) * 14}
                  y2={120 + Math.sin(((a + 90) * Math.PI) / 180) * 14}
                  stroke="white" strokeWidth="1" opacity="0.8"
                />
              </g>
            ))}
          </g>
          {/* "SOME PIG" text in web */}
          <text x="175" y="80" textAnchor="middle" fill="white" fontSize="5.5" fontFamily="Georgia, serif" opacity="0.55" letterSpacing="1">
            SOME PIG
          </text>
        </g>

        {/* Wilbur the pig wiggling */}
        <g className="svg-wiggle anim-delay-3" style={{ transformOrigin: '90px 215px' }}>
          <g transform="translate(90, 215)">
            {/* Body */}
            <ellipse cx="0" cy="5" rx="22" ry="15" fill="#F8BBD0" />
            {/* Head */}
            <circle cx="-18" cy="2" r="12" fill="#F8BBD0" />
            {/* Snout */}
            <ellipse cx="-25" cy="4" rx="6" ry="5" fill="#F48FB1" />
            <circle cx="-27" cy="4" r="1.5" fill="#C2185B" opacity="0.6" />
            <circle cx="-23" cy="4" r="1.5" fill="#C2185B" opacity="0.6" />
            {/* Eye */}
            <circle cx="-15" cy="-2" r="3" fill="white" />
            <circle cx="-15" cy="-2" r="1.5" fill="#3E2723" />
            {/* Ear */}
            <ellipse cx="-14" cy="-12" rx="5" ry="7" fill="#F48FB1" transform="rotate(10 -14 -12)" />
            {/* Tail */}
            <path d="M 22 0 Q 32 -5 30 5 Q 28 12 35 10" fill="none" stroke="#F48FB1" strokeWidth="2.5" strokeLinecap="round" />
            {/* Legs */}
            <rect x="-12" y="17" width="6" height="10" rx="3" fill="#F8BBD0" />
            <rect x="-2" y="17" width="6" height="10" rx="3" fill="#F8BBD0" />
            <rect x="8" y="17" width="6" height="10" rx="3" fill="#F8BBD0" />
          </g>
        </g>
      </g>
    ),
  },

  // ── 4. The Lion, the Witch and the Wardrobe ─────────────────────────────
  'The Lion, the Witch and the Wardrobe': {
    gradient: ['#0D47A1', '#1565C0'],
    accent: '#E3F2FD',
    illustration: (
      <g>
        {/* Falling snowflakes — multiple animated */}
        {Array.from({ length: 28 }, (_, i) => (
          <g
            key={i}
            className={`svg-drift anim-delay-${(i % 4) + 1}`}
            style={{ transformOrigin: `${15 + ((i * 67) % 210)}px ${60 + ((i * 43) % 180)}px` }}
          >
            <circle
              cx={15 + ((i * 67) % 210)}
              cy={60 + ((i * 43) % 180)}
              r={1.2 + (i % 3) * 0.6}
              fill="white"
              opacity={0.35 + (i % 3) * 0.2}
            />
            {/* Snowflake cross lines for larger ones */}
            {i % 5 === 0 && (
              <>
                <line
                  x1={15 + ((i * 67) % 210) - 3}
                  y1={60 + ((i * 43) % 180)}
                  x2={15 + ((i * 67) % 210) + 3}
                  y2={60 + ((i * 43) % 180)}
                  stroke="white" strokeWidth="0.7" opacity="0.5"
                />
                <line
                  x1={15 + ((i * 67) % 210)}
                  y1={60 + ((i * 43) % 180) - 3}
                  x2={15 + ((i * 67) % 210)}
                  y2={60 + ((i * 43) % 180) + 3}
                  stroke="white" strokeWidth="0.7" opacity="0.5"
                />
              </>
            )}
          </g>
        ))}

        {/* Snow ground */}
        <ellipse cx="120" cy="270" rx="120" ry="30" fill="white" opacity="0.25" />
        <ellipse cx="120" cy="275" rx="120" ry="20" fill="white" opacity="0.2" />

        {/* Wardrobe — slightly open with magical glow inside */}
        <rect x="72" y="115" width="80" height="120" rx="5" fill="#5D4037" />
        {/* Left door */}
        <rect x="76" y="119" width="34" height="112" rx="3" fill="#4E342E" />
        {/* Right door — slightly ajar */}
        <rect x="114" y="119" width="34" height="112" rx="3" fill="#4E342E" transform="rotate(-5 114 119)" />
        {/* Magical glow from inside wardrobe */}
        <g className="svg-pulse-glow anim-delay-2" style={{ transformOrigin: '112px 175px' }}>
          <rect x="110" y="119" width="8" height="112" fill="#B3E5FC" opacity="0.5" />
          <ellipse cx="112" cy="175" rx="12" ry="40" fill="#E1F5FE" opacity="0.35" />
        </g>
        {/* Wardrobe handles */}
        <circle cx="108" cy="175" r="3.5" fill="#D4A843" />
        <circle cx="115" cy="175" r="3.5" fill="#D4A843" />
        {/* Wardrobe top trim */}
        <rect x="68" y="110" width="88" height="10" rx="3" fill="#6D4C41" />
        {/* Wardrobe claw feet */}
        <rect x="75" y="233" width="12" height="8" rx="2" fill="#4E342E" />
        <rect x="135" y="233" width="12" height="8" rx="2" fill="#4E342E" />

        {/* Lamp post glowing */}
        <rect x="186" y="110" width="5" height="90" fill="#90A4AE" />
        <rect x="182" y="107" width="14" height="6" rx="2" fill="#78909C" />
        {/* Lamp glow pulse */}
        <g className="svg-pulse-glow anim-delay-1" style={{ transformOrigin: '189px 100px' }}>
          <circle cx="189" cy="100" r="20" fill="#FFF9C4" opacity="0.25" />
        </g>
        <circle cx="189" cy="100" r="11" fill="#FFF9C4" opacity="0.85" />
        <circle cx="189" cy="100" r="6" fill="#FFE082" />
        {/* Lamp light cone */}
        <path d="M 182 106 L 175 135 L 203 135 L 196 106 Z" fill="#FFF9C4" opacity="0.12" />

        {/* Lion — subtle scale pulse (breathing) */}
        <g className="svg-wiggle anim-delay-4" style={{ transformOrigin: '43px 200px' }}>
          <g transform="translate(43, 200)" opacity="0.75">
            {/* Mane */}
            <circle cx="-10" cy="-4" r="18" fill="#C49A30" opacity="0.5" />
            {/* Body */}
            <ellipse cx="10" cy="5" rx="22" ry="14" fill="#D4A843" />
            {/* Head */}
            <circle cx="-10" cy="-4" r="13" fill="#D4A843" />
            {/* Face */}
            <circle cx="-16" cy="-7" r="2.5" fill="#3E2723" />
            <circle cx="-4" cy="-7" r="2.5" fill="#3E2723" />
            <ellipse cx="-10" cy="-1" rx="4" ry="2.5" fill="#FFCCBC" opacity="0.6" />
            {/* Tail */}
            <path d="M 32 5 Q 40 -5 38 10 Q 36 18 44 16" fill="none" stroke="#D4A843" strokeWidth="3.5" strokeLinecap="round" />
            {/* Paws */}
            <ellipse cx="-2" cy="17" rx="6" ry="4" fill="#C49A30" />
            <ellipse cx="12" cy="18" rx="6" ry="4" fill="#C49A30" />
          </g>
        </g>

        {/* Icicles */}
        {[55, 75, 95, 115, 135, 155, 175].map((x, i) => (
          <polygon
            key={i}
            points={`${x},235 ${x + 4},235 ${x + 2},${245 + (i % 3) * 5}`}
            fill="white"
            opacity={0.4 + (i % 3) * 0.1}
          />
        ))}
      </g>
    ),
  },

  // ── 5. Magic Tree House: Dinosaurs Before Dark ───────────────────────────
  'Magic Tree House: Dinosaurs Before Dark': {
    gradient: ['#1B5E20', '#2E7D32'],
    accent: '#C8E6C9',
    illustration: (
      <g>
        {/* Sky through canopy */}
        <ellipse cx="120" cy="60" rx="110" ry="60" fill="#1565C0" opacity="0.3" />

        {/* Birds circling above */}
        {[[70, 45], [110, 35], [150, 48], [185, 38]].map(([x, y], i) => (
          <g key={i} className={`svg-drift anim-delay-${i + 1}`} style={{ transformOrigin: `${x}px ${y}px` }}>
            <path d={`M ${x - 7} ${y} Q ${x} ${y - 4} ${x + 7} ${y}`} fill="none" stroke="#90CAF9" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        ))}

        {/* Pterodactyl flying overhead */}
        <g className="svg-crawl anim-delay-2" style={{ transformOrigin: '120px 75px' }}>
          <g transform="translate(120, 75)">
            {/* Wings */}
            <path d="M -35 0 Q -20 -15 0 -5 Q 20 -15 35 0 Q 20 -5 0 2 Q -20 -5 -35 0 Z" fill="#4A148C" opacity="0.7" />
            {/* Body */}
            <ellipse cx="0" cy="-2" rx="6" ry="5" fill="#6A1B9A" opacity="0.8" />
            {/* Head crest */}
            <polygon points="0,-6 -3,-12 5,-8" fill="#4A148C" opacity="0.7" />
            {/* Beak */}
            <line x1="-6" y1="-3" x2="-18" y2="-5" stroke="#6A1B9A" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        </g>

        {/* Main tree trunk */}
        <rect x="93" y="95" width="34" height="145" rx="6" fill="#4E342E" />
        {/* Bark texture */}
        {[110, 130, 150, 170, 185].map((y, i) => (
          <line key={i} x1="96" y1={y} x2="124" y2={y + 5} stroke="#3E2723" strokeWidth="0.8" opacity="0.4" />
        ))}

        {/* Large foliage — swaying */}
        <g className="svg-sway" style={{ transformOrigin: '110px 100px' }}>
          <circle cx="110" cy="88" r="50" fill="#2E7D32" opacity="0.92" />
          <circle cx="82" cy="108" r="33" fill="#388E3C" opacity="0.85" />
          <circle cx="78" cy="88" r="25" fill="#43A047" opacity="0.7" />
        </g>
        <g className="svg-sway anim-delay-2" style={{ transformOrigin: '140px 100px' }}>
          <circle cx="142" cy="108" r="33" fill="#388E3C" opacity="0.85" />
          <circle cx="148" cy="88" r="25" fill="#43A047" opacity="0.7" />
          <circle cx="130" cy="78" r="28" fill="#2E7D32" opacity="0.8" />
        </g>

        {/* Treehouse platform */}
        <rect x="72" y="148" width="76" height="8" rx="2" fill="#6D4C41" />
        {/* Treehouse structure */}
        <rect x="76" y="120" width="68" height="32" rx="3" fill="#8D6E63" />
        <polygon points="110,102 73,123 147,123" fill="#A1887F" />
        {/* Roof shingles suggestion */}
        <line x1="85" y1="112" x2="110" y2="104" stroke="#8D6E63" strokeWidth="0.8" opacity="0.5" />
        <line x1="110" y1="104" x2="135" y2="112" stroke="#8D6E63" strokeWidth="0.8" opacity="0.5" />
        {/* Treehouse window glowing */}
        <rect x="103" y="128" width="14" height="12" rx="2" fill="#FFD54F" opacity="0.8" />
        <g className="svg-pulse-glow anim-delay-2" style={{ transformOrigin: '110px 134px' }}>
          <rect x="100" y="126" width="20" height="16" rx="3" fill="#FFEE58" opacity="0.3" />
        </g>
        {/* Tiny Jack and Annie in window */}
        <circle cx="107" cy="131" r="3" fill="#FFCCBC" />
        <circle cx="114" cy="131" r="3" fill="#FFCCBC" />
        {/* Treehouse door */}
        <rect x="98" y="137" width="10" height="15" rx="2" fill="#5D4037" />
        {/* Rope ladder */}
        <line x1="90" y1="156" x2="90" y2="200" stroke="#8D6E63" strokeWidth="1.5" />
        <line x1="100" y1="156" x2="100" y2="200" stroke="#8D6E63" strokeWidth="1.5" />
        {[160, 170, 180, 190].map((y) => (
          <line key={y} x1="90" y1={y} x2="100" y2={y} stroke="#8D6E63" strokeWidth="1.2" />
        ))}

        {/* Dinosaur (T-Rex style) walking */}
        <g className="svg-crawl anim-delay-1" style={{ transformOrigin: '180px 205px' }}>
          <g transform="translate(178, 210)" opacity="0.8">
            {/* Body */}
            <ellipse cx="0" cy="0" rx="28" ry="20" fill="#33691E" />
            {/* Neck and head */}
            <ellipse cx="-20" cy="-22" rx="10" ry="8" fill="#33691E" />
            <ellipse cx="-30" cy="-28" rx="14" ry="9" fill="#33691E" />
            {/* Eye */}
            <circle cx="-36" cy="-30" r="2.5" fill="#FFEE58" />
            <circle cx="-36" cy="-30" r="1.2" fill="#1B5E20" />
            {/* Teeth */}
            <line x1="-42" y1="-26" x2="-40" y2="-22" stroke="white" strokeWidth="1.2" />
            <line x1="-40" y1="-26" x2="-38" y2="-22" stroke="white" strokeWidth="1.2" />
            {/* Tail */}
            <path d="M 28 5 Q 45 0 50 15" fill="none" stroke="#33691E" strokeWidth="7" strokeLinecap="round" />
            {/* Tiny arms */}
            <line x1="-5" y1="-10" x2="-12" y2="-3" stroke="#33691E" strokeWidth="3" strokeLinecap="round" />
            {/* Legs */}
            <rect x="-8" y="17" width="10" height="16" rx="5" fill="#2E7D32" />
            <rect x="8" y="17" width="10" height="16" rx="5" fill="#2E7D32" />
          </g>
        </g>

        {/* Swaying leaves falling */}
        {[[55, 165], [170, 178], [35, 195], [215, 160]].map(([x, y], i) => (
          <g key={i} className={`svg-drift anim-delay-${i + 1}`} style={{ transformOrigin: `${x}px ${y}px` }}>
            <ellipse cx={x} cy={y} rx="5" ry="3" fill="#66BB6A" opacity="0.6" transform={`rotate(${i * 40})`} />
          </g>
        ))}
      </g>
    ),
  },

  // ── 6. A Wrinkle in Time ─────────────────────────────────────────────────
  'A Wrinkle in Time': {
    gradient: ['#1A237E', '#4A148C'],
    accent: '#CE93D8',
    illustration: (
      <g>
        {/* Nebula / cosmic atmosphere */}
        <ellipse cx="80" cy="140" rx="70" ry="60" fill="#7B1FA2" opacity="0.12" />
        <ellipse cx="170" cy="130" rx="55" ry="50" fill="#1565C0" opacity="0.12" />
        <ellipse cx="120" cy="180" rx="80" ry="50" fill="#4A148C" opacity="0.18" />

        {/* Stars twinkling at different rates */}
        {Array.from({ length: 55 }, (_, i) => (
          <circle
            key={i}
            cx={5 + ((i * 79) % 230)}
            cy={10 + ((i * 53) % 240)}
            r={0.4 + (i % 4) * 0.45}
            fill={i % 5 === 0 ? '#CE93D8' : i % 7 === 0 ? '#80DEEA' : 'white'}
            opacity={0.2 + (i % 5) * 0.15}
            className={`svg-twinkle anim-delay-${(i % 4) + 1}`}
          />
        ))}

        {/* Cosmic swirl lines */}
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <path
            key={a}
            d={`M 120 160 Q ${120 + Math.cos((a * Math.PI) / 180) * 60} ${160 + Math.sin((a * Math.PI) / 180) * 60} ${120 + Math.cos(((a + 30) * Math.PI) / 180) * 90} ${160 + Math.sin(((a + 30) * Math.PI) / 180) * 90}`}
            fill="none"
            stroke="#CE93D8"
            strokeWidth="0.5"
            opacity="0.2"
          />
        ))}

        {/* Tesseract rotating slowly */}
        <g className="svg-spin-slow" style={{ transformOrigin: '120px 160px' }}>
          <g transform="translate(120, 160)">
            {/* Outer cube edges */}
            <polygon points="0,-46 40,-23 40,23 0,46 -40,23 -40,-23" fill="none" stroke="#CE93D8" strokeWidth="1.2" opacity="0.5" />
            <polygon points="0,-28 24,-14 24,14 0,28 -24,14 -24,-14" fill="none" stroke="#B39DDB" strokeWidth="1" opacity="0.6" />
            {/* Inner connections */}
            {[0, 60, 120, 180, 240, 300].map((a) => (
              <line
                key={a}
                x1={Math.cos((a * Math.PI) / 180) * 28}
                y1={Math.sin((a * Math.PI) / 180) * 28}
                x2={Math.cos(((a + 30) * Math.PI) / 180) * 46}
                y2={Math.sin(((a + 30) * Math.PI) / 180) * 46}
                stroke="#CE93D8"
                strokeWidth="0.7"
                opacity="0.45"
              />
            ))}
            {/* Core glow */}
            <circle r="8" fill="#E1BEE7" opacity="0.8" />
            <circle r="4" fill="white" opacity="0.9" />
          </g>
        </g>

        {/* Wormhole pulsing */}
        <g className="svg-pulse-glow anim-delay-3" style={{ transformOrigin: '120px 160px' }}>
          <circle cx="120" cy="160" r="55" fill="none" stroke="#7C4DFF" strokeWidth="1.5" opacity="0.3" />
        </g>

        {/* Planet orbiting */}
        <g className="svg-spin-slow anim-delay-2" style={{ transformOrigin: '120px 160px' }}>
          <g transform="translate(120, 160)">
            <circle cx="80" cy="0" r="14" fill="#FF7043" opacity="0.65" />
            <ellipse cx="80" cy="0" rx="2" ry="5" fill="white" opacity="0.2" transform="translate(-3, -3)" />
          </g>
        </g>
        {/* Planet ring */}
        <ellipse cx="200" cy="160" rx="24" ry="4" fill="none" stroke="#FF7043" strokeWidth="1" opacity="0.35" />

        {/* Moon/small planet */}
        <g className="svg-drift anim-delay-1" style={{ transformOrigin: '55px 100px' }}>
          <circle cx="55" cy="100" r="10" fill="#B0BEC5" opacity="0.55" />
          <circle cx="52" cy="98" r="3" fill="#90A4AE" opacity="0.4" />
        </g>

        {/* Girl reaching toward the light */}
        <g className="svg-float anim-delay-2" style={{ transformOrigin: '50px 210px' }}>
          <g transform="translate(50, 215)">
            {/* Body */}
            <rect x="-8" y="8" width="16" height="24" rx="4" fill="#7B1FA2" opacity="0.8" />
            {/* Head */}
            <circle cx="0" cy="0" r="11" fill="#FFCCBC" />
            {/* Hair floating up */}
            <g className="svg-sway anim-delay-1" style={{ transformOrigin: '0px -8px' }}>
              <ellipse cx="0" cy="-8" rx="11" ry="7" fill="#4E342E" />
              <ellipse cx="-8" cy="-12" rx="5" ry="8" fill="#4E342E" transform="rotate(-20 -8 -12)" />
              <ellipse cx="8" cy="-12" rx="5" ry="8" fill="#4E342E" transform="rotate(20 8 -12)" />
              <ellipse cx="0" cy="-18" rx="6" ry="4" fill="#3E2723" transform="rotate(5)" />
            </g>
            {/* Arm reaching */}
            <line x1="8" y1="12" x2="28" y2="-5" stroke="#FFCCBC" strokeWidth="4" strokeLinecap="round" />
            <circle cx="30" cy="-7" r="3.5" fill="#FFCCBC" />
            {/* Other arm */}
            <line x1="-8" y1="12" x2="-16" y2="22" stroke="#FFCCBC" strokeWidth="4" strokeLinecap="round" />
            {/* Legs */}
            <rect x="-7" y="30" width="6" height="14" rx="3" fill="#7B1FA2" opacity="0.8" />
            <rect x="3" y="30" width="6" height="14" rx="3" fill="#7B1FA2" opacity="0.8" />
          </g>
        </g>

        {/* Magic energy sparks */}
        {[[90, 200], [45, 175], [70, 235], [35, 225]].map(([x, y], i) => (
          <circle
            key={i}
            cx={x} cy={y}
            r="2.5"
            fill="#CE93D8"
            opacity="0.6"
            className={`svg-twinkle anim-delay-${(i % 4) + 1}`}
          />
        ))}
      </g>
    ),
  },

  // ── 7. Inkheart ──────────────────────────────────────────────────────────
  'Inkheart': {
    gradient: ['#880E4F', '#B71C1C'],
    accent: '#FFCDD2',
    illustration: (
      <g>
        {/* Dark atmospheric background swirls */}
        <path d="M 0 100 Q 60 80 120 110 Q 180 140 240 100" fill="none" stroke="#C62828" strokeWidth="1" opacity="0.2" />
        <path d="M 0 140 Q 80 110 160 150 Q 200 165 240 140" fill="none" stroke="#AD1457" strokeWidth="1" opacity="0.2" />

        {/* Open book — glowing pages */}
        <g className="svg-wiggle anim-delay-1" style={{ transformOrigin: '115px 185px' }}>
          <g transform="translate(115, 188)">
            {/* Left page */}
            <rect x="-42" y="-8" width="40" height="55" rx="2" fill="#FFF8E1" transform="rotate(6 -22 20)" />
            {/* Right page */}
            <rect x="2" y="-8" width="40" height="55" rx="2" fill="#FFF8E1" transform="rotate(-6 22 20)" />
            {/* Spine */}
            <rect x="-2" y="-8" width="4" height="55" rx="1" fill="#D7CCC8" />
            {/* Book glow */}
            <g className="svg-pulse-glow anim-delay-2" style={{ transformOrigin: '0px 20px' }}>
              <ellipse cx="0" cy="20" rx="45" ry="32" fill="#FFEE58" opacity="0.12" />
            </g>
            {/* Text lines on left */}
            {[0, 1, 2, 3, 4].map((i) => (
              <line key={i} x1={-34} y1={6 + i * 8} x2={-10} y2={6 + i * 8} stroke="#BCAAA4" strokeWidth="0.9" transform="rotate(6 -22 20)" />
            ))}
            {/* Text lines on right */}
            {[0, 1, 2, 3, 4].map((i) => (
              <line key={i} x1={10} y1={6 + i * 8} x2={35} y2={6 + i * 8} stroke="#BCAAA4" strokeWidth="0.9" transform="rotate(-6 22 20)" />
            ))}
          </g>
        </g>

        {/* Pages fluttering */}
        <g className="svg-sway anim-delay-3" style={{ transformOrigin: '75px 170px' }}>
          <path d="M 75 175 Q 65 165 70 155 Q 78 150 82 160 Q 86 150 90 155" fill="#FFF8E1" opacity="0.7" />
        </g>
        <g className="svg-sway anim-delay-1" style={{ transformOrigin: '160px 165px' }}>
          <path d="M 160 170 Q 150 160 155 150 Q 163 145 167 155 Q 171 145 175 152" fill="#FFF8E1" opacity="0.65" />
        </g>

        {/* Floating letters drifting upward */}
        {[
          { ch: 'S', x: 52, y: 130, delay: 'anim-delay-1', size: 14 },
          { ch: 'T', x: 80, y: 110, delay: 'anim-delay-2', size: 11 },
          { ch: 'O', x: 108, y: 95, delay: 'anim-delay-3', size: 16 },
          { ch: 'R', x: 150, y: 108, delay: 'anim-delay-4', size: 12 },
          { ch: 'Y', x: 178, y: 90, delay: 'anim-delay-1', size: 13 },
          { ch: 'M', x: 65, y: 150, delay: 'anim-delay-3', size: 10 },
          { ch: 'A', x: 195, y: 125, delay: 'anim-delay-2', size: 10 },
          { ch: 'G', x: 35, y: 105, delay: 'anim-delay-4', size: 11 },
          { ch: 'I', x: 130, y: 80, delay: 'anim-delay-2', size: 9 },
          { ch: 'C', x: 220, y: 100, delay: 'anim-delay-3', size: 12 },
        ].map(({ ch, x, y, delay, size }) => (
          <g key={ch + x} className={`svg-drift ${delay}`} style={{ transformOrigin: `${x}px ${y}px` }}>
            <text x={x} y={y} fill="white" fontSize={size} fontFamily="Georgia, serif" opacity="0.55" textAnchor="middle">
              {ch}
            </text>
          </g>
        ))}

        {/* Floating story characters emerging */}
        {/* Small dragon */}
        <g className="svg-drift anim-delay-2" style={{ transformOrigin: '50px 145px' }}>
          <g transform="translate(50, 145)" opacity="0.6">
            <ellipse cx="0" cy="0" rx="10" ry="7" fill="#B71C1C" />
            <polygon points="-3,-7 0,-14 3,-7" fill="#D32F2F" />
            <circle cx="-8" cy="-2" r="3" fill="#C62828" />
            <line x1="10" y1="0" x2="18" y2="-5" stroke="#B71C1C" strokeWidth="2" strokeLinecap="round" />
            <circle cx="-6" cy="-3" r="1.2" fill="#FFEE58" />
          </g>
        </g>
        {/* Small figure */}
        <g className="svg-drift anim-delay-4" style={{ transformOrigin: '195px 138px' }}>
          <g transform="translate(195, 138)" opacity="0.55">
            <circle cx="0" cy="-8" r="4" fill="#FFCCBC" />
            <rect x="-4" y="-4" width="8" height="10" rx="2" fill="#1565C0" />
            <line x1="0" y1="-12" x2="0" y2="-18" stroke="gray" strokeWidth="0.8" />
          </g>
        </g>

        {/* Ember/sparkle particles drifting up */}
        {[
          [70, 125, 'anim-delay-1'],
          [95, 108, 'anim-delay-2'],
          [140, 118, 'anim-delay-3'],
          [165, 102, 'anim-delay-4'],
          [185, 130, 'anim-delay-1'],
          [55, 160, 'anim-delay-3'],
          [210, 145, 'anim-delay-2'],
          [120, 75, 'anim-delay-4'],
        ].map(([x, y, delay], i) => (
          <g key={i} className={`svg-drift ${delay}`} style={{ transformOrigin: `${x}px ${y}px` }}>
            <circle cx={x} cy={y} r={2 + (i % 2)} fill="#FFD54F" opacity={0.45 + (i % 3) * 0.15} />
            <circle cx={x} cy={y} r={1} fill="#FFEE58" opacity="0.8" />
          </g>
        ))}
      </g>
    ),
  },

  // ── 8. The Book Thief ────────────────────────────────────────────────────
  'The Book Thief': {
    gradient: ['#263238', '#37474F'],
    accent: '#B0BEC5',
    illustration: (
      <g>
        {/* Dark rooftops and buildings */}
        <rect x="0" y="215" width="55" height="60" fill="#1C313A" />
        <polygon points="0,215 27,195 55,215" fill="#263238" />
        <rect x="60" y="225" width="40" height="50" fill="#1C313A" />
        <polygon points="60,225 80,205 100,225" fill="#263238" />
        <rect x="170" y="210" width="70" height="65" fill="#1C313A" />
        <polygon points="170,210 205,188 240,210" fill="#263238" />
        {/* Windows lit */}
        <rect x="15" y="228" width="10" height="8" rx="1" fill="#FFD54F" opacity="0.5" />
        <rect x="32" y="228" width="10" height="8" rx="1" fill="#FFD54F" opacity="0.4" />
        <rect x="183" y="225" width="10" height="8" rx="1" fill="#FFD54F" opacity="0.45" />
        <rect x="203" y="225" width="10" height="8" rx="1" fill="#FFD54F" opacity="0.5" />

        {/* Moon drifting behind clouds */}
        <g className="svg-drift anim-delay-2" style={{ transformOrigin: '175px 85px' }}>
          {/* Cloud */}
          <ellipse cx="175" cy="90" rx="35" ry="16" fill="#455A64" opacity="0.7" />
          <ellipse cx="158" cy="93" rx="20" ry="12" fill="#455A64" opacity="0.7" />
          <ellipse cx="195" cy="93" rx="20" ry="12" fill="#455A64" opacity="0.7" />
        </g>
        {/* Moon behind cloud */}
        <circle cx="175" cy="82" r="22" fill="#ECEFF1" opacity="0.65" />
        <circle cx="182" cy="78" r="22" fill="#37474F" opacity="0.5" />

        {/* Additional clouds drifting */}
        <g className="svg-drift anim-delay-4" style={{ transformOrigin: '60px 110px' }}>
          <ellipse cx="60" cy="110" rx="28" ry="12" fill="#455A64" opacity="0.5" />
          <ellipse cx="44" cy="113" rx="16" ry="9" fill="#455A64" opacity="0.45" />
          <ellipse cx="76" cy="113" rx="16" ry="9" fill="#455A64" opacity="0.45" />
        </g>

        {/* Stars */}
        {[[30, 55], [65, 40], [110, 50], [145, 38], [220, 55], [20, 90], [230, 90]].map(([x, y], i) => (
          <circle
            key={i}
            cx={x} cy={y}
            r={1.2 + (i % 2) * 0.5}
            fill="white"
            opacity={0.3 + (i % 3) * 0.2}
            className={`svg-twinkle anim-delay-${(i % 4) + 1}`}
          />
        ))}

        {/* Searchlight beam sweeping */}
        <g className="svg-sway anim-delay-1" style={{ transformOrigin: '30px 240px' }}>
          <path d="M 30 245 L 80 140 L 100 145 Z" fill="#E3F2FD" opacity="0.07" />
        </g>

        {/* Stack of coloured books */}
        {[
          { x: 62, y: 173, w: 88, h: 11, color: '#EF5350', rot: 0 },
          { x: 64, y: 162, w: 84, h: 11, color: '#42A5F5', rot: 1 },
          { x: 66, y: 151, w: 79, h: 11, color: '#66BB6A', rot: -1 },
          { x: 68, y: 140, w: 74, h: 11, color: '#FFA726', rot: 0.5 },
          { x: 70, y: 129, w: 69, h: 11, color: '#AB47BC', rot: -0.5 },
        ].map(({ x, y, w, h, color, rot }, i) => (
          <rect key={i} x={x} y={y} width={w} height={h} rx="2" fill={color} opacity="0.8" transform={`rotate(${rot} ${x + w / 2} ${y + h / 2})`} />
        ))}

        {/* Floating pages in the wind */}
        {[
          [85, 110, 'anim-delay-1', -15],
          [135, 95, 'anim-delay-3', 10],
          [165, 118, 'anim-delay-2', -8],
          [45, 130, 'anim-delay-4', 20],
          [200, 105, 'anim-delay-1', -12],
        ].map(([x, y, delay, rot], i) => (
          <g key={i} className={`svg-drift ${delay}`} style={{ transformOrigin: `${x}px ${y}px` }}>
            <rect x={x - 8} y={y - 10} width="16" height="20" rx="1" fill="#ECEFF1" opacity="0.35" transform={`rotate(${rot} ${x} ${y})`} />
            {[0, 1, 2].map((j) => (
              <line key={j} x1={x - 5} y1={y - 5 + j * 5} x2={x + 5} y2={y - 5 + j * 5} stroke="#B0BEC5" strokeWidth="0.6" opacity="0.3" />
            ))}
          </g>
        ))}

        {/* Girl walking (Liesel) */}
        <g className="svg-crawl anim-delay-2" style={{ transformOrigin: '130px 190px' }}>
          <g transform="translate(130, 195)">
            {/* Head */}
            <circle cx="0" cy="-28" r="9" fill="#FFCCBC" />
            {/* Hair */}
            <ellipse cx="0" cy="-33" rx="9" ry="6" fill="#6D4C41" />
            {/* Body / coat */}
            <rect x="-9" y="-19" width="18" height="22" rx="3" fill="#455A64" />
            {/* Legs */}
            <rect x="-7" y="3" width="6" height="16" rx="3" fill="#37474F" />
            <rect x="2" y="3" width="6" height="14" rx="3" fill="#37474F" transform="rotate(-8 5 10)" />
            {/* Arm with book */}
            <rect x="9" y="-15" width="14" height="10" rx="2" fill="#EF5350" opacity="0.85" />
            <line x1="9" y1="-10" x2="14" y2="-4" stroke="#FFCCBC" strokeWidth="3" strokeLinecap="round" />
          </g>
        </g>
      </g>
    ),
  },

  // ── 9. Winnie-the-Pooh ───────────────────────────────────────────────────
  'Winnie-the-Pooh': {
    gradient: ['#FF8F00', '#E65100'],
    accent: '#FFF8E1',
    illustration: (
      <g>
        {/* Sky */}
        <rect width="240" height="160" fill="#87CEDB" opacity="0.3" />

        {/* Fluffy clouds drifting */}
        <g className="svg-drift anim-delay-1" style={{ transformOrigin: '65px 65px' }}>
          <ellipse cx="65" cy="65" rx="32" ry="14" fill="white" opacity="0.7" />
          <ellipse cx="48" cy="68" rx="18" ry="11" fill="white" opacity="0.65" />
          <ellipse cx="82" cy="68" rx="18" ry="11" fill="white" opacity="0.65" />
          <ellipse cx="65" cy="58" rx="20" ry="12" fill="white" opacity="0.75" />
        </g>
        <g className="svg-drift anim-delay-3" style={{ transformOrigin: '185px 75px' }}>
          <ellipse cx="185" cy="75" rx="26" ry="11" fill="white" opacity="0.6" />
          <ellipse cx="170" cy="78" rx="15" ry="9" fill="white" opacity="0.55" />
          <ellipse cx="200" cy="78" rx="15" ry="9" fill="white" opacity="0.55" />
        </g>

        {/* Hundred Acre Wood tree — large */}
        <rect x="148" y="95" width="22" height="145" rx="5" fill="#6D4C41" />
        {/* Bark detail */}
        {[110, 130, 155, 175, 195].map((y, i) => (
          <line key={i} x1="150" y1={y} x2="168" y2={y + 6} stroke="#5D4037" strokeWidth="0.9" opacity="0.35" />
        ))}
        {/* Foliage */}
        <g className="svg-sway" style={{ transformOrigin: '159px 110px' }}>
          <circle cx="159" cy="88" r="42" fill="#558B2F" opacity="0.9" />
          <circle cx="135" cy="105" r="28" fill="#689F38" opacity="0.8" />
          <circle cx="180" cy="102" r="26" fill="#7CB342" opacity="0.75" />
          <circle cx="159" cy="70" r="24" fill="#33691E" opacity="0.7" />
        </g>
        <g className="svg-sway anim-delay-2" style={{ transformOrigin: '175px 115px' }}>
          <circle cx="185" cy="115" r="22" fill="#689F38" opacity="0.65" />
        </g>

        {/* Honey pot with dripping honey */}
        <g className="svg-wiggle anim-delay-3" style={{ transformOrigin: '85px 192px' }}>
          <g transform="translate(85, 200)">
            {/* Pot body */}
            <ellipse cx="0" cy="10" rx="22" ry="24" fill="#FFA000" />
            {/* Pot rim */}
            <rect x="-22" y="-5" width="44" height="14" rx="5" fill="#FFB300" />
            {/* Label */}
            <rect x="-14" y="5" width="28" height="14" rx="2" fill="#FFF8E1" opacity="0.6" />
            <text x="0" y="15" textAnchor="middle" fill="#5D4037" fontSize="7" fontFamily="Georgia, serif" fontWeight="bold">HUNNY</text>
            {/* Honey drips */}
            <g className="svg-float anim-delay-2" style={{ transformOrigin: '0px -5px' }}>
              <path d="M -6 -5 Q -5 5 -7 12" fill="none" stroke="#FFD54F" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
              <circle cx="-7" cy="13" r="2.5" fill="#FFD54F" opacity="0.75" />
            </g>
            <g className="svg-float anim-delay-4" style={{ transformOrigin: '5px -5px' }}>
              <path d="M 5 -5 Q 6 3 4 10" fill="none" stroke="#FFD54F" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
              <circle cx="4" cy="11" r="2" fill="#FFD54F" opacity="0.7" />
            </g>
          </g>
        </g>

        {/* Pooh bear swaying */}
        <g className="svg-sway anim-delay-1" style={{ transformOrigin: '128px 185px' }}>
          <g transform="translate(128, 192)">
            {/* Body */}
            <ellipse cx="0" cy="8" rx="18" ry="20" fill="#D84315" />
            {/* Tummy */}
            <ellipse cx="0" cy="10" rx="11" ry="13" fill="#FFCCBC" opacity="0.5" />
            {/* Head */}
            <circle cx="0" cy="-13" r="14" fill="#D84315" />
            {/* Ears */}
            <circle cx="-10" cy="-24" r="6" fill="#D84315" />
            <circle cx="10" cy="-24" r="6" fill="#D84315" />
            <circle cx="-10" cy="-24" r="3.5" fill="#FFAB91" />
            <circle cx="10" cy="-24" r="3.5" fill="#FFAB91" />
            {/* Face */}
            <circle cx="-5" cy="-15" r="2.5" fill="#4E342E" />
            <circle cx="5" cy="-15" r="2.5" fill="#4E342E" />
            <ellipse cx="0" cy="-10" rx="4.5" ry="3" fill="#FFAB91" />
            <path d="M -4 -6 Q 0 -3 4 -6" fill="none" stroke="#4E342E" strokeWidth="1.2" />
            {/* Red shirt */}
            <rect x="-16" y="-2" width="32" height="14" rx="5" fill="#C62828" opacity="0.8" />
            {/* Arms */}
            <ellipse cx="-20" cy="5" rx="7" ry="5" fill="#D84315" transform="rotate(-20 -20 5)" />
            <ellipse cx="20" cy="5" rx="7" ry="5" fill="#D84315" transform="rotate(20 20 5)" />
            {/* Legs */}
            <ellipse cx="-7" cy="27" rx="6" ry="8" fill="#D84315" />
            <ellipse cx="7" cy="27" rx="6" ry="8" fill="#D84315" />
          </g>
        </g>

        {/* Bees buzzing around */}
        {[
          { x: 60, y: 110, delay: 'anim-delay-1' },
          { x: 98, y: 98, delay: 'anim-delay-2' },
          { x: 72, y: 138, delay: 'anim-delay-3' },
          { x: 40, y: 128, delay: 'anim-delay-4' },
          { x: 55, y: 155, delay: 'anim-delay-1' },
        ].map(({ x, y, delay }, i) => (
          <g key={i} className={`svg-drift ${delay}`} style={{ transformOrigin: `${x}px ${y}px` }}>
            <g transform={`translate(${x}, ${y})`}>
              <ellipse cx="0" cy="0" rx="5" ry="3.5" fill="#FDD835" />
              <ellipse cx="1" cy="-3" rx="3" ry="2" fill="white" opacity="0.6" transform="rotate(-20)" />
              <ellipse cx="-1" cy="-3" rx="3" ry="2" fill="white" opacity="0.5" transform="rotate(20)" />
              <line x1="-4" y1="0" x2="4" y2="0" stroke="#3E2723" strokeWidth="1" opacity="0.6" />
              <line x1="-3" y1="-1.5" x2="3" y2="-1.5" stroke="#3E2723" strokeWidth="0.8" opacity="0.4" />
              <circle cx="3" cy="-1" r="1.5" fill="#3E2723" />
            </g>
          </g>
        ))}

        {/* Butterflies */}
        <g className="svg-wiggle anim-delay-2" style={{ transformOrigin: '30px 175px' }}>
          <g transform="translate(30, 175) scale(0.7)" opacity="0.75">
            <ellipse cx="-10" cy="-5" rx="11" ry="7" fill="#F48FB1" transform="rotate(-25 -10 -5)" />
            <ellipse cx="10" cy="-5" rx="11" ry="7" fill="#F48FB1" transform="rotate(25 10 -5)" />
            <ellipse cx="-7" cy="5" rx="7" ry="4.5" fill="#FCE4EC" transform="rotate(25 -7 5)" />
            <ellipse cx="7" cy="5" rx="7" ry="4.5" fill="#FCE4EC" transform="rotate(-25 7 5)" />
            <ellipse cx="0" cy="0" rx="2" ry="6" fill="#4E342E" />
          </g>
        </g>
        <g className="svg-wiggle anim-delay-4" style={{ transformOrigin: '220px 145px' }}>
          <g transform="translate(220, 145) scale(0.6)" opacity="0.7">
            <ellipse cx="-9" cy="-4" rx="10" ry="6" fill="#80DEEA" transform="rotate(-25 -9 -4)" />
            <ellipse cx="9" cy="-4" rx="10" ry="6" fill="#80DEEA" transform="rotate(25 9 -4)" />
            <ellipse cx="-6" cy="4" rx="7" ry="4" fill="#E0F7FA" transform="rotate(25 -6 4)" />
            <ellipse cx="6" cy="4" rx="7" ry="4" fill="#E0F7FA" transform="rotate(-25 6 4)" />
            <ellipse cx="0" cy="0" rx="1.5" ry="5" fill="#4E342E" />
          </g>
        </g>
      </g>
    ),
  },

  // ── 10. Matilda ──────────────────────────────────────────────────────────
  'Matilda': {
    gradient: ['#006064', '#00838F'],
    accent: '#B2EBF2',
    illustration: (
      <g>
        {/* Background energy lines (telekinesis) */}
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => (
          <line
            key={a}
            x1="120" y1="200"
            x2={120 + Math.cos((a * Math.PI) / 180) * 120}
            y2={200 + Math.sin((a * Math.PI) / 180) * 120}
            stroke="#00BCD4"
            strokeWidth="0.5"
            opacity="0.12"
          />
        ))}

        {/* Floating books at different heights — staggered drift */}
        {[
          { x: 30, y: 118, rot: -22, color: '#EF5350', delay: 'anim-delay-1' },
          { x: 65, y: 95, rot: 10, color: '#42A5F5', delay: 'anim-delay-2' },
          { x: 108, y: 78, rot: -8, color: '#66BB6A', delay: 'anim-delay-3' },
          { x: 152, y: 90, rot: 18, color: '#AB47BC', delay: 'anim-delay-4' },
          { x: 190, y: 112, rot: -14, color: '#FFA726', delay: 'anim-delay-1' },
          { x: 48, y: 145, rot: 25, color: '#FF7043', delay: 'anim-delay-3' },
          { x: 180, y: 145, rot: -20, color: '#26C6DA', delay: 'anim-delay-2' },
        ].map(({ x, y, rot, color, delay }, i) => (
          <g key={i} className={`svg-float ${delay}`} style={{ transformOrigin: `${x + 12}px ${y + 16}px` }}>
            <g transform={`rotate(${rot} ${x + 12} ${y + 16})`}>
              <rect x={x} y={y} width="24" height="30" rx="2" fill={color} opacity="0.8" />
              {/* Book spine */}
              <rect x={x} y={y} width="3" height="30" rx="1" fill={color} opacity="0.5" style={{ filter: 'brightness(0.7)' }} />
              {/* Pages edge */}
              <rect x={x + 21} y={y + 2} width="3" height="26" rx="1" fill="#FFF8E1" opacity="0.6" />
              {/* Cover lines */}
              <line x1={x + 5} y1={y + 8} x2={x + 20} y2={y + 8} stroke="white" strokeWidth="0.8" opacity="0.5" />
              <line x1={x + 5} y1={y + 13} x2={x + 18} y2={y + 13} stroke="white" strokeWidth="0.8" opacity="0.4" />
            </g>
          </g>
        ))}

        {/* Floating pencils */}
        {[
          { x: 40, y: 108, rot: 45, delay: 'anim-delay-2' },
          { x: 195, y: 100, rot: -50, delay: 'anim-delay-4' },
          { x: 22, y: 165, rot: 35, delay: 'anim-delay-1' },
          { x: 210, y: 162, rot: -40, delay: 'anim-delay-3' },
        ].map(({ x, y, rot, delay }, i) => (
          <g key={i} className={`svg-drift ${delay}`} style={{ transformOrigin: `${x}px ${y}px` }}>
            <g transform={`rotate(${rot} ${x} ${y})`}>
              <rect x={x - 2} y={y - 12} width="4" height="22" rx="1" fill="#FDD835" />
              <polygon points={`${x - 2},${y + 10} ${x + 2},${y + 10} ${x},${y + 16}`} fill="#FFCCBC" />
              <rect x={x - 2} y={y - 14} width="4" height="4" rx="1" fill="#B0BEC5" />
              <circle cx={x} cy={y + 16} r="1" fill="#555" />
            </g>
          </g>
        ))}

        {/* Matilda — center with hair floating up */}
        <g transform="translate(120, 215)">
          {/* Body / dress */}
          <rect x="-11" y="8" width="22" height="28" rx="4" fill="#1565C0" />
          {/* Dress details */}
          <line x1="-9" y1="16" x2="9" y2="16" stroke="#0D47A1" strokeWidth="1" />
          {/* Legs */}
          <rect x="-9" y="34" width="8" height="16" rx="3" fill="#1565C0" />
          <rect x="2" y="34" width="8" height="16" rx="3" fill="#1565C0" />
          {/* Shoes */}
          <ellipse cx="-5" cy="50" rx="6" ry="3" fill="#212121" />
          <ellipse cx="6" cy="50" rx="6" ry="3" fill="#212121" />
          {/* Head */}
          <circle cx="0" cy="0" r="13" fill="#FFCCBC" />
          {/* Glasses */}
          <circle cx="-5" cy="-1" r="5" fill="none" stroke="#FFD54F" strokeWidth="1.2" />
          <circle cx="6" cy="-1" r="5" fill="none" stroke="#FFD54F" strokeWidth="1.2" />
          <line x1="1" y1="-1" x2="1" y2="-1" stroke="#FFD54F" strokeWidth="1.2" />
          <line x1="-11" y1="-1" x2="-10" y2="-1" stroke="#FFD54F" strokeWidth="1.2" />
          {/* Hair floating up (telekinesis) */}
          <g className="svg-sway" style={{ transformOrigin: '0px -10px' }}>
            <ellipse cx="0" cy="-10" rx="12" ry="7" fill="#4E342E" />
            <g className="svg-float anim-delay-1" style={{ transformOrigin: '-10px -20px' }}>
              <ellipse cx="-10" cy="-20" rx="6" ry="10" fill="#4E342E" transform="rotate(-25 -10 -20)" />
            </g>
            <g className="svg-float anim-delay-2" style={{ transformOrigin: '10px -20px' }}>
              <ellipse cx="10" cy="-20" rx="6" ry="10" fill="#4E342E" transform="rotate(25 10 -20)" />
            </g>
            <g className="svg-float anim-delay-3" style={{ transformOrigin: '0px -28px' }}>
              <ellipse cx="0" cy="-28" rx="5" ry="8" fill="#3E2723" transform="rotate(-10)" />
            </g>
            {/* Hair bow */}
            <g className="svg-wiggle anim-delay-1" style={{ transformOrigin: '0px -18px' }}>
              <polygon points="-7,-18 0,-13 -7,-8" fill="#E91E63" />
              <polygon points="7,-18 0,-13 7,-8" fill="#E91E63" />
              <circle cx="0" cy="-13" r="2" fill="#F06292" />
            </g>
          </g>
          {/* Arms outstretched */}
          <line x1="-11" y1="12" x2="-28" y2="5" stroke="#FFCCBC" strokeWidth="5" strokeLinecap="round" />
          <line x1="11" y1="12" x2="28" y2="5" stroke="#FFCCBC" strokeWidth="5" strokeLinecap="round" />
          <circle cx="-29" cy="4" r="4" fill="#FFCCBC" />
          <circle cx="29" cy="4" r="4" fill="#FFCCBC" />
        </g>

        {/* Magic sparkle pulses around Matilda */}
        {[
          [80, 180, 'anim-delay-1'],
          [60, 210, 'anim-delay-2'],
          [160, 175, 'anim-delay-3'],
          [175, 210, 'anim-delay-4'],
          [92, 240, 'anim-delay-2'],
          [148, 238, 'anim-delay-1'],
          [70, 160, 'anim-delay-4'],
          [170, 155, 'anim-delay-3'],
        ].map(([x, y, delay], i) => (
          <g key={i} className={`svg-pulse-glow ${delay}`} style={{ transformOrigin: `${x}px ${y}px` }}>
            <circle cx={x} cy={y} r={3 + (i % 3)} fill="#FFD54F" opacity="0.5" />
            {/* Star shape for sparkles */}
            <line x1={x - 5} y1={y} x2={x + 5} y2={y} stroke="#FFEE58" strokeWidth="0.8" opacity="0.6" />
            <line x1={x} y1={y - 5} x2={x} y2={y + 5} stroke="#FFEE58" strokeWidth="0.8" opacity="0.6" />
            <line x1={x - 4} y1={y - 4} x2={x + 4} y2={y + 4} stroke="#FFEE58" strokeWidth="0.6" opacity="0.4" />
            <line x1={x + 4} y1={y - 4} x2={x - 4} y2={y + 4} stroke="#FFEE58" strokeWidth="0.6" opacity="0.4" />
          </g>
        ))}

        {/* Lightning energy lines */}
        {[
          'M 75 200 Q 90 185 95 195 Q 100 182 108 188',
          'M 165 195 Q 150 180 148 192 Q 143 178 135 186',
          'M 80 230 Q 95 218 98 228 Q 103 215 110 222',
          'M 160 228 Q 145 215 143 226 Q 138 213 130 220',
        ].map((d, i) => (
          <g key={i} className={`svg-twinkle anim-delay-${i + 1}`}>
            <path d={d} fill="none" stroke="#00E5FF" strokeWidth="1.2" opacity="0.5" />
          </g>
        ))}
      </g>
    ),
  },
};

// ── Main Component ─────────────────────────────────────────────────────────
export default function BookCoverIllustration({ book, className = '' }) {
  // If the book has a real cover_image URL, use that
  if (book.cover_image) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <Image
          src={book.cover_image}
          alt={`${book.title} cover`}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 240px"
          className="object-cover"
          unoptimized
        />
      </div>
    );
  }

  const coverDef = BOOK_COVERS[book.title];
  const gradFrom = coverDef?.gradient?.[0] || '#5C8B5C';
  const gradTo = coverDef?.gradient?.[1] || '#3D6B3D';
  const accentColor = coverDef?.accent || '#FFF9C4';

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <svg
        viewBox="0 0 240 320"
        className="w-full h-full"
        role="img"
        aria-label={`${book.title} cover`}
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id={`bg-${book.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={gradFrom} />
            <stop offset="100%" stopColor={gradTo} />
          </linearGradient>
          {/* Radial glow for magical effects */}
          <radialGradient id={`glow-${book.id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="white" stopOpacity="0.15" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background gradient */}
        <rect width="240" height="320" fill={`url(#bg-${book.id})`} />

        {/* Subtle ambient glow overlay */}
        <ellipse cx="120" cy="140" rx="140" ry="120" fill={`url(#glow-${book.id})`} />

        {/* Illustration */}
        {coverDef?.illustration || (
          <g>
            <circle cx="120" cy="160" r="55" fill="white" opacity="0.12" />
            <text x="120" y="180" textAnchor="middle" fontSize="52">
              {book.cover || '📖'}
            </text>
          </g>
        )}

        {/* Title area background */}
        <rect x="0" y="248" width="240" height="72" fill="black" opacity="0.38" />

        {/* Decorative accent line above title */}
        <line x1="30" y1="254" x2="210" y2="254" stroke={accentColor} strokeWidth="0.5" opacity="0.4" />

        {/* Title */}
        <text
          x="120"
          y="276"
          textAnchor="middle"
          fill={accentColor}
          fontSize="12.5"
          fontFamily="Georgia, serif"
          fontWeight="bold"
          letterSpacing="0.3"
        >
          {book.title.length > 26 ? book.title.slice(0, 24) + '…' : book.title}
        </text>

        {/* Title line 2 if needed (for long titles) */}
        {book.title.length > 26 && (
          <text
            x="120"
            y="290"
            textAnchor="middle"
            fill={accentColor}
            fontSize="11"
            fontFamily="Georgia, serif"
            fontWeight="bold"
            opacity="0.9"
          >
            {book.title.slice(24, 46)}
          </text>
        )}

        {/* Author */}
        <text
          x="120"
          y="307"
          textAnchor="middle"
          fill="white"
          fontSize="8.5"
          fontFamily="Georgia, serif"
          opacity="0.75"
          letterSpacing="0.5"
        >
          {book.author}
        </text>
      </svg>
    </div>
  );
}
