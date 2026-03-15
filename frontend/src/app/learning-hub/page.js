'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getItem } from '@/lib/clientStorage';

// ── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_ROLES = ['parent', 'admin', 'super_admin'];

const AGE_GROUPS = [
  {
    id: 'beginner',
    range: '6-8세',
    label: 'Beginner',
    color: '#5C8B5C',
    bgColor: '#EEF5EE',
    borderColor: '#5C8B5C',
    tips: [
      {
        title: '함께 읽기',
        detail:
          'Read aloud together and point at pictures. Ask open questions like "What do you see here?" to make illustrations part of the conversation.',
      },
      {
        title: '짧은 세션',
        detail:
          'Keep sessions to 10–15 minutes maximum. Celebrate every small win — finishing a page, saying a new word — to build positive associations with reading.',
      },
      {
        title: '그림 활용',
        detail:
          'Use illustrations as vocabulary scaffolds. Name objects in the picture before reading the text so new words land with a visual anchor.',
      },
    ],
  },
  {
    id: 'intermediate',
    range: '9-11세',
    label: 'Intermediate',
    color: '#D4A843',
    bgColor: '#FBF3DC',
    borderColor: '#D4A843',
    tips: [
      {
        title: '독립 읽기 전환',
        detail:
          'Let them read independently first, then discuss afterwards. Resist the urge to step in — the productive struggle builds comprehension stamina.',
      },
      {
        title: '질문하기',
        detail:
          'Ask open-ended questions about characters\' feelings and motivations: "Why do you think she made that choice?" rather than "What happened next?"',
      },
      {
        title: '어휘 노트',
        detail:
          'Keep a shared vocabulary notebook. After each session, pick two or three new words and write example sentences together — making it a collaborative ritual.',
      },
    ],
  },
  {
    id: 'advanced',
    range: '12-13세',
    label: 'Advanced',
    color: '#D4736B',
    bgColor: '#FAEAE9',
    borderColor: '#D4736B',
    tips: [
      {
        title: '비판적 사고',
        detail:
          'Discuss themes, the author\'s intent, and alternative endings. "What would you change about the ending, and why?" sparks genuine critical engagement.',
      },
      {
        title: '비교 독서',
        detail:
          'Compare books with similar themes or characters. Connecting across texts builds the comparative analysis skills central to advanced reading.',
      },
      {
        title: '영어 일기',
        detail:
          'Encourage writing short responses in English after each session — even two or three sentences. Writing reinforces vocabulary and grammar far more than passive reading alone.',
      },
    ],
  },
];

const METRICS = [
  {
    id: 'grammar',
    title: 'Grammar Score',
    description:
      'Measures sentence structure accuracy, subject-verb agreement, tense consistency, and correct use of articles and prepositions. A score of 70+ is considered good; 85+ is excellent. The best way to improve is consistent speaking practice and re-reading sessions.',
    thresholds: [
      { label: 'Needs work', range: 'Below 70', color: '#D4736B' },
      { label: 'Good', range: '70–84', color: '#D4A843' },
      { label: 'Excellent', range: '85+', color: '#5C8B5C' },
    ],
  },
  {
    id: 'vocab',
    title: 'Vocabulary Growth',
    description:
      'Tracks every new word your child uses across sessions. Alice uses spaced repetition — a method where words are reviewed at increasing intervals — to move words from short-term exposure into long-term memory. The vocabulary panel shows mastery level for each word.',
    thresholds: null,
  },
  {
    id: 'stages',
    title: 'Session Stages',
    description:
      'Each session moves through four stages: Warm Connection (building comfort and recalling the story), Deep Dive (exploring characters and plot), Cross Book (connecting themes to other books or real life), and Wrap Up (summarising key takeaways). Progress through stages means your child is deepening engagement.',
    thresholds: null,
  },
  {
    id: 'levels',
    title: 'Level System',
    description:
      'Students are placed at Beginner, Intermediate, or Advanced based on age and assessed reading ability. Alice adjusts question complexity, vocabulary, and expected response length automatically. Levels advance when consistent performance over multiple sessions shows readiness — never suddenly or without evidence.',
    thresholds: null,
  },
];

const HOME_ACTIVITIES = [
  {
    id: 'word-day',
    title: 'Word of the Day',
    description:
      'Pick one word from the session and challenge the whole family to use it five times before bedtime. Whoever uses it most creatively wins.',
  },
  {
    id: 'retelling',
    title: 'Story Retelling',
    description:
      'Ask your child to retell the book in their own words — no help from you. Summarising from memory is one of the most powerful comprehension exercises there is.',
  },
  {
    id: 'character-interview',
    title: 'Character Interview',
    description:
      'Your child plays a book character; you interview them. Simple questions like "How did you feel when that happened?" build perspective-taking and oral fluency simultaneously.',
  },
  {
    id: 'drawing',
    title: 'Drawing Response',
    description:
      'Draw the favourite scene together, then describe it in English. The visual creation process activates a different memory pathway and anchors vocabulary concretely.',
  },
  {
    id: 'treasure-hunt',
    title: 'Vocabulary Treasure Hunt',
    description:
      'After the session, challenge your child to spot any session vocabulary words in daily life — on signs, in conversations, on TV. Finding words in the wild cements them.',
  },
  {
    id: 'calendar',
    title: 'Reading Calendar',
    description:
      'Print or draw a monthly grid. Mark each day your child reads with a sticker or a colour. Visual streaks create their own momentum — children hate breaking a chain.',
  },
];

const FAQS = [
  {
    id: 'faq-hard',
    question: '아이가 영어로 대답하기 어려워해요',
    answer:
      'This is completely normal, especially in the early stages. Encourage your child to try even one English word — Alice is trained to accept mixed-language responses warmly and build from there. Never pressure for perfect English; comfort comes first, fluency follows. You can also practise the session questions together in advance so the material feels familiar.',
  },
  {
    id: 'faq-frequency',
    question: '매일 하는 것이 좋을까요?',
    answer:
      'Three to four sessions per week is the research-backed sweet spot. Daily sessions can work for highly motivated readers, but rest days allow vocabulary to consolidate. Consistency over time matters far more than daily frequency — a reliable routine on school days, for instance, outperforms intensive weekend-only sessions.',
  },
  {
    id: 'faq-safety',
    question: 'AI가 아이와 대화하는 것이 안전한가요?',
    answer:
      'Yes. Hi Alice is designed with children\'s safety as the primary constraint. All conversations are filtered through content-safety layers that block any inappropriate topics before they reach your child. The system is built in compliance with COPPA (Children\'s Online Privacy Protection Act) — no personal data is sold or shared. Parents can review full session transcripts at any time from the dashboard.',
  },
  {
    id: 'faq-length',
    question: '세션이 너무 길어요',
    answer:
      'Session length adapts to the child\'s age automatically — Beginner sessions average 10–12 minutes, Intermediate 15–20, and Advanced up to 25. If your child needs a break, they can pause mid-session and resume later without losing progress. You can also set a preferred session-length limit in the parent dashboard settings.',
  },
  {
    id: 'faq-memory',
    question: '어휘를 더 잘 기억하게 하려면?',
    answer:
      'Alice uses spaced repetition internally, but home reinforcement dramatically accelerates retention. The most effective strategy is active recall: ask your child to use the word in a sentence rather than just recognise it. The "Word of the Day" and "Vocabulary Treasure Hunt" activities on this page are designed exactly for this purpose.',
  },
  {
    id: 'faq-level',
    question: '아이 레벨이 맞지 않는 것 같아요',
    answer:
      'If sessions feel consistently too easy or too difficult, contact your admin or use the feedback button in the session screen. Alice recalibrates over time based on response quality, but a manual review by your teacher or admin will get the level adjusted faster. A slight stretch beyond current comfort is intentional and healthy — it is what the i+1 input principle prescribes.',
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function BookIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect x="6" y="4" width="28" height="36" rx="3" fill="#5C8B5C" />
      <rect x="8" y="6" width="24" height="32" rx="2" fill="#EEF5EE" />
      <line x1="12" y1="14" x2="28" y2="14" stroke="#5C8B5C" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="20" x2="28" y2="20" stroke="#5C8B5C" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="26" x2="22" y2="26" stroke="#5C8B5C" strokeWidth="2" strokeLinecap="round" />
      <rect x="34" y="8" width="8" height="34" rx="2" fill="#D4A843" />
      <line x1="34" y1="16" x2="42" y2="16" stroke="#B8891E" strokeWidth="1" />
    </svg>
  );
}

function ChevronIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="w-4 h-4"
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function StarIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="#D4A843"
      aria-hidden="true"
      className={className}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

// Age card with expandable tip list
function AgeCard({ group, isExpanded, onToggle }) {
  const headingId = `age-heading-${group.id}`;
  const panelId = `age-panel-${group.id}`;

  return (
    <div
      className="rounded-2xl border-2 overflow-hidden transition-shadow duration-200"
      style={{
        borderColor: isExpanded ? group.borderColor : '#E8DEC8',
        boxShadow: isExpanded
          ? `0 6px 24px rgba(61,46,30,0.10)`
          : '0 2px 8px rgba(61,46,30,0.05)',
        backgroundColor: '#FFFCF3',
      }}
    >
      <button
        id={headingId}
        aria-expanded={isExpanded}
        aria-controls={panelId}
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset"
        style={{
          backgroundColor: isExpanded ? group.bgColor : 'transparent',
          '--tw-ring-color': group.borderColor,
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-extrabold text-white"
            style={{ backgroundColor: group.color }}
            aria-hidden="true"
          >
            {group.range.split('-')[0]}
          </span>
          <div className="min-w-0">
            <p className="font-extrabold text-[#3D2E1E] leading-tight">{group.range}</p>
            <p className="text-xs font-semibold" style={{ color: group.color }}>
              {group.label}
            </p>
          </div>
        </div>
        <ChevronIcon
          className={`w-5 h-5 flex-shrink-0 ml-2 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={headingId}
        hidden={!isExpanded}
        className="border-t"
        style={{ borderColor: group.bgColor }}
      >
        <ul className="divide-y divide-[#F0EAD8]">
          {group.tips.map((tip) => (
            <li key={tip.title} className="px-5 py-4">
              <p
                className="text-sm font-bold mb-1"
                style={{ color: group.color }}
              >
                {tip.title}
              </p>
              <p className="text-sm text-[#6B5744] leading-relaxed">{tip.detail}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Metric accordion item using native details/summary for progressive enhancement
function MetricItem({ metric }) {
  return (
    <details
      name="metrics-accordion"
      className="group border border-[#E8DEC8] rounded-xl overflow-hidden bg-[#FFFCF3]"
    >
      <summary
        className="flex items-center justify-between px-5 py-4 cursor-pointer list-none
          hover:bg-[#F5F0E8] transition-colors focus:outline-none
          focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5C8B5C]"
      >
        <span className="font-bold text-[#3D2E1E] text-sm">{metric.title}</span>
        <ChevronIcon className="w-4 h-4 text-[#6B5744] flex-shrink-0 ml-2 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="px-5 pb-5 pt-1 border-t border-[#F0EAD8]">
        <p className="text-sm text-[#6B5744] leading-relaxed">{metric.description}</p>
        {metric.thresholds && (
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Score thresholds">
            {metric.thresholds.map((t) => (
              <span
                key={t.label}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: t.color }}
              >
                {t.range} — {t.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

// Activity card (non-interactive, display only)
function ActivityCard({ activity }) {
  return (
    <div
      className="bg-[#FFFCF3] border border-[#E8DEC8] rounded-2xl p-4"
      aria-label={activity.title}
    >
      <div className="flex items-center gap-2 mb-2">
        <StarIcon className="w-4 h-4 flex-shrink-0" />
        <p className="font-bold text-[#3D2E1E] text-sm">{activity.title}</p>
      </div>
      <p className="text-sm text-[#6B5744] leading-relaxed">{activity.description}</p>
    </div>
  );
}

// FAQ accordion item using native details/summary
function FaqItem({ faq }) {
  return (
    <details
      name="faq-accordion"
      className="group border border-[#E8DEC8] rounded-xl overflow-hidden bg-[#FFFCF3]"
    >
      <summary
        className="flex items-center justify-between px-5 py-4 cursor-pointer list-none
          hover:bg-[#F5F0E8] transition-colors focus:outline-none
          focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5C8B5C]"
      >
        <span className="font-bold text-[#3D2E1E] text-sm pr-2">{faq.question}</span>
        <ChevronIcon className="w-4 h-4 text-[#6B5744] flex-shrink-0 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="px-5 pb-5 pt-1 border-t border-[#F0EAD8]">
        <p className="text-sm text-[#6B5744] leading-relaxed">{faq.answer}</p>
      </div>
    </details>
  );
}

// Section heading component for visual consistency
function SectionHeading({ title, subtitle }) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-extrabold text-[#3D2E1E]">{title}</h2>
      {subtitle && (
        <p className="text-sm text-[#6B5744] mt-1 leading-relaxed">{subtitle}</p>
      )}
    </div>
  );
}

// ── Main page component ───────────────────────────────────────────────────────

export default function LearningHubPage() {
  const router = useRouter();
  const [expandedAge, setExpandedAge] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Auth guard — redirect to home if role is not allowed
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const role = getItem('userRole');
    if (!ALLOWED_ROLES.includes(role)) {
      router.replace('/');
      return;
    }
    setAuthChecked(true);
  }, [router]);

  const handleAgeToggle = (groupId) => {
    setExpandedAge((prev) => (prev === groupId ? null : groupId));
  };

  // Do not render content until auth is confirmed to avoid layout flash
  if (!authChecked) {
    return (
      <div
        className="min-h-[50vh] flex items-center justify-center"
        role="status"
        aria-live="polite"
        aria-label="Checking access..."
      >
        <div className="w-8 h-8 rounded-full border-4 border-[#5C8B5C] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-10 pb-20">

        {/* ── Section 1: Hero ─────────────────────────────────────────────── */}
        <section aria-labelledby="hero-heading">
          <div
            className="rounded-3xl p-7 text-center"
            style={{
              background: 'linear-gradient(135deg, #3D6B3D 0%, #5C8B5C 60%, #7AAE7A 100%)',
              boxShadow: '0 8px 32px rgba(61,107,61,0.28)',
            }}
          >
            <BookIcon className="w-16 h-16 mx-auto mb-4" />
            <h1
              id="hero-heading"
              className="text-3xl font-extrabold text-white tracking-tight"
            >
              학습 가이드
            </h1>
            <p className="mt-2 text-base font-semibold text-[#C8E6C8] leading-relaxed">
              아이의 영어 읽기 성장을 위한 부모 가이드
            </p>
            <p className="mt-1 text-sm text-[#A8CDA8]">
              A practical companion for every stage of your child&apos;s reading journey
            </p>
          </div>
        </section>

        {/* ── Section 2: Age-Based Reading Tips ──────────────────────────── */}
        <section aria-labelledby="age-tips-heading">
          <SectionHeading
            title="연령별 독서 가이드"
            subtitle="Each age group benefits from different reading strategies. Expand your child's group to see tailored tips."
          />
          <div className="space-y-3" role="list" aria-label="Age group reading tips">
            {AGE_GROUPS.map((group) => (
              <div key={group.id} role="listitem">
                <AgeCard
                  group={group}
                  isExpanded={expandedAge === group.id}
                  onToggle={() => handleAgeToggle(group.id)}
                />
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 3: Understanding Alice's Feedback ──────────────────── */}
        <section aria-labelledby="metrics-heading">
          <SectionHeading
            title="Alice 피드백 이해하기"
            subtitle="What each metric in the session report actually means, and how to use it to guide your child."
          />
          <div className="space-y-2" role="list" aria-label="Session metric explanations">
            {METRICS.map((metric) => (
              <div key={metric.id} role="listitem">
                <MetricItem metric={metric} />
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 4: Home Activities ─────────────────────────────────── */}
        <section aria-labelledby="activities-heading">
          <SectionHeading
            title="집에서 할 수 있는 활동"
            subtitle="Simple activities that reinforce what Alice teaches — no materials needed beyond everyday items."
          />
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
            role="list"
            aria-label="Home learning activities"
          >
            {HOME_ACTIVITIES.map((activity) => (
              <div key={activity.id} role="listitem">
                <ActivityCard activity={activity} />
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 5: FAQ ──────────────────────────────────────────────── */}
        <section aria-labelledby="faq-heading">
          <SectionHeading
            title="자주 묻는 질문"
            subtitle="Common questions from parents using Hi Alice — answered honestly."
          />
          <div className="space-y-2" role="list" aria-label="Frequently asked questions">
            {FAQS.map((faq) => (
              <div key={faq.id} role="listitem">
                <FaqItem faq={faq} />
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 6: Back to Dashboard ───────────────────────────────── */}
        <section aria-label="Navigation" className="pt-2 pb-4">
          <div className="flex justify-center">
            <Link
              href="/parent"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-2xl font-extrabold text-white
                transition-all duration-200
                focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3D6B3D] focus-visible:ring-offset-2"
              style={{
                backgroundColor: '#3D6B3D',
                boxShadow: '0 4px 16px rgba(61,107,61,0.30)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#5C8B5C';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#3D6B3D';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <ArrowLeftIcon />
              부모 대시보드로 돌아가기
            </Link>
          </div>
          <p className="text-center text-xs text-[#9C8B74] mt-3">
            Back to Parent Dashboard
          </p>
        </section>

      </div>

      {/* Print stylesheet — rendered only when printing */}
      <style>{`
        @media print {
          nav, footer { display: none !important; }
          body { background: white !important; font-size: 11pt; }
          section { break-inside: avoid; margin-bottom: 1.5rem; }
          details { border: 1px solid #ccc !important; }
          details[open] summary ~ * { display: block !important; }
          a[href="/parent"] { display: none !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-spin { animation: none !important; }
        }
        details > summary { user-select: none; }
        details[name] {}
      `}</style>
    </div>
  );
}
