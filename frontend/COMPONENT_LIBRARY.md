# Hi Alice Component Library

> 19 reusable components powering the Ghibli-themed educational UI

This document provides a comprehensive inventory of all React components in the Hi Alice system. Each component is documented with its purpose, props, usage examples, and educational theory alignment from CLAUDE.md.

## Quick Navigation

- [Component Index](#component-index)
- [Session Components](#session-components)
- [Shared/Utility Components](#sharedutility-components)
- [Page-Specific Components](#page-specific-components)
- [Hooks & Utilities](#hooks--utilities)
- [Component Patterns](#component-patterns)

---

## Component Index

| Component | File | Lines | Tier | Purpose | Key Props |
|-----------|------|-------|------|---------|-----------|
| **BookCard** | `BookCard.jsx` | 209 | UI | Book selection card with 3D flip effect | `book`, `onClick`, `compact` |
| **VocabMiniCard** | `VocabMiniCard.js` | 248 | Session | Slide-up vocabulary overlay (i+1 learning) | `word`, `definition`, `example`, `onDismiss` |
| **ErrorBoundary** | `ErrorBoundary.js` | 96 | Utility | React error boundary for crash recovery | `children` |
| **NavBar** | `NavBar.js` | 106 | Layout | Top/bottom responsive navigation with feature gates | (no props, uses context) |
| **VoiceButton** | `VoiceButton.jsx` | ~200 | Session | Voice recording button with states & accessibility | `onRecordStart`, `onRecordEnd`, `isRecording`, `disabled` |
| **StageProgress** | `StageProgress.jsx` | ~150 | Session | Visual progress indicator with tree/emoji progression | `currentStage`, `totalStages`, `level` |
| **LoadingSkeleton** | `LoadingSkeleton.js` | ~80 | Utility | Shimmer skeleton loader for data placeholders | `count`, `variant` |
| **OfflineBanner** | `OfflineBanner.js` | ~60 | Utility | Network status indicator with offline fallback message | `isOnline` |
| **ConfettiCelebration** | `ConfettiCelebration.jsx` | ~180 | Overlay | Animated confetti celebration on session complete | `trigger`, `onComplete` |
| **AchievementUnlock** | `AchievementUnlock.jsx` | ~200 | Overlay | Badge unlock animation & display | `badge`, `title`, `description` |
| **BookCoverIllustration** | `BookCoverIllustration.jsx` | ~300 | Component | SVG book cover generator with Ghibli art | `book`, `className` |
| **ImaginationStudio** | `ImaginationStudio.jsx` | ~250 | Page | Creative writing canvas with scaffolding prompts | `studentLevel`, `bookId` |
| **PrintableWorksheet** | `PrintableWorksheet.jsx` | ~350 | Page | Browser-printable session review & learning summary | `sessionId`, `includeVocab` |
| **ReadingJourneyMap** | `ReadingJourneyMap.jsx` | ~280 | Page | Visual timeline of all books completed by student | `studentId` |
| **BookRecommendation** | `BookRecommendation.jsx` | ~180 | Component | AI-powered next book suggestion card | `currentBook`, `studentProfile` |
| **ChildInsightCard** | `ChildInsightCard.js` | ~220 | Component | Parent view: child's learning strengths & growth areas | `studentId`, `insights` |
| **ThoughtGarden** | `ThoughtGarden.js` | ~320 | Component | Visualization of student's key ideas from sessions | `studentId`, `sessionId` |
| **ThinkingIndicator** | `ThinkingIndicator.js` | ~100 | Overlay | HiAlice thinking animation while processing response | (no props) |
| **LoadingCard** | `LoadingCard.jsx` | ~120 | Utility | Skeleton card placeholder matching BookCard layout | (no props, styled CSS) |

---

## Session Components

These components form the core Q&A session experience.

### BookCard

**Purpose**: Interactive book selection card. Displays title, author, rating, level badge, and progress bar. Supports two modes: compact (thumbnail for bookshelf) and full (rich detail for selection).

**Educational Theory**:
- Implements *Emotional Connection* (§3.9, CLAUDE.md) via cover illustration and star rating
- Supports *Progressive Disclosure* (§3.7) — Beginner mode hides grade/age ranges

**File**: `frontend/src/components/BookCard.jsx`
**Lines**: 209
**Export**: Default function `BookCard`

**Props**:
```typescript
interface BookCard {
  book: {
    id: string;
    title: string;
    author: string;
    level: 'Beginner' | 'Intermediate' | 'Advanced';
    genre: string;
    rating: number;          // 0-5 stars
    reviewCount: number;
    progress: number;        // 0-100 (reading progress)
    badge?: 'Bestseller' | 'Popular' | 'Award Winner' | 'New';
    gradeLevel?: string;     // 'Grade 2-3' (hidden in Beginner mode)
    ageRange?: string;       // '6-8 years'
  };
  onClick: () => void;       // Triggered when card is clicked
  compact?: boolean;         // Default false. When true, shows thumbnail only
}
```

**Usage**:
```jsx
<BookCard
  book={{
    id: 'book-1',
    title: 'Charlotte\'s Web',
    author: 'E.B. White',
    level: 'Intermediate',
    genre: 'Fantasy',
    rating: 4.8,
    reviewCount: 5234,
    progress: 0,
    badge: 'Award Winner',
  }}
  onClick={() => startSession('book-1')}
  compact={false}
/>
```

**Accessibility**:
- `aria-label`: "Review {title} by {author}"
- Focus ring: 4px `#81C784` (level-specific green)
- Star rating: `role="img"` with `aria-label` for screen readers
- Rating count: Visually hidden for Beginner tier

**Styling**:
- Uses Ghibli card base (`.ghibli-card`) with 3D hover effect
- 3D flip disabled on touch devices (globals.css media query)
- Button-based (single interactive element, no nested interactives)
- Two variants via `compact` prop

---

### VocabMiniCard

**Purpose**: Just-in-time vocabulary learning overlay. Displays when HiAlice uses an advanced word in conversation (Krashen's i+1 hypothesis, §3.4 CLAUDE.md). Auto-dismisses after 10 seconds or on "Got it!" click.

**Educational Theory**:
- *Krashen's i+1 Input Hypothesis* (§3.4): Exposes vocabulary one level above current competency
- *Emotion-Focused Learning* (§3.9): Positive reaction to new words via celebration emoji

**File**: `frontend/src/components/VocabMiniCard.js`
**Lines**: 248
**Export**: Default function `VocabMiniCard`

**Props**:
```typescript
interface VocabMiniCard {
  word: string;              // e.g., "metamorphosis"
  definition: string;        // Simple, age-appropriate explanation
  example: string;           // Context sentence from conversation
  onDismiss: () => void;     // Called when card is closed/auto-dismissed
}
```

**Usage**:
```jsx
const [vocabCard, setVocabCard] = useState(null);

<VocabMiniCard
  word="protagonist"
  definition="The main character in a story who the story is about."
  example="The protagonist of Charlotte's Web is a pig named Wilbur."
  onDismiss={() => setVocabCard(null)}
/>
```

**Behavior**:
- Slides up from bottom with 400ms animation
- 10-second auto-dismiss with visible countdown bar
- Escape key dismisses
- Click outside card (on backdrop) dismisses
- "Got it!" button (48px min height, accessible)
- Syllable hint for pronunciation guide (e.g., "met·a·mor·pho·sis")

**Accessibility**:
- `role="dialog"` with `aria-modal="false"`
- `aria-labelledby="vocab-word-heading"` + `aria-describedby="vocab-definition"`
- Auto-focuses "Got it" button for screen readers
- Respects `prefers-reduced-motion` (no animation if enabled)
- Escape key handling for keyboard users

**Styling**:
- Fixed bottom overlay with 25% backdrop opacity
- Green border (`#5C8B5C`) matching brand
- Progress bar at top (shrinks over 10s)
- Emoji label ("🌟 New Word!")

---

### VoiceButton

**Purpose**: Primary input for voice recording. Displays large mic icon that pulsates while recording. Supports three states: Ready, Recording, Processing.

**Educational Theory**:
- Implements *Accessibility for Motor Skills* (§8.2 UI guide): Beginner tier has 96px button (vs 64px Advanced)
- *Emotion-Focused Learning* (§3.9): Pulsing animation creates anticipation

**File**: `frontend/src/components/VoiceButton.jsx`
**Lines**: ~200
**Export**: Default function `VoiceButton`

**Props**:
```typescript
interface VoiceButton {
  onRecordStart: () => void;   // Called when user starts recording
  onRecordEnd: (audio: Blob) => void;  // Called with audio blob when done
  isRecording: boolean;        // True while recording
  disabled?: boolean;          // Disable during processing
  tooltip?: string;            // Optional help text
}
```

**Usage**:
```jsx
const [isRecording, setIsRecording] = useState(false);

<VoiceButton
  onRecordStart={() => setIsRecording(true)}
  onRecordEnd={(audio) => sendToTranscription(audio)}
  isRecording={isRecording}
  disabled={isProcessing}
/>
```

**States**:
| State | Icon | Animation | Color |
|-------|------|-----------|-------|
| Ready | 🎤 | Idle (no animation) | `#5C8B5C` |
| Recording | 🎤 | Pulse (opacity 1 ↔ 0.5) @ 1.5s | `#D4736B` (danger/attention) |
| Processing | ⏳ | Spin | `#D4A843` (warning/thinking) |

**Accessibility**:
- `aria-label`: "Press to record your response"
- Large touch target: 80-96px (scales by tier)
- Keyboard: Space/Enter to toggle recording
- Screen reader announces recording state changes

**Styling**:
- Center-bottom placement in VoicePanel
- Large emoji size (32px–48px by tier)
- Pulsing animation class: `.pulse-mic` (respects prefers-reduced-motion)

---

### StageProgress

**Purpose**: Visual indicator of current position in the 4–6 stage session (depends on learner level). Shows completed stages, current stage highlight, and remaining stages. Implements "Tree Garden" metaphor: 🌱→🌿→🌳→🌲→🌸→🍎.

**Educational Theory**:
- *Scaffolding* (§3.6, CLAUDE.md): "Where am I?" always visible
- *Emotion-Focused Learning* (§3.9): Tree growth = progress/accomplishment metaphor

**File**: `frontend/src/components/StageProgress.jsx`
**Lines**: ~150
**Export**: Default function `StageProgress`

**Props**:
```typescript
interface StageProgress {
  currentStage: 'warm_connection' | 'title' | 'introduction' | 'body' | 'conclusion' | 'cross_book';
  totalStages: number;       // 4–6 depending on level
  level: 'beginner' | 'intermediate' | 'advanced';
}
```

**Usage**:
```jsx
<StageProgress
  currentStage="body"
  totalStages={5}
  level="intermediate"
/>
```

**Visual Progression**:
```
Beginner (4 stages):    🌱 → 🌿 → 🌳 → 🌲
Intermediate (5 stages): 🌱 → 🌿 → 🌳 → 🌲 → 🌸
Advanced (6 stages):    🌱 → 🌿 → 🌳 → 🌲 → 🌸 → 🍎
```

**Styling**:
- Horizontal progress tree (mobile: single row; tablet+: tree illustration)
- Completed stages: Green checkmark ✓ + grayed emoji
- Current stage: Highlighted green border + pulse animation
- Future stages: Gray, clickable (if review mode allows back-navigation)

**Accessibility**:
- `aria-label`: "Stage {N} of {total}: {stageName}"
- Emoji labels in text (not aria-hidden, since semantic)
- Current stage has focus ring when navigating keyboard

---

### LoadingSkeleton

**Purpose**: Placeholder for async content (books, messages). Displays shimmer animation matching target layout (card, line, or block).

**Educational Theory**:
- Visual feedback during wait times (prevents perceived frozen app)

**File**: `frontend/src/components/LoadingSkeleton.js`
**Lines**: ~80
**Export**: Default function `LoadingSkeleton`

**Props**:
```typescript
interface LoadingSkeleton {
  count?: number;           // How many items to show (default 1)
  variant?: 'card' | 'line' | 'block';  // Shape variant
  width?: string;           // Optional width (default 100%)
  height?: string;          // Optional height
}
```

**Usage**:
```jsx
{isLoading ? (
  <LoadingSkeleton count={3} variant="card" />
) : (
  books.map(book => <BookCard book={book} />)
)}
```

**Variants**:
- **card**: Full book card height (320px), matches BookCard aspect ratio
- **line**: Single-line text placeholder (32px height)
- **block**: Full-width block (96px height) for panels

**Styling**:
- `.skeleton` class with shimmer animation (1.5s loop, respects prefers-reduced-motion)
- Gradient: `#EDE5D4` → `#F5F0E8` → `#EDE5D4` (warm, matches theme)
- Border radius: 8px (default)

---

### OfflineBanner

**Purpose**: Network status indicator. Shows when device is offline (no internet). Provides fallback mode information.

**Educational Theory**:
- Provides clear feedback about app capability (transparency)

**File**: `frontend/src/components/OfflineBanner.js`
**Lines**: ~60
**Export**: Default function `OfflineBanner`

**Props**:
```typescript
interface OfflineBanner {
  isOnline: boolean;         // True if online, false if offline
}
```

**Usage**:
```jsx
const [isOnline, setIsOnline] = useState(navigator.onLine);

useEffect(() => {
  window.addEventListener('online', () => setIsOnline(true));
  window.addEventListener('offline', () => setIsOnline(false));
}, []);

<OfflineBanner isOnline={isOnline} />
```

**Styling**:
- Top sticky banner (z-index 30, below nav)
- Red/danger background when offline (`#FEF2F1` background, `#D4736B` text)
- Icon: 📡 + "You're offline" message
- Suggests: "Some features may be limited"

**Accessibility**:
- `role="status"` + `aria-live="polite"` (announces changes to screen readers)
- High contrast text

---

## Shared/Utility Components

### ErrorBoundary

**Purpose**: Catches React component errors and displays fallback UI instead of crashing entire app. Logs to Sentry if enabled.

**Educational Theory**:
- Ensures robust experience (no blank screens)

**File**: `frontend/src/components/ErrorBoundary.js`
**Lines**: 96
**Export**: Default class component `ErrorBoundary`

**Usage**:
```jsx
<ErrorBoundary>
  <SessionPage />
</ErrorBoundary>
```

**Features**:
- Catches render errors in child components
- Displays friendly error message with reset button
- Shows error details in development mode only
- Reports to Sentry (if `SENTRY_DSN` is set)
- "Try Again" button to reset error state
- Fallback link to home

**Styling**:
- Centered card with emoji (😊) to feel less scary
- Ghibli card styling
- Development mode shows error stack in `<details>` (hidden by default)

---

### NavBar

**Purpose**: Top navigation (desktop) + bottom navigation (mobile). Filters visible links based on student level via feature gates (§3.7, CLAUDE.md).

**Educational Theory**:
- *Progressive Disclosure* (§3.7): Shows only age-appropriate navigation items
- Beginner: 3 items (Home, Start, Words, Profile)
- Intermediate: 5 items (adds Library, Studio)
- Advanced: 6 items (all + Dashboard)

**File**: `frontend/src/components/NavBar.js`
**Lines**: 106
**Export**: Default function `NavBar`

**Props**: None (uses context for student level)

**Usage**:
```jsx
// Typically in layout.js
<NavBar />
<main id="main-content">...</main>
```

**Features**:
- Skip-to-content link (accessibility)
- SSR-safe (shows all links initially, filters client-side)
- Active route highlighting (current page bold + green background)
- Animated version number (`v1.0`)
- Service worker registration (PWA support)
- Responsive: Desktop horizontal nav (md+), mobile bottom nav (<md)

**Top Navigation (Desktop)**:
- HiMax logo (left) with leaf-sway animation
- Links row (centered), hidden on mobile
- Version badge (right)

**Mobile Navigation (Bottom)**:
- 6 equal-width tabs
- Icon + label
- Sticky bottom (safe area inset for notch)

**Accessibility**:
- `aria-label="Main navigation"` / `aria-label="Mobile navigation"`
- Skip-to-content link (sr-only, visible on focus)
- Links use semantic `<a>` tags
- Current page link has `aria-current="page"` (via Next.js Link behavior)

**Styling**:
- Background: `#D6C9A8` (parchment nav)
- Active link: `#5C8B5C` green + white text
- Hover: `#C8DBC8` light green (non-active)
- Icons: Emoji (no alt text needed, decorative)

---

### ThinkingIndicator

**Purpose**: Shows HiAlice is thinking/processing while generating response. Animated three-dot or leaf-based animation.

**Educational Theory**:
- Provides visual feedback during wait time (prevents impatience)

**File**: `frontend/src/components/ThinkingIndicator.js`
**Lines**: ~100
**Export**: Default function `ThinkingIndicator`

**Usage**:
```jsx
{isThinking && <ThinkingIndicator />}
```

**Styling**:
- Small inline indicator (fits in ChatColumn)
- Option 1: Animated ellipsis ("... • •• •••")
- Option 2: Floating leaves animation
- Color: `#5C8B5C` (primary brand)
- Duration: 1.5–3s loop

---

### ConfettiCelebration

**Purpose**: Celebratory animation when student completes a session or reaches milestone. Animated confetti overlay (or emoji particles).

**Educational Theory**:
- *Emotion-Focused Learning* (§3.9, CLAUDE.md): Positive emotional reinforcement on completion

**File**: `frontend/src/components/ConfettiCelebration.jsx`
**Lines**: ~180
**Export**: Default function `ConfettiCelebration`

**Props**:
```typescript
interface ConfettiCelebration {
  trigger: boolean;          // When true, play celebration
  onComplete?: () => void;   // Called when animation ends
}
```

**Usage**:
```jsx
<ConfettiCelebration
  trigger={sessionComplete}
  onComplete={() => navigate('/session-review')}
/>
```

**Animation**:
- Option 1: Canvas confetti library (lightweight)
- Option 2: CSS emoji particles (🎉 🎊 ⭐ falling from top)
- Duration: 3–5 seconds
- Respects `prefers-reduced-motion` (no animation if enabled, but show celebration screen)

**Accessibility**:
- Not intrusive (can be dismissed)
- `aria-live="polite"` announces "Celebration!" to screen readers
- Doesn't prevent keyboard navigation

---

### AchievementUnlock

**Purpose**: Displays badge unlock animation when student earns achievement (e.g., "Read 5 books", "Master 50 words"). Modal overlay with star-burst animation.

**Educational Theory**:
- *Growth Mindset Language* (§3.8, CLAUDE.md): Celebrates effort/process, not just correctness
- *Emotion-Focused Learning* (§3.9): Positive reinforcement via visual reward

**File**: `frontend/src/components/AchievementUnlock.jsx`
**Lines**: ~200
**Export**: Default function `AchievementUnlock`

**Props**:
```typescript
interface AchievementUnlock {
  badge: {
    id: string;
    icon: string;            // Emoji or image URL
    title: string;           // "5 Books Read"
    description: string;     // "You've completed 5 books!"
    earnedAt: Date;
  };
  onDismiss?: () => void;
}
```

**Usage**:
```jsx
<AchievementUnlock
  badge={{
    id: 'books-5',
    icon: '🏆',
    title: '5 Books Read',
    description: 'You\'ve completed your 5th book!',
    earnedAt: new Date(),
  }}
  onDismiss={() => setShowAchievement(false)}
/>
```

**Animation**:
- Star-burst entrance: `scale(0)` → `scale(1.2)` → `scale(1)` with rotate
- Duration: 600ms, bounce easing
- Auto-dismiss after 4 seconds or on click

**Styling**:
- Modal overlay (center screen)
- Large badge emoji (96px+)
- Title + description text
- "Awesome!" or "Great job!" congratulations message
- Button to continue or auto-progress

---

## Page-Specific Components

### BookCoverIllustration

**Purpose**: SVG-based generative book cover art using Ghibli aesthetic. Creates unique illustrations based on book title, author, genre, and age level.

**Educational Theory**:
- *Emotional Connection* (§3.9, CLAUDE.md): Beautiful covers increase engagement with books

**File**: `frontend/src/components/BookCoverIllustration.jsx`
**Lines**: ~300
**Export**: Default function `BookCoverIllustration`

**Props**:
```typescript
interface BookCoverIllustration {
  book: {
    id: string;
    title: string;
    author: string;
    genre: string;
    level: string;
  };
  className?: string;        // e.g., "w-full aspect-[3/4]"
}
```

**Usage**:
```jsx
<BookCoverIllustration
  book={book}
  className="w-full aspect-[3/4]"
/>
```

**Elements** (procedurally generated):
- Background gradient (varies by genre/level)
- SVG shapes: circles, curves, paths (mountains, trees, sky)
- Ghibli color palette
- Animated elements (leaf-sway, svg-float, svg-twinkle)
- Title text overlay (serif font)

**Styling**:
- SVG container with aspect ratio 3:4 (book proportion)
- SVG viewBox: `0 0 300 400`
- Animations: `.svg-float`, `.svg-twinkle`, `.anim-delay-N`
- CSS filters for depth (blur, brightness)

---

### ImaginationStudio

**Purpose**: Creative writing interface where students write/draw their own story continuation or companion piece after reading. Scaffolds prompts for different levels.

**Educational Theory**:
- *Creative Expression* (dimension 5 in ZPD, §3.5 CLAUDE.md): Students apply learning via creation
- *Scaffolding* (§3.6): Prompts vary by level (Beginner: sentence starters; Advanced: open-ended)

**File**: `frontend/src/components/ImaginationStudio.jsx`
**Lines**: ~250
**Export**: Default function `ImaginationStudio`

**Props**:
```typescript
interface ImaginationStudio {
  studentLevel: 'beginner' | 'intermediate' | 'advanced';
  bookId: string;
  onSave: (story: string) => void;
}
```

**Beginner Mode**:
- Sentence starters: "Once upon a time..." / "One day, ... decided to..."
- Word bank sidebar with easy words
- Simple formatting (bold, italic)
- 100-word target (visual progress bar)

**Intermediate Mode**:
- Open-ended prompt: "What happens next?"
- Character/setting reminders in sidebar
- Basic formatting + emoji insert
- 250-word target

**Advanced Mode**:
- Meta prompt: "Write a companion scene or critique the book's ending"
- Full text editor (formatting, undo/redo)
- Word count (no hard limit)
- Save drafts, revision history

---

### PrintableWorksheet

**Purpose**: Printable/PDF summary of session: conversation log, vocabulary learned, progress metrics. Optimized for A4 printing with print-safe colors.

**Educational Theory**:
- Parent engagement: Shows what child learned in session
- Progress tracking: Quantified growth metrics

**File**: `frontend/src/components/PrintableWorksheet.jsx`
**Lines**: ~350
**Export**: Default function `PrintableWorksheet`

**Props**:
```typescript
interface PrintableWorksheet {
  sessionId: string;
  includeVocab?: boolean;    // Show learned words section
  includeMetrics?: boolean;  // Show scores/confidence
}
```

**Sections**:
1. Header: Book title, date, student name
2. Conversation log: Each turn (Alice + student, side-by-side)
3. Vocabulary: Words used/learned with definitions
4. Growth metrics: Grammar accuracy, comprehension, engagement scores
5. Footer: Print timestamp, HiMax branding

**Styling**:
- Print-optimized CSS (`.print-*` classes in globals.css)
- A4-safe max-width
- No shadows (flatten to solid borders)
- Force color printing: `-webkit-print-color-adjust: exact`
- Hidden screen-only elements (nav, buttons)

---

### ReadingJourneyMap

**Purpose**: Visual timeline of all books a student has completed. Shows progression over time, themes/genres read, growth trajectory.

**Educational Theory**:
- Growth visualization (ZPD dimension 1: Vocabulary Breadth over time)
- Motivational: Visual proof of accomplishment

**File**: `frontend/src/components/ReadingJourneyMap.jsx`
**Lines**: ~280
**Export**: Default function `ReadingJourneyMap`

**Props**:
```typescript
interface ReadingJourneyMap {
  studentId: string;
}
```

**Visualizations**:
- Horizontal timeline: Books in reading order
- Each book tile: Cover + date + level badge
- Color-coded by genre (Fantasy green, Mystery blue, etc.)
- Milestone markers: "10 books!", "100 new words!", "1 month!"
- Stats: Total books, genres explored, reading streak

---

### BookRecommendation

**Purpose**: AI-generated next book suggestion based on student's profile, reading history, and vocabulary mastery.

**Educational Theory**:
- *Personalization*: Recommendations match student's ZPD

**File**: `frontend/src/components/BookRecommendation.jsx`
**Lines**: ~180
**Export**: Default function `BookRecommendation`

**Props**:
```typescript
interface BookRecommendation {
  currentBook: Book;
  studentProfile: {
    level: string;
    favoriteGenres: string[];
    masteredWords: number;
  };
}
```

---

### ChildInsightCard

**Purpose**: Parent/guardian view: Displays child's learning strengths, areas for growth, and recommendations.

**Educational Theory**:
- Transparency with caregivers
- Actionable feedback (not just scores)

**File**: `frontend/src/components/ChildInsightCard.js`
**Lines**: ~220
**Export**: Default function `ChildInsightCard`

**Props**:
```typescript
interface ChildInsightCard {
  studentId: string;
  insights: {
    strengths: string[];     // ["Strong vocabulary", "Creative thinking"]
    growthAreas: string[];   // ["Grammar accuracy", "Confidence in speaking"]
    recommendations: string[];
  };
}
```

---

### ThoughtGarden

**Purpose**: Visual representation of student's key ideas/quotes extracted from session conversations. Implemented as garden metaphor: ideas are flowers/plants that grow with revisits.

**Educational Theory**:
- *Metacognition*: Students see their own thinking reflected back
- *Emotional Connection*: Garden metaphor feels nurturing

**File**: `frontend/src/components/ThoughtGarden.js`
**Lines**: ~320
**Export**: Default function `ThoughtGarden`

**Props**:
```typescript
interface ThoughtGarden {
  studentId: string;
  sessionId?: string;        // If provided, show ideas from this session only
}
```

**Visualization**:
- Garden SVG container (400x300px+)
- Each idea = flower 🌸 or plant
- Size = importance/depth of idea (based on word count, follow-up questions)
- Color = emotion/tone (positive = warm, reflective = cool)
- On hover/click: Show full quote

---

### LoadingCard

**Purpose**: Skeleton placeholder matching BookCard layout exactly (same dimensions, same structure).

**Educational Theory**:
- Perceived performance: Skeleton loading feels faster than blank space

**File**: `frontend/src/components/LoadingCard.jsx`
**Lines**: ~120
**Export**: Default function `LoadingCard`

**Styling**:
- Matches BookCard aspect ratio (3:4)
- Shimmer animation (same as LoadingSkeleton)
- Rounded corners, shadows (visual consistency)

---

## Hooks & Utilities

### useSessionContext

**Purpose**: Access session state (current stage, dialogue history, student level, etc.).

**Location**: `frontend/src/context/SessionContext.js`

**Usage**:
```jsx
const { currentStage, dialogue, studentLevel } = useSessionContext();
```

**Properties**:
- `currentStage`: Current session stage ID
- `dialogue`: Array of all turns in session
- `studentLevel`: 'beginner' | 'intermediate' | 'advanced'
- `getAgeAdaptedStages()`: Returns stage list for this level (4/5/6 stages)
- `addTurn(speaker, text)`: Append conversation turn

---

### useMediaQuery

**Purpose**: Responsive breakpoint detection.

**Usage**:
```jsx
const isMobile = useMediaQuery('(max-width: 640px)');
const isTablet = useMediaQuery('(min-width: 640px) and (max-width: 1024px)');
```

---

## Component Patterns

### Composition Over Props Drilling

**Pattern**: Use Context API for deeply nested data (session state, student level, auth) instead of passing props through many layers.

```jsx
// ✅ Good: Use SessionContext
<SessionProvider>
  <StageRenderer />  {/* accesses context directly */}
</SessionProvider>

// ❌ Avoid: Prop drilling
<StageRenderer stageData={...} level={...} onNext={...} onPrev={...} />
```

### Render Props / Controlled Components

**Pattern**: Input components controlled by parent (VoiceButton, VocabMiniCard).

```jsx
// ✅ Parent controls state
const [isRecording, setIsRecording] = useState(false);
<VoiceButton isRecording={isRecording} onRecordStart={() => setIsRecording(true)} />
```

### Compound Components

**Pattern**: Related components work together (e.g., StageProgress + StageRenderer).

```jsx
<Session>
  <Session.Progress />
  <Session.Chat />
  <Session.VoiceInput />
</Session>
```

---

## Component Performance Tips

### Code Splitting

Large pages (ImaginationStudio, PrintableWorksheet) are code-split via `next/dynamic`:

```jsx
const ImaginationStudio = dynamic(() => import('@/components/ImaginationStudio'), {
  loading: () => <LoadingSkeleton variant="block" />,
});
```

### Memoization

Expensive components (ReadingJourneyMap, ThoughtGarden) use `React.memo` to prevent unnecessary re-renders:

```jsx
export default memo(ReadingJourneyMap, (prev, next) => prev.studentId === next.studentId);
```

### Lazy Loading

Animations and SVG generation are deferred until component mounts:

```jsx
useEffect(() => {
  // Heavy SVG generation happens here, not in render
  generateCoverArt();
}, [book]);
```

---

## Accessibility Checklist for Components

When building new components, verify:

- [ ] Minimum 48px touch target (or tier-specific)
- [ ] Focus ring visible (3px outline)
- [ ] Color contrast ≥ 4.5:1 (AA)
- [ ] Keyboard navigation (Tab, Enter, Escape)
- [ ] ARIA labels for buttons/links
- [ ] `aria-live` for dynamic updates
- [ ] `aria-hidden` for decorative elements
- [ ] Respects `prefers-reduced-motion`
- [ ] Screen reader tested (NVDA, JAWS, VoiceOver)
- [ ] No color-only information

---

## Testing Strategy

### Unit Tests (Components)

```js
// BookCard.test.jsx
describe('BookCard', () => {
  it('renders book title', () => {
    const { getByText } = render(<BookCard book={mockBook} />);
    expect(getByText('Charlotte\'s Web')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = jest.fn();
    const { getByRole } = render(<BookCard book={mockBook} onClick={onClick} />);
    fireEvent.click(getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });

  it('meets WCAG AA color contrast', () => {
    // Use axe-core to verify
  });
});
```

### Integration Tests (Session Flow)

```js
// session.integration.test.js
describe('Session Flow', () => {
  it('completes all 5 stages', async () => {
    // Render full session, progress through stages
    // Verify StageProgress updates
    // Verify dialogue history
  });
});
```

### E2E Tests (Critical User Paths)

```js
// e2e/student-session.spec.js
describe('Student Session', () => {
  it('reads book, completes 4-stage Q&A, views results', async () => {
    // Navigate to books
    // Select book
    // Go through each stage
    // Verify session saved
  });
});
```

---

## File Organization

```
frontend/src/components/
├── BookCard.jsx              (209 lines)
├── VocabMiniCard.js          (248 lines)
├── ErrorBoundary.js          (96 lines)
├── NavBar.js                 (106 lines)
├── VoiceButton.jsx           (200 lines)
├── StageProgress.jsx         (150 lines)
├── LoadingSkeleton.js        (80 lines)
├── OfflineBanner.js          (60 lines)
├── ConfettiCelebration.jsx   (180 lines)
├── AchievementUnlock.jsx     (200 lines)
├── BookCoverIllustration.jsx (300 lines)
├── ImaginationStudio.jsx     (250 lines)
├── PrintableWorksheet.jsx    (350 lines)
├── ReadingJourneyMap.jsx     (280 lines)
├── BookRecommendation.jsx    (180 lines)
├── ChildInsightCard.js       (220 lines)
├── ThoughtGarden.js          (320 lines)
├── ThinkingIndicator.js      (100 lines)
└── LoadingCard.jsx           (120 lines)

Total: ~4,040 lines across 19 components
Average: ~213 lines per component (well under 400-line per-file target)
```

---

## Integration with Design System

All components use tokens from `DESIGN_SYSTEM.md`:

- **Colors**: `#5C8B5C` primary, `#FFFCF3` card, `#3D2E1E` text
- **Typography**: Nunito font, `.page-title`, `.section-title`
- **Spacing**: 8px grid, `p-4`, `gap-4`, etc.
- **Animations**: `float`, `fade-in`, `pulse-mic` (all respect prefers-reduced-motion)
- **Shadows**: `.shadow-ghibli`, `.shadow-ghibli-hover`
- **Breakpoints**: Responsive `sm:`, `md:`, `lg:` classes

---

## Quick Reference: Component Selection

| Need | Component | Props |
|------|-----------|-------|
| Display book | BookCard | `book`, `onClick`, `compact` |
| Teach vocabulary | VocabMiniCard | `word`, `definition`, `example`, `onDismiss` |
| Handle errors | ErrorBoundary | `children` |
| Navigate | NavBar | (uses context) |
| Record voice | VoiceButton | `onRecordStart`, `onRecordEnd`, `isRecording` |
| Show progress | StageProgress | `currentStage`, `totalStages`, `level` |
| Loading state | LoadingSkeleton | `count`, `variant` |
| Network status | OfflineBanner | `isOnline` |
| Celebrate | ConfettiCelebration | `trigger`, `onComplete` |
| Show badge | AchievementUnlock | `badge`, `onDismiss` |
| Book covers | BookCoverIllustration | `book`, `className` |
| Creative writing | ImaginationStudio | `studentLevel`, `bookId`, `onSave` |
| Print summary | PrintableWorksheet | `sessionId`, `includeVocab` |
| Show timeline | ReadingJourneyMap | `studentId` |
| Recommend next book | BookRecommendation | `currentBook`, `studentProfile` |
| Parent insights | ChildInsightCard | `studentId`, `insights` |
| Idea visualization | ThoughtGarden | `studentId`, `sessionId` |
| AI thinking | ThinkingIndicator | (no props) |

---

## Additional Resources

- **Design System**: `DESIGN_SYSTEM.md`
- **Architecture**: `CLAUDE.md` § 6 (Technical Architecture), § 8 (UI/UX)
- **Tailwind Classes**: `tailwind.config.js`
- **Global Styles**: `src/app/globals.css`
- **Constants**: `src/lib/constants.js`

---

*Component Library v1.0 | Last Updated: March 2026*
