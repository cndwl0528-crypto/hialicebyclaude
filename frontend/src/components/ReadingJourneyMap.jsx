'use client';

const STEPS = [
  {
    id: 'login',
    title: '1. Child Login',
    emoji: '👋',
    description: '아이 선택 후 최근 읽은 책, 추천 책, 이어하기 세션을 바로 보여줍니다.',
    outcome: 'student profile, recents, session resume',
    tone: 'from-[#FFF6D9] to-[#FFE7B8]',
  },
  {
    id: 'discover',
    title: '2. Discover Books',
    emoji: '🔎',
    description: '제목뿐 아니라 감정, 주제, 캐릭터, 호기심 키워드로 책을 찾습니다.',
    outcome: 'search + discovery filters + curiosity hooks',
    tone: 'from-[#E5F7EA] to-[#CFEACB]',
  },
  {
    id: 'talk',
    title: '3. Talk with AI',
    emoji: '🎤',
    description: '워크시트 질문과 대화가 동시에 진행되어 아이가 흐름을 잃지 않습니다.',
    outcome: 'voice, worksheet sync, memory-aware prompts',
    tone: 'from-[#DBF2F8] to-[#C7E7F5]',
  },
  {
    id: 'imagine',
    title: '4. Imagine & Create',
    emoji: '🎨',
    description: '아이의 답변을 요약해 이미지 프롬프트를 만들고 결과 그림으로 연결합니다.',
    outcome: 'prompt plan, generated scene, parent review',
    tone: 'from-[#F7E5F2] to-[#EFD7EA]',
  },
];

export default function ReadingJourneyMap() {
  return (
    <section className="ghibli-card p-5" aria-label="Reading journey architecture">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#A8822E]">
            Core Flow
          </p>
          <h2 className="mt-1 text-xl font-extrabold text-[#3D2E1E]">
            아이 기준으로 다시 정리한 독서 여정
          </h2>
        </div>
        <div className="rounded-full bg-[#E8F5E8] px-3 py-1 text-xs font-bold text-[#5C8B5C]">
          login → discover → talk → imagine
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        {STEPS.map((step) => (
          <div
            key={step.id}
            className={`rounded-3xl border border-[#E8DEC8] bg-gradient-to-br ${step.tone} p-4 shadow-[0_6px_20px_rgba(61,46,30,0.06)]`}
          >
            <div className="flex items-center justify-between">
              <span className="text-3xl" aria-hidden="true">{step.emoji}</span>
              <span className="rounded-full bg-white/75 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#6B5744]">
                {step.id}
              </span>
            </div>
            <h3 className="mt-3 text-base font-extrabold text-[#3D2E1E]">{step.title}</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#6B5744]">{step.description}</p>
            <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.15em] text-[#5C8B5C]">
              {step.outcome}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
