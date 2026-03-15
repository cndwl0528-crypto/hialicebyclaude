'use client';

/**
 * book-club/page.js — Book Club & Social Reading for Hi Alice
 *
 * COPPA-safe social reading feature for students aged 6–13.
 * Forum-style discussion only (no real-time DMs). No personal info
 * beyond first name is ever displayed.
 *
 * Views (state-driven):
 *   browse   — list of active clubs (default)
 *   myClubs  — clubs the student has joined
 *   detail   — selected club: members + discussion feed
 *   create   — form to create a new club
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { getItem, setItem } from '@/lib/clientStorage';
import { API_BASE } from '@/lib/constants';

// ── Constants ────────────────────────────────────────────────────────────────

const LEVEL_CONFIG = {
  beginner:     { label: 'Beginner',     color: '#A8E6CF', textColor: '#2E6E4E', icon: '🌱' },
  intermediate: { label: 'Intermediate', color: '#FFD3B6', textColor: '#7A4A1E', icon: '🌿' },
  advanced:     { label: 'Advanced',     color: '#F8B195', textColor: '#7A2E1E', icon: '🌳' },
};

const MAX_THOUGHT_LENGTH = 280;

// ── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_CLUBS = [
  {
    id: 1,
    name: "Charlotte's Web Readers",
    bookTitle: "Charlotte's Web",
    bookEmoji: '🕷️',
    level: 'beginner',
    memberCount: 3,
    maxMembers: 6,
    createdAt: '2026-03-10',
    description: 'A cozy club exploring friendship and sacrifice through E.B. White\'s classic tale.',
  },
  {
    id: 2,
    name: 'Harry Potter Fan Club',
    bookTitle: 'Harry Potter and the Sorcerer\'s Stone',
    bookEmoji: '⚡',
    level: 'intermediate',
    memberCount: 5,
    maxMembers: 6,
    createdAt: '2026-03-08',
    description: 'Dive into the wizarding world! Share your favorite spells and characters.',
  },
  {
    id: 3,
    name: 'Wonder Discussion',
    bookTitle: 'Wonder',
    bookEmoji: '🌟',
    level: 'intermediate',
    memberCount: 2,
    maxMembers: 6,
    createdAt: '2026-03-12',
    description: 'Exploring kindness, courage, and what it means to truly see someone.',
  },
  {
    id: 4,
    name: 'The Giver Circle',
    bookTitle: 'The Giver',
    bookEmoji: '🎨',
    level: 'advanced',
    memberCount: 4,
    maxMembers: 6,
    createdAt: '2026-03-05',
    description: 'Discussing memory, choice, and what makes a society truly free.',
  },
  {
    id: 5,
    name: 'Magic Tree House Club',
    bookTitle: 'Magic Tree House: Dinosaurs Before Dark',
    bookEmoji: '🌴',
    level: 'beginner',
    memberCount: 6,
    maxMembers: 6,
    createdAt: '2026-03-01',
    description: 'Full! Join the wait list to be notified when a spot opens.',
  },
];

const MOCK_MEMBERS = [
  { id: 'u1', name: 'Emma',   initials: 'E', color: '#C8DBC8' },
  { id: 'u2', name: 'Liam',   initials: 'L', color: '#D4C0E8' },
  { id: 'u3', name: 'Sofia',  initials: 'S', color: '#F0D4C4' },
  { id: 'u4', name: 'Noah',   initials: 'N', color: '#C4D4F0' },
  { id: 'u5', name: 'Olivia', initials: 'O', color: '#F0E4C4' },
];

const MOCK_DISCUSSIONS = [
  {
    id: 'd1',
    clubId: 1,
    studentName: 'Emma',
    initials: 'E',
    avatarColor: '#C8DBC8',
    content: 'I loved how Charlotte saved Wilbur! What was your favorite part of the book?',
    createdAt: '2026-03-10T10:00:00Z',
  },
  {
    id: 'd2',
    clubId: 1,
    studentName: 'Liam',
    initials: 'L',
    avatarColor: '#D4C0E8',
    content: 'My favorite was when Wilbur won at the fair! It made me so happy. I also liked Templeton — he was funny even though he was grumpy.',
    createdAt: '2026-03-10T10:05:00Z',
  },
  {
    id: 'd3',
    clubId: 1,
    studentName: 'Sofia',
    initials: 'S',
    avatarColor: '#F0D4C4',
    content: 'Charlotte was so brave and smart. Even though she was tiny, she changed everything. It made me think about how one person can make a big difference.',
    createdAt: '2026-03-11T09:15:00Z',
  },
  {
    id: 'd4',
    clubId: 2,
    studentName: 'Noah',
    initials: 'N',
    avatarColor: '#C4D4F0',
    content: 'If you could go to Hogwarts, which house do you think you would be sorted into?',
    createdAt: '2026-03-09T14:00:00Z',
  },
  {
    id: 'd5',
    clubId: 2,
    studentName: 'Olivia',
    initials: 'O',
    avatarColor: '#F0E4C4',
    content: 'I think I would be in Hufflepuff because I care a lot about being kind and fair. What about you?',
    createdAt: '2026-03-09T14:30:00Z',
  },
];

const BOOK_OPTIONS = [
  { emoji: '🕷️', title: "Charlotte's Web",               level: 'beginner'     },
  { emoji: '🌴', title: 'Magic Tree House',              level: 'beginner'     },
  { emoji: '🐛', title: 'The Very Hungry Caterpillar',   level: 'beginner'     },
  { emoji: '⚡', title: "Harry Potter and the Sorcerer's Stone", level: 'intermediate' },
  { emoji: '🌟', title: 'Wonder',                        level: 'intermediate' },
  { emoji: '🐁', title: 'Stuart Little',                 level: 'intermediate' },
  { emoji: '🎨', title: 'The Giver',                     level: 'advanced'     },
  { emoji: '🦁', title: 'The Lion, the Witch and the Wardrobe', level: 'advanced' },
  { emoji: '🌊', title: 'Island of the Blue Dolphins',   level: 'advanced'     },
];

// ── Utility helpers ──────────────────────────────────────────────────────────

let _idCounter = 0;
function nextId() {
  _idCounter += 1;
  return `local-${Date.now()}-${_idCounter}`;
}

function formatRelativeTime(isoString) {
  const now = new Date('2026-03-15T12:00:00Z');
  const date = new Date(isoString);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1)   return 'just now';
  if (diffMins < 60)  return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24)   return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

function getInitials(name) {
  return (name ?? '?').charAt(0).toUpperCase();
}

const AVATAR_COLORS = [
  '#C8DBC8', '#D4C0E8', '#F0D4C4', '#C4D4F0',
  '#F0E4C4', '#D4E8C4', '#E8C4D4', '#C4E8E4',
];

function pickAvatarColor(name) {
  const code = (name ?? '').charCodeAt(0) || 0;
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

// ── API helpers ──────────────────────────────────────────────────────────────

async function fetchClubsFromApi() {
  const res = await fetch(`${API_BASE}/api/v1/book-clubs`, {
    credentials: 'include',
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  return data.clubs ?? [];
}

async function fetchDiscussionsFromApi(clubId) {
  const res = await fetch(`${API_BASE}/api/v1/book-clubs/${clubId}/discussions`, {
    credentials: 'include',
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  return data.discussions ?? [];
}

// ── Sub-components ───────────────────────────────────────────────────────────

/** Level badge pill */
function LevelBadge({ level }) {
  const cfg = LEVEL_CONFIG[level] ?? LEVEL_CONFIG.beginner;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold"
      style={{ backgroundColor: cfg.color, color: cfg.textColor }}
      aria-label={`Level: ${cfg.label}`}
    >
      <span aria-hidden="true">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

/** Member count indicator */
function MemberCountBadge({ count, max }) {
  const isFull = count >= max;
  return (
    <span
      className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
        isFull ? 'bg-[#F0D4C4] text-[#7A4A1E]' : 'bg-[#E8F5E8] text-[#2E6E4E]'
      }`}
      aria-label={`${count} of ${max} members`}
    >
      {count}/{max} readers
    </span>
  );
}

/** Single avatar circle with initials */
function MemberAvatar({ name, size = 36 }) {
  const color = pickAvatarColor(name);
  return (
    <div
      className="flex items-center justify-center rounded-full flex-shrink-0 font-extrabold select-none"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: size * 0.38,
        color: '#3D2E1E',
        border: '2px solid #F5F0E8',
      }}
      aria-label={`Member: ${name}`}
      role="img"
    >
      {getInitials(name)}
    </div>
  );
}

/** Horizontal scrollable member list */
function MemberList({ members }) {
  if (!members || members.length === 0) {
    return (
      <p className="text-xs text-[#9C8B74] font-semibold italic">No members yet.</p>
    );
  }

  return (
    <div
      className="flex gap-3 overflow-x-auto pb-1"
      style={{ scrollbarWidth: 'none' }}
      role="list"
      aria-label="Club members"
    >
      {members.map((member) => (
        <div
          key={member.id}
          className="flex flex-col items-center gap-1 flex-shrink-0"
          role="listitem"
        >
          <MemberAvatar name={member.name} size={40} />
          <span className="text-[10px] font-bold text-[#6B5744] max-w-[44px] truncate text-center">
            {member.name}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Club card for browse/myClubs views */
function ClubCard({ club, isJoined, onSelect, onJoin, onLeave }) {
  const isFull = club.memberCount >= club.maxMembers;

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(club);
    }
  }

  return (
    <article
      className="rounded-[14px] border border-[#D6C9A8] bg-[#FFFCF3] shadow-[0_2px_12px_rgba(61,46,30,0.06)] transition-all hover:shadow-[0_4px_18px_rgba(61,46,30,0.1)] hover:-translate-y-0.5 overflow-hidden"
      aria-label={`Club: ${club.name}`}
    >
      {/* Clickable card body */}
      <button
        className="w-full text-left p-4 focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] focus:ring-inset rounded-[14px]"
        onClick={() => onSelect(club)}
        onKeyDown={handleKeyDown}
        aria-label={`View ${club.name} details`}
      >
        {/* Header row */}
        <div className="flex items-start gap-3 mb-3">
          {/* Book emoji anchor */}
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl bg-[#F5F0E8] border border-[#D6C9A8]"
            aria-hidden="true"
          >
            {club.bookEmoji}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-extrabold text-[#3D2E1E] leading-tight truncate mb-1">
              {club.name}
            </h3>
            <p className="text-[11px] font-semibold text-[#6B5744] truncate">
              {club.bookTitle}
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-[#6B5744] font-medium leading-relaxed mb-3 line-clamp-2">
          {club.description}
        </p>

        {/* Badges row */}
        <div className="flex items-center gap-2 flex-wrap">
          <LevelBadge level={club.level} />
          <MemberCountBadge count={club.memberCount} max={club.maxMembers} />
        </div>
      </button>

      {/* Action row — kept separate from the card button */}
      <div className="px-4 pb-4 pt-0">
        {isJoined ? (
          <div className="flex gap-2">
            <button
              onClick={() => onSelect(club)}
              className="flex-1 py-2.5 px-3 bg-[#3D6B3D] text-white rounded-xl font-extrabold text-xs hover:bg-[#2D5B2D] transition-all hover:-translate-y-0.5 shadow-[0_3px_8px_rgba(61,107,61,0.28)] min-h-[40px]"
              aria-label={`Open ${club.name}`}
            >
              Open Club
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onLeave(club.id); }}
              className="py-2.5 px-3 bg-[#EDE5D4] text-[#6B5744] rounded-xl font-extrabold text-xs hover:bg-[#D6C9A8] transition-all min-h-[40px]"
              aria-label={`Leave ${club.name}`}
            >
              Leave
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onJoin(club); }}
            disabled={isFull}
            className={`w-full py-2.5 px-3 rounded-xl font-extrabold text-xs transition-all min-h-[40px] ${
              isFull
                ? 'bg-[#EDE5D4] text-[#9C8B74] cursor-not-allowed'
                : 'bg-[#5C8B5C] text-white hover:bg-[#3D6B3D] hover:-translate-y-0.5 shadow-[0_3px_8px_rgba(92,139,92,0.25)]'
            }`}
            aria-label={isFull ? `${club.name} is full` : `Join ${club.name}`}
            aria-disabled={isFull}
          >
            {isFull ? 'Club Full' : 'Join Club'}
          </button>
        )}
      </div>
    </article>
  );
}

/** Single discussion post bubble */
function DiscussionPost({ post, isOwn }) {
  return (
    <div
      className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
      role="article"
      aria-label={`Message from ${post.studentName}`}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 mt-0.5">
        <MemberAvatar name={post.studentName} size={34} />
      </div>

      {/* Bubble */}
      <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
        {!isOwn && (
          <span className="text-[10px] font-extrabold text-[#6B5744] ml-1">
            {post.studentName}
          </span>
        )}
        <div
          className={`px-3 py-2.5 rounded-2xl text-sm font-semibold leading-relaxed ${
            isOwn
              ? 'bg-[#3D6B3D] text-white rounded-tr-none'
              : 'bg-[#FFFCF3] text-[#3D2E1E] border border-[#D6C9A8] rounded-tl-none'
          }`}
        >
          {post.content}
        </div>
        <span className={`text-[10px] font-medium text-[#9C8B74] ${isOwn ? 'mr-1' : 'ml-1'}`}>
          {formatRelativeTime(post.createdAt)}
        </span>
      </div>
    </div>
  );
}

/** Discussion feed with input */
function DiscussionFeed({ discussions, studentName, onPost, isPosting }) {
  const [thought, setThought] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const remaining = MAX_THOUGHT_LENGTH - thought.length;
  const canPost = thought.trim().length > 0 && thought.trim().length <= MAX_THOUGHT_LENGTH && !isPosting;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [discussions]);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && canPost) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleSubmit() {
    if (!canPost) return;
    onPost(thought.trim());
    setThought('');
    setTimeout(() => inputRef.current?.focus(), 80);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Feed */}
      <div
        className="flex-1 overflow-y-auto px-4 py-3 space-y-4 bg-[#F5F0E8]"
        role="log"
        aria-live="polite"
        aria-atomic="false"
        aria-label="Book club discussion"
      >
        {discussions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-5xl mb-3" aria-hidden="true">💬</div>
            <p className="text-sm font-extrabold text-[#3D2E1E] mb-1">No discussions yet</p>
            <p className="text-xs text-[#6B5744] font-semibold">
              Be the first to share your thoughts!
            </p>
          </div>
        )}

        {discussions.map((post) => (
          <DiscussionPost
            key={post.id}
            post={post}
            isOwn={post.studentName === studentName}
          />
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-[#D6C9A8] bg-[#FFFCF3] p-3">
        <div className="flex gap-2 items-end">
          <label htmlFor="book-club-thought" className="sr-only">
            Share your thoughts about the book
          </label>
          <textarea
            id="book-club-thought"
            ref={inputRef}
            value={thought}
            onChange={(e) => setThought(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Share what you thought about the book..."
            rows={2}
            disabled={isPosting}
            maxLength={MAX_THOUGHT_LENGTH + 10}
            className="flex-1 resize-none px-3 py-2.5 rounded-xl border border-[#D6C9A8] bg-[#F5F0E8] text-[#3D2E1E] font-semibold text-sm placeholder:text-[#9C8B74] focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] focus:border-transparent disabled:opacity-50 leading-snug min-h-[52px]"
            aria-label="Share your thoughts about the book"
            aria-describedby="thought-hint"
          />
          <button
            onClick={handleSubmit}
            disabled={!canPost}
            className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-bold transition-all ${
              canPost
                ? 'bg-[#3D6B3D] text-white hover:bg-[#2D5B2D] hover:-translate-y-0.5 shadow-[0_3px_8px_rgba(61,107,61,0.3)]'
                : 'bg-[#EDE5D4] text-[#9C8B74] cursor-not-allowed'
            }`}
            aria-label="Post your thought"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>

        <div className="flex justify-between items-center mt-1.5 px-0.5">
          <p id="thought-hint" className="text-[10px] text-[#9C8B74] font-medium" aria-hidden="true">
            Press Enter to post. Shift + Enter for a new line.
          </p>
          <span
            className={`text-[10px] font-bold ${remaining < 20 ? 'text-[#D4736B]' : 'text-[#9C8B74]'}`}
            aria-live="polite"
            aria-label={`${remaining} characters remaining`}
          >
            {remaining}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Club detail header bar */
function ClubHeader({ club, members, onBack, onLeave }) {
  return (
    <header
      className="rounded-[18px] border border-[#D6C9A8] bg-[linear-gradient(135deg,#eef5dc_0%,#fff8df_45%,#e0eef9_100%)] p-4 shadow-[0_6px_20px_rgba(61,46,30,0.08)]"
      aria-label={`Club: ${club.name}`}
    >
      {/* Nav row */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-extrabold text-[#5C8B5C] hover:text-[#3D6B3D] min-h-[40px] min-w-[40px] px-2 rounded-xl hover:bg-[#E8F5E8] transition-all"
          aria-label="Back to clubs list"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>

        <button
          onClick={onLeave}
          className="text-xs font-extrabold text-[#D4736B] hover:text-[#B85A53] min-h-[40px] px-3 rounded-xl hover:bg-[#F5E8E8] transition-all"
          aria-label={`Leave ${club.name}`}
        >
          Leave Club
        </button>
      </div>

      {/* Club identity */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl bg-[#F5F0E8] border border-[#D6C9A8] flex-shrink-0"
          aria-hidden="true"
        >
          {club.bookEmoji}
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-extrabold text-[#3D2E1E] leading-tight mb-1">
            {club.name}
          </h1>
          <p className="text-xs text-[#6B5744] font-semibold truncate mb-1.5">
            {club.bookTitle}
          </p>
          <div className="flex items-center gap-2">
            <LevelBadge level={club.level} />
            <MemberCountBadge count={club.memberCount} max={club.maxMembers} />
          </div>
        </div>
      </div>

      {/* Members row */}
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#A8822E] mb-2">
          Members
        </p>
        <MemberList members={members} />
      </div>
    </header>
  );
}

/** Create club form */
function CreateClubForm({ studentLevel, onSubmit, onCancel, isSubmitting }) {
  const [clubName, setClubName] = useState('');
  const [selectedBook, setSelectedBook] = useState(null);
  const [nameError, setNameError] = useState('');

  const filteredBooks = BOOK_OPTIONS.filter((b) => {
    if (studentLevel === 'beginner') return b.level === 'beginner';
    if (studentLevel === 'advanced') return true;
    return b.level !== 'advanced';
  });

  const canSubmit = clubName.trim().length >= 3 && selectedBook !== null && !isSubmitting;

  function handleClubNameChange(e) {
    const value = e.target.value;
    setClubName(value);
    if (value.trim().length > 0 && value.trim().length < 3) {
      setNameError('Club name must be at least 3 characters.');
    } else {
      setNameError('');
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({ clubName: clubName.trim(), book: selectedBook });
  }

  return (
    <div className="ghibli-card p-6 max-w-md mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="text-5xl mb-3" aria-hidden="true">📚</div>
        <h2 className="text-xl font-extrabold text-[#3D2E1E] mb-1">Start a Book Club</h2>
        <p className="text-xs text-[#6B5744] font-semibold leading-relaxed">
          Pick a book and give your club a name. Up to 6 readers can join!
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {/* Book selection */}
        <fieldset className="mb-5">
          <legend className="text-sm font-extrabold text-[#3D2E1E] mb-3 block">
            1. Choose a book
          </legend>
          <div className="space-y-2" role="radiogroup" aria-label="Select a book">
            {filteredBooks.map((book) => {
              const isSelected = selectedBook?.title === book.title;
              return (
                <button
                  key={book.title}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setSelectedBook(book)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all min-h-[52px] text-left ${
                    isSelected
                      ? 'border-[#5C8B5C] bg-[#E8F5E8] shadow-[0_2px_8px_rgba(92,139,92,0.18)]'
                      : 'border-[#D6C9A8] bg-[#FFFCF3] hover:border-[#A5C8A5] hover:bg-[#F0F7F0]'
                  }`}
                >
                  <span className="text-xl flex-shrink-0" aria-hidden="true">{book.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-[#3D2E1E] truncate">{book.title}</p>
                    <LevelBadge level={book.level} />
                  </div>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Club name */}
        <div className="mb-6">
          <label
            htmlFor="club-name"
            className="text-sm font-extrabold text-[#3D2E1E] mb-2 block"
          >
            2. Name your club
          </label>
          <input
            id="club-name"
            type="text"
            value={clubName}
            onChange={handleClubNameChange}
            placeholder="e.g. The Magic Readers"
            maxLength={50}
            className="w-full px-4 py-3 rounded-xl border-2 border-[#D6C9A8] bg-[#F5F0E8] text-[#3D2E1E] font-semibold text-sm placeholder:text-[#9C8B74] focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] focus:border-transparent min-h-[52px]"
            aria-label="Club name"
            aria-describedby={nameError ? 'club-name-error' : undefined}
            aria-invalid={nameError ? 'true' : 'false'}
          />
          {nameError && (
            <p id="club-name-error" className="text-xs text-[#D4736B] font-bold mt-1 ml-1" role="alert">
              {nameError}
            </p>
          )}
          <p className="text-[10px] text-[#9C8B74] font-medium mt-1 ml-1">
            Your level ({studentLevel}) will be set automatically.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 px-4 bg-[#EDE5D4] text-[#6B5744] rounded-xl font-extrabold text-sm hover:bg-[#D6C9A8] transition-all min-h-[52px]"
            aria-label="Cancel and go back"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-sm transition-all min-h-[52px] ${
              canSubmit
                ? 'bg-[#3D6B3D] text-white hover:bg-[#2D5B2D] hover:-translate-y-0.5 shadow-[0_4px_12px_rgba(61,107,61,0.32)]'
                : 'bg-[#EDE5D4] text-[#9C8B74] cursor-not-allowed'
            }`}
            aria-disabled={!canSubmit}
          >
            {isSubmitting ? 'Creating...' : 'Create Club'}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Empty state card */
function EmptyState({ emoji, title, subtitle, ctaLabel, onCta }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-6xl mb-4 float-animation inline-block" aria-hidden="true">
        {emoji}
      </div>
      <h3 className="text-lg font-extrabold text-[#3D2E1E] mb-2">{title}</h3>
      <p className="text-sm text-[#6B5744] font-semibold mb-6 max-w-xs leading-relaxed">
        {subtitle}
      </p>
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          className="py-3 px-8 bg-[#3D6B3D] text-white rounded-2xl font-extrabold text-sm hover:bg-[#2D5B2D] transition-all hover:-translate-y-0.5 shadow-[0_4px_12px_rgba(61,107,61,0.32)] min-h-[52px]"
          aria-label={ctaLabel}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}

/** Loading skeleton cards */
function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-label="Loading clubs..." aria-busy="true">
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className="rounded-[14px] border border-[#D6C9A8] bg-[#FFFCF3] p-4 animate-pulse"
          aria-hidden="true"
        >
          <div className="flex gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-[#EDE5D4]" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 bg-[#EDE5D4] rounded-full w-3/4" />
              <div className="h-3 bg-[#EDE5D4] rounded-full w-1/2" />
            </div>
          </div>
          <div className="space-y-2 mb-3">
            <div className="h-3 bg-[#EDE5D4] rounded-full w-full" />
            <div className="h-3 bg-[#EDE5D4] rounded-full w-4/5" />
          </div>
          <div className="h-8 bg-[#EDE5D4] rounded-xl w-full mt-4" />
        </div>
      ))}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function BookClubPage() {
  // ── Student identity ───────────────────────────────────────────────────────
  const [studentName,  setStudentName]  = useState('');
  const [studentLevel, setStudentLevel] = useState('beginner');
  const [isHydrated,   setIsHydrated]   = useState(false);

  // ── View routing ──────────────────────────────────────────────────────────
  const [view, setView] = useState('browse'); // 'browse' | 'myClubs' | 'detail' | 'create'

  // ── Clubs data ────────────────────────────────────────────────────────────
  const [clubs,        setClubs]        = useState([]);
  const [myClubIds,    setMyClubIds]    = useState(new Set());
  const [selectedClub, setSelectedClub] = useState(null);
  const [discussions,  setDiscussions]  = useState([]);
  const [clubMembers,  setClubMembers]  = useState([]);

  // ── Loading / error ───────────────────────────────────────────────────────
  const [isLoading,    setIsLoading]    = useState(false);
  const [isPosting,    setIsPosting]    = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg,     setErrorMsg]     = useState('');

  // ── Keyboard escape handling ref ─────────────────────────────────────────
  const prevViewRef = useRef('browse');

  // ── Hydrate from storage on mount ─────────────────────────────────────────
  useEffect(() => {
    const name  = getItem('studentName')  ?? '';
    const level = getItem('studentLevel') ?? 'beginner';
    const joinedRaw = getItem('bookClubJoinedIds');

    setStudentName(name);
    setStudentLevel(level.toLowerCase());

    if (joinedRaw) {
      try {
        const ids = JSON.parse(joinedRaw);
        setMyClubIds(new Set(ids));
      } catch {
        setMyClubIds(new Set());
      }
    }

    setIsHydrated(true);
  }, []);

  // ── Load clubs once hydrated ───────────────────────────────────────────────
  useEffect(() => {
    if (!isHydrated) return;
    loadClubs();
  }, [isHydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keyboard: Escape goes back ─────────────────────────────────────────────
  useEffect(() => {
    function handleGlobalKeyDown(e) {
      if (e.key === 'Escape') {
        if (view === 'detail' || view === 'create') {
          setView(prevViewRef.current === 'detail' ? 'browse' : prevViewRef.current);
          setSelectedClub(null);
        }
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [view]);

  // ── Data fetching ─────────────────────────────────────────────────────────

  async function loadClubs() {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const data = await fetchClubsFromApi();
      setClubs(data);
    } catch {
      // API unavailable — fall back to mock data
      setClubs(MOCK_CLUBS);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadDiscussions(clubId) {
    setIsLoading(true);
    try {
      const data = await fetchDiscussionsFromApi(clubId);
      setDiscussions(data);
    } catch {
      // Fall back to mock data filtered by club
      setDiscussions(MOCK_DISCUSSIONS.filter((d) => d.clubId === clubId));
    } finally {
      setIsLoading(false);
    }
  }

  // ── Club actions ──────────────────────────────────────────────────────────

  const handleSelectClub = useCallback(async (club) => {
    prevViewRef.current = view;
    setSelectedClub(club);
    setDiscussions([]);
    setClubMembers(MOCK_MEMBERS.slice(0, club.memberCount));
    setView('detail');
    await loadDiscussions(club.id);
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  const persistJoinedIds = useCallback((newSet) => {
    setItem('bookClubJoinedIds', JSON.stringify([...newSet]));
  }, []);

  const handleJoin = useCallback((club) => {
    if (club.memberCount >= club.maxMembers) return;

    setMyClubIds((prev) => {
      const next = new Set(prev);
      next.add(club.id);
      persistJoinedIds(next);
      return next;
    });

    // Optimistic local update to member count
    setClubs((prev) =>
      prev.map((c) =>
        c.id === club.id
          ? { ...c, memberCount: Math.min(c.memberCount + 1, c.maxMembers) }
          : c
      )
    );
  }, [persistJoinedIds]);

  const handleLeave = useCallback((clubId) => {
    setMyClubIds((prev) => {
      const next = new Set(prev);
      next.delete(clubId);
      persistJoinedIds(next);
      return next;
    });

    setClubs((prev) =>
      prev.map((c) =>
        c.id === clubId
          ? { ...c, memberCount: Math.max(c.memberCount - 1, 0) }
          : c
      )
    );

    // If leaving from detail view, navigate back
    if (view === 'detail' && selectedClub?.id === clubId) {
      setSelectedClub(null);
      setView('browse');
    }
  }, [view, selectedClub, persistJoinedIds]);

  const handlePostThought = useCallback(async (content) => {
    if (!content || isPosting) return;

    const newPost = {
      id: nextId(),
      clubId: selectedClub?.id,
      studentName: studentName || 'You',
      initials: getInitials(studentName || 'You'),
      avatarColor: pickAvatarColor(studentName || 'You'),
      content,
      createdAt: new Date().toISOString(),
    };

    // Optimistic update
    setDiscussions((prev) => [...prev, newPost]);
    setIsPosting(true);

    try {
      await fetch(`${API_BASE}/api/v1/book-clubs/${selectedClub?.id}/discussions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Optimistic post stays visible even if API call fails
    } finally {
      setIsPosting(false);
    }
  }, [isPosting, selectedClub, studentName]);

  const handleCreateClub = useCallback(async ({ clubName, book }) => {
    setIsSubmitting(true);
    setErrorMsg('');

    const newClub = {
      id: nextId(),
      name: clubName,
      bookTitle: book.title,
      bookEmoji: book.emoji,
      level: studentLevel,
      memberCount: 1,
      maxMembers: 6,
      createdAt: new Date().toISOString().slice(0, 10),
      description: `A new club reading "${book.title}". Come share your thoughts!`,
    };

    try {
      await fetch(`${API_BASE}/api/v1/book-clubs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: clubName, bookTitle: book.title, level: studentLevel }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Continue with local-only club
    }

    // Add to local state
    setClubs((prev) => [newClub, ...prev]);
    setMyClubIds((prev) => {
      const next = new Set(prev);
      next.add(newClub.id);
      persistJoinedIds(next);
      return next;
    });

    setIsSubmitting(false);
    setView('myClubs');
  }, [studentLevel, persistJoinedIds]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const myClubs = clubs.filter((c) => myClubIds.has(c.id));

  // ── Pre-hydration guard ───────────────────────────────────────────────────

  if (!isHydrated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3 float-animation inline-block" aria-hidden="true">📚</div>
          <p className="text-[#6B5744] font-bold">Loading Book Clubs...</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 pb-8">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      {view !== 'detail' && (
        <header
          className="rounded-[24px] border border-[#D6C9A8] bg-[linear-gradient(135deg,#eef5dc_0%,#fff8df_45%,#e0eef9_100%)] p-5 shadow-[0_8px_24px_rgba(61,46,30,0.08)]"
          aria-label="Book Club page"
        >
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl" aria-hidden="true">📚</span>
                <h1 className="text-xl font-extrabold text-[#3D2E1E]">Book Club</h1>
              </div>
              <p className="text-xs font-semibold text-[#6B5744] leading-relaxed max-w-sm">
                Join a reading group, meet other readers, and share your thoughts about books.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/library"
                className="text-xs text-[#6B5744] hover:text-[#5C8B5C] flex items-center gap-1 px-3 py-2 rounded-xl border border-[#D6C9A8] hover:border-[#5C8B5C] transition-all min-h-[40px] font-bold whitespace-nowrap"
                aria-label="Go to library"
              >
                Library
              </Link>
              <button
                onClick={() => { prevViewRef.current = view; setView('create'); }}
                className="text-xs bg-[#D4A843] text-white px-4 py-2 rounded-xl font-extrabold hover:bg-[#A8822E] transition-all hover:-translate-y-0.5 shadow-[0_3px_8px_rgba(212,168,67,0.3)] min-h-[40px] whitespace-nowrap"
                aria-label="Create a new book club"
              >
                + New Club
              </button>
            </div>
          </div>

          {/* View tabs */}
          {view !== 'create' && (
            <div
              className="flex gap-1 mt-4 bg-[#EDE5D4] rounded-xl p-1"
              role="tablist"
              aria-label="Book club views"
            >
              {[
                { key: 'browse',  label: 'Browse Clubs', count: clubs.length },
                { key: 'myClubs', label: 'My Clubs',     count: myClubs.length },
              ].map(({ key, label, count }) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={view === key}
                  aria-controls={`tabpanel-${key}`}
                  onClick={() => setView(key)}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 min-h-[40px] ${
                    view === key
                      ? 'bg-white text-[#3D2E1E] shadow-[0_2px_6px_rgba(61,46,30,0.1)]'
                      : 'text-[#6B5744] hover:text-[#3D2E1E]'
                  }`}
                >
                  {label}
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                      view === key
                        ? 'bg-[#E8F5E8] text-[#3D6B3D]'
                        : 'bg-[#D6C9A8] text-[#6B5744]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </header>
      )}

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {errorMsg && (
        <div
          className="rounded-xl bg-[#F5E8E8] border border-[#D4736B] px-4 py-3 flex items-start gap-2"
          role="alert"
        >
          <span className="text-[#D4736B] font-bold text-sm flex-1">{errorMsg}</span>
          <button
            onClick={() => setErrorMsg('')}
            className="text-[#D4736B] hover:text-[#B85A53] font-extrabold text-xs min-h-[28px] min-w-[28px] flex items-center justify-center"
            aria-label="Dismiss error"
          >
            x
          </button>
        </div>
      )}

      {/* ── Browse Clubs ─────────────────────────────────────────────────── */}
      {view === 'browse' && (
        <section
          id="tabpanel-browse"
          role="tabpanel"
          aria-label="Browse all clubs"
        >
          {isLoading ? (
            <LoadingSkeleton />
          ) : clubs.length === 0 ? (
            <EmptyState
              emoji="🌱"
              title="No clubs yet"
              subtitle="Be the first to start a book club and invite other readers to join!"
              ctaLabel="Start a Club"
              onCta={() => setView('create')}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {clubs.map((club) => (
                <ClubCard
                  key={club.id}
                  club={club}
                  isJoined={myClubIds.has(club.id)}
                  onSelect={handleSelectClub}
                  onJoin={handleJoin}
                  onLeave={handleLeave}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── My Clubs ─────────────────────────────────────────────────────── */}
      {view === 'myClubs' && (
        <section
          id="tabpanel-myClubs"
          role="tabpanel"
          aria-label="My book clubs"
        >
          {myClubs.length === 0 ? (
            <EmptyState
              emoji="📖"
              title="No clubs joined yet"
              subtitle="Browse the clubs tab and join a reading group to get started!"
              ctaLabel="Browse Clubs"
              onCta={() => setView('browse')}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {myClubs.map((club) => (
                <ClubCard
                  key={club.id}
                  club={club}
                  isJoined
                  onSelect={handleSelectClub}
                  onJoin={handleJoin}
                  onLeave={handleLeave}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Club Detail ───────────────────────────────────────────────────── */}
      {view === 'detail' && selectedClub && (
        <section aria-label={`Club: ${selectedClub.name}`}>
          <ClubHeader
            club={selectedClub}
            members={clubMembers}
            onBack={() => { setView(prevViewRef.current === 'myClubs' ? 'myClubs' : 'browse'); setSelectedClub(null); }}
            onLeave={() => handleLeave(selectedClub.id)}
          />

          {/* Discussion panel */}
          <div
            className="mt-4 rounded-[18px] border border-[#D6C9A8] bg-[#FFFCF3] shadow-[0_4px_16px_rgba(61,46,30,0.06)] overflow-hidden"
            style={{ minHeight: '420px', maxHeight: '60vh', display: 'flex', flexDirection: 'column' }}
          >
            {/* Panel header */}
            <div className="border-b border-[#D6C9A8] px-4 py-3 bg-[#FFFCF3] flex-shrink-0 flex items-center justify-between">
              <div>
                <p className="text-xs font-extrabold text-[#3D2E1E]">Discussion Board</p>
                <p className="text-[10px] font-semibold text-[#6B5744] mt-0.5">
                  Share your thoughts about {selectedClub.bookTitle}
                </p>
              </div>
              {isLoading && (
                <div className="flex gap-1" aria-label="Loading..." aria-busy="true">
                  {[0, 0.15, 0.3].map((d) => (
                    <div
                      key={d}
                      className="w-1.5 h-1.5 rounded-full bg-[#5C8B5C] animate-bounce"
                      style={{ animationDelay: `${d}s` }}
                      aria-hidden="true"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Feed */}
            <div className="flex-1 overflow-hidden">
              <DiscussionFeed
                discussions={discussions}
                studentName={studentName}
                onPost={handlePostThought}
                isPosting={isPosting}
              />
            </div>
          </div>

          {/* COPPA notice */}
          <p className="text-center text-[10px] text-[#9C8B74] font-semibold mt-3 leading-relaxed">
            Discussion posts are reviewed. Share book thoughts only — no personal information.
          </p>
        </section>
      )}

      {/* ── Create Club ───────────────────────────────────────────────────── */}
      {view === 'create' && (
        <section aria-label="Create a new book club">
          <CreateClubForm
            studentLevel={studentLevel}
            onSubmit={handleCreateClub}
            onCancel={() => setView(prevViewRef.current === 'myClubs' ? 'myClubs' : 'browse')}
            isSubmitting={isSubmitting}
          />
        </section>
      )}

    </div>
  );
}
