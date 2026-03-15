'use client';

function extractStudentIdeas(conversation = []) {
  return conversation
    .filter((message) => message.speaker === 'student')
    .map((message) => message.content)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildConcepts({ bookTitle, studentName, conversation }) {
  const ideaText = extractStudentIdeas(conversation);
  const safeIdeaText = ideaText || 'The child talked about favorite scenes, feelings, and what the story taught them.';

  return [
    {
      id: 'scene',
      label: 'Story Scene',
      emoji: '🌈',
      palette: 'from-[#FFE7A8] via-[#FFD3B6] to-[#F8BBD0]',
      title: `${bookTitle} as my favorite moment`,
      prompt: `Create a warm storybook illustration inspired by ${bookTitle}. Focus on the child ideas: ${safeIdeaText}. Keep the mood playful, safe, and wonder-filled for ages 6-13.`,
    },
    {
      id: 'avatar',
      label: 'Reader Avatar',
      emoji: '🧒',
      palette: 'from-[#CFEACB] via-[#BFE5D8] to-[#B9E4F8]',
      title: `${studentName || 'Reader'} inside the story`,
      prompt: `Illustrate a child stepping into the world of ${bookTitle}. Use the child reflections as visual clues: ${safeIdeaText}. Add expressive faces, motion, and one symbolic object from the book.`,
    },
    {
      id: 'memory',
      label: 'Memory Poster',
      emoji: '✨',
      palette: 'from-[#DCCBF7] via-[#E9D8F6] to-[#F8E1C8]',
      title: 'What I learned from this book',
      prompt: `Design a celebratory poster based on ${bookTitle}. Show the lesson the child discovered from this conversation: ${safeIdeaText}. Use big shapes, readable composition, and joyful cinematic lighting.`,
    },
  ];
}

export default function ImaginationStudio({ bookTitle = 'This Book', studentName = 'Reader', conversation = [] }) {
  const concepts = buildConcepts({ bookTitle, studentName, conversation });

  return (
    <section className="ghibli-card p-5" aria-label="Imagination studio">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#A8822E]">
            Worksheet to Image
          </p>
          <h2 className="mt-1 text-xl font-extrabold text-[#3D2E1E]">
            Imagination Studio
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#6B5744]">
            워크시트 답변과 대화 문맥을 합쳐 이미지 생성용 콘셉트와 프롬프트를 바로 검토할 수 있는 프런트 목업입니다.
          </p>
        </div>
        <div className="rounded-2xl bg-[#EFF7EF] px-3 py-2 text-xs font-bold text-[#5C8B5C]">
          mock generation queue
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {concepts.map((concept) => (
          <article key={concept.id} className="overflow-hidden rounded-3xl border border-[#E8DEC8] bg-[#FFFCF3]">
            <div className={`bg-gradient-to-br ${concept.palette} p-4`}>
              <div className="flex items-center justify-between">
                <span className="text-3xl" aria-hidden="true">{concept.emoji}</span>
                <span className="rounded-full bg-white/75 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#6B5744]">
                  {concept.label}
                </span>
              </div>
              <div className="mt-5 rounded-[24px] border border-white/60 bg-white/35 p-4 backdrop-blur-sm">
                <p className="text-sm font-extrabold text-[#3D2E1E]">{concept.title}</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-[#6B5744]">
                  Visual direction: expressive characters, cinematic storybook light, and child-safe whimsy.
                </p>
              </div>
            </div>
            <div className="p-4">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#5C8B5C]">
                Prompt Draft
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#3D2E1E]">
                {concept.prompt}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
