# 🏛️ HiAlice 종합 빌드업 전략 보고서
### Senior Supervisor Analysis — 9+/10 Production Readiness Plan

**작성일:** 2026-03-10
**작성자:** 총 감독관 (15년차 시니어 아키텍트)
**현재 점수:** 5.8/10 → **목표:** 9.2/10
**예상 작업량:** Phase별 150~200시간 (6주 스프린트)

---

## 📊 Part 1: 시장조사 & 경쟁 분석

### 1.1 시장 규모 (2024~2030)

| 시장 | 2024 규모 | 2030 예상 | CAGR |
|------|----------|----------|------|
| AI 튜터 시장 | $1.63B | $7.99B | **30.5%** |
| 아동 앱 시장 | $1.71B | $16.18B (2033) | **28.4%** |
| 아동 리터러시 SW | $725M | $1.45B (2032) | **9.1%** |

> **핵심 인사이트:** 52%의 신규 아동 앱이 AI 개인화 학습을 탑재. AI 튜터링은 학습 성과를 평균 **30% 향상** 시키는 것으로 검증됨.

### 1.2 경쟁사 분석 & HiAlice 포지셔닝

| 경쟁사 | 강점 | 약점 | HiAlice 차별화 |
|--------|------|------|---------------|
| **Epic!** | 40,000+ 전자책 라이브러리 | 게이미피케이션 과잉 → 아이들이 뱃지 수집 게임처럼 사용, 실제 이해도 없이 넘김 | 책 **읽기 후** 사고력 확장에 집중 |
| **Raz-Kids** | 체계적 레벨 시스템 | 기계적 퀴즈 (선택형), 말하기 연습 없음 | **음성 기반** 소크라테스식 대화 |
| **Khanmigo** | 칸아카데미 + GPT-4, 소크라테스식 | 초등 독서에 특화되지 않음, 전체 교과 범용 | **영어 원서 독서 리뷰** 전문 특화 |
| **Ello** | AI가 아이의 읽기를 듣고 피드백 | 읽기 지원만, 사고력/감정 표현 없음 | **읽기 후** 생각·감정·이유를 말하기로 표현 |
| **Speakia** | 아이 대상 말하기 연습 | 자유 회화 중심, 독서 연계 없음 | **책 기반 구조화된 대화** (Title→Body→Conclusion) |
| **Reading Eggs** | 게임 기반 파닉스 | 독해력보다 읽기 기초 훈련 중심 | **독해 + 비판적 사고 + 어휘 확장** |

### 1.3 Reddit/커뮤니티 페인포인트 분석

**학부모들의 핵심 불만 (r/homeschool, r/Parenting, r/ESL)**:

| 불만 사항 | 빈도 | HiAlice 대응 방안 |
|----------|------|-----------------|
| "아이가 앱에서 뱃지만 모으고 실제로 책을 읽지 않음" | ⭐⭐⭐⭐⭐ | 워크시트 기반 질문 → 책을 이해해야만 답변 가능 |
| "독서 후 이해도 확인이 안 됨 (다 읽었다고만 체크)" | ⭐⭐⭐⭐⭐ | 4단계 AI 리뷰 세션 (Title→Body→Conclusion) |
| "타이핑 입력은 초등 저학년에 어려움" | ⭐⭐⭐⭐ | **음성 입력 기본** (큰 마이크 버튼) |
| "아이에게 적합한 AI가 필요 (ChatGPT는 너무 성인용)" | ⭐⭐⭐⭐ | HiAlice 페르소나 + COPPA 준수 + 콘텐츠 안전장치 |
| "학습 리포트가 부실하거나 없음" | ⭐⭐⭐ | 워드클라우드 + 문법 트렌드 + 단계별 점수 |
| "오프라인에서 안 됨" | ⭐⭐⭐ | PWA + 서비스 워커 오프라인 캐시 |
| "ESL 아이들을 위한 앱이 부족함" | ⭐⭐⭐ | ESL 특화 (레벨별 어휘/문법 조절) |

**핵심 커뮤니티 요구사항:**
1. 🎤 **음성 기반** — "My kid can't type yet but can talk all day" (r/Parenting)
2. 📋 **구조화된 리뷰** — "I want to know WHAT my child thinks, not just IF they read" (r/homeschool)
3. 🧠 **사고력 유도** — "Stop giving answers. Make them THINK" (r/education)
4. 📊 **진행 추적** — "I need to see growth over weeks, not just one session" (r/Teachers)
5. 🔒 **안전성** — "COPPA compliance is non-negotiable for anything my 7-year-old uses" (r/Parenting)

### 1.4 HiAlice의 고유 경쟁력 (Blue Ocean)

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│    읽기 지원                 사고력 확장             │
│    (Epic, Ello,             (HiAlice 유일!)         │
│     Raz-Kids)                                       │
│         │                        │                  │
│         └────── HiAlice ─────────┘                  │
│                    │                                │
│              음성 기반 대화                          │
│         (Speakia + 책 맥락 연결)                     │
│                    │                                │
│           소크라테스식 교육법                         │
│         (Khanmigo + 아동 특화)                       │
│                    │                                │
│          구조화된 워크시트                            │
│        (학교 교육 커리큘럼 정합)                      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

> **결론:** 시장에 "**읽기 후 → 음성 기반 → 소크라테스식 → 구조화 워크시트**"를 조합한 앱은 **존재하지 않음**. HiAlice는 이 교차점에서 유일한 플레이어.

---

## 🧒 Part 2: 아이 관점 UX 프로세스 설계

### 2.1 아이가 5분 안에 익숙해지는 "원터치 플로우"

```
🏠 HOME        📚 BOOKS       📝 SESSION      ⭐ REVIEW      📖 VOCABULARY
┌─────┐       ┌─────┐       ┌─────────┐      ┌─────┐       ┌─────┐
│ 👧  │──────▶│ 📕  │──────▶│ 🎤 AI와  │─────▶│ 🏆  │──────▶│ 💡  │
│아이  │ 탭   │ 책  │ 탭   │ 대화     │ 자동  │ 결과 │ 탭   │ 복습 │
│선택  │      │ 선택 │      │ (워크시트)│      │ 분석 │      │ 단어 │
└─────┘       └─────┘       └─────────┘      └─────┘       └─────┘
  │                                                           │
  │              ← ← ← ← 반복 학습 사이클 ← ← ← ←           │
  └───────────────────────────────────────────────────────────┘
```

### 2.2 전체 프로세스 (8단계)

| # | 단계 | 아이 경험 | 부모/관리자 경험 |
|---|------|----------|----------------|
| **1** | **로그인** | 부모가 로그인 → 아이 프로필 탭 (아바타 선택) | JWT 인증, 자녀 관리 |
| **2** | **책 선정** | 레벨별 추천 책 표시, 표지 큰 이미지 → 탭으로 선택 | 관리자가 책 등록/관리 |
| **3** | **워크시트 세션** | 4단계 Q&A (Title→Intro→Body→Conclusion), 마이크로 답변 | AI 질문 자동 생성, 문법 실시간 채점 |
| **4** | **결과 분석** | 🎉 축하 애니메이션 + 내가 쓴 단어 구름 + 별점 | 세션 데이터 DB 저장 |
| **5** | **복습** | 플립카드 + 유의어 맵으로 단어 복습 | 단어 숙달도 추적 |
| **6** | **전체 평가** | 프로필에서 성장 그래프 확인, 뱃지 수집 | 주간/월간 리포트 자동 생성 |
| **7** | **관리자 DB** | — | 전체 학생 현황, 책 관리, AI 프롬프트 조절 |
| **8** | **아이별 평가** | — | 학생별 단계별 점수, 어휘 성장률, 문법 추이 |

### 2.3 아이 친화적 인터랙션 원칙

```
┌─────────────────────────────────────────┐
│           6~8세 (Beginner)              │
├─────────────────────────────────────────┤
│ • 화면에 텍스트 최소화                    │
│ • 이모지 + 큰 아이콘 중심                │
│ • 음성 입력 100% (타이핑 숨김)            │
│ • 질문 1개씩만 표시                      │
│ • 격려 애니메이션 풍부                    │
│ • "Tap the 🎤 and tell me!"            │
├─────────────────────────────────────────┤
│           9~11세 (Intermediate)         │
├─────────────────────────────────────────┤
│ • 워크시트 좌측 + 대화 우측 레이아웃      │
│ • 음성/타이핑 선택 가능                   │
│ • 가이드 질문 + 예시 답변 표시            │
│ • Body 단계에서 3가지 이유 카운터 표시    │
│ • "Tell me your first reason!"          │
├─────────────────────────────────────────┤
│           12~13세 (Advanced)            │
├─────────────────────────────────────────┤
│ • 전체 워크시트 한눈에 보기               │
│ • 타이핑 우선, 음성 보조                  │
│ • 비판적 사고 질문 + 증거 요구            │
│ • 이전 답변 수정 가능                    │
│ • "Support your argument with evidence" │
└─────────────────────────────────────────┘
```

---

## 📝 Part 3: 워크시트 프레임 + AI 질문 설계

### 3.1 워크시트 기본 프레임 (업로드 사진 기반)

업로드하신 워크시트 사진 분석 결과:

```
┌────────────────────────────────────────────────────────────┐
│  📖 Reading Worksheet: "Book Title"                        │
├──────────┬─────────────────────┬──────────────────────────┤
│  Stage   │  Guide Question     │  My Answer               │
├──────────┼─────────────────────┼──────────────────────────┤
│          │                     │                          │
│  TITLE   │ "What do you think  │ [아이 음성/텍스트 입력]    │
│  📖      │  this book is       │                          │
│          │  about?"            │  e.g. "This book is      │
│          │                     │  about a caterpillar..." │
├──────────┼─────────────────────┼──────────────────────────┤
│          │                     │                          │
│  INTRO   │ "Who is your        │ [아이 음성/텍스트 입력]    │
│  👤      │  favorite            │                          │
│          │  character? Why?"   │  e.g. "I would choose    │
│          │                     │  the caterpillar..."     │
├──────────┼─────────────────────┼──────────────────────────┤
│          │ REASON 1:           │                          │
│  BODY    │ "What is the most   │ [아이 음성/텍스트 입력]    │
│  💭      │  important part?"   │                          │
│          ├─────────────────────┼──────────────────────────┤
│          │ REASON 2:           │                          │
│          │ "What would you     │ [아이 음성/텍스트 입력]    │
│          │  change? Why?"      │                          │
│          ├─────────────────────┼──────────────────────────┤
│          │ REASON 3:           │                          │
│          │ "What did you       │ [아이 음성/텍스트 입력]    │
│          │  learn?"            │                          │
├──────────┼─────────────────────┼──────────────────────────┤
│          │                     │                          │
│CONCLUSION│ "How do you feel    │ [아이 음성/텍스트 입력]    │
│  ⭐      │  about this book?"  │                          │
│          │                     │  e.g. "Reading this      │
│          │                     │  book was really fun..." │
└──────────┴─────────────────────┴──────────────────────────┘
```

### 3.2 AI 질문 생성 원칙 — "책의 맥락 기반 감정 유도"

기존 프롬프트의 질문은 범용적이었습니다. 9점 이상을 위해 **책의 실제 내용을 AI가 파악하고**, 그 맥락에서 아이의 생각·느낌·감정을 유도하는 질문을 생성해야 합니다.

**Before (현재 — 범용 질문):**
```
"What is the most important part of the story?"
"What would you change about the story?"
```

**After (개선안 — 책 맥락 기반 감정 유도 질문):**

| 단계 | 질문 유형 | 예시 (The Very Hungry Caterpillar) |
|------|----------|----------------------------------|
| **Title** | 제목에서 느낀 첫인상 | "When you hear 'The Very Hungry Caterpillar,' what picture comes to your mind? Does it make you feel curious, excited, or something else?" |
| **Intro** | 캐릭터 감정이입 | "The caterpillar was SO hungry! Have you ever been that hungry before? How did it feel? If you could be any character in the story, who would you be?" |
| **Body-1** | 핵심 장면의 감정 | "When the caterpillar ate through all that food and got a stomachache — did you feel sorry for him? What would you tell him if he was your friend?" |
| **Body-2** | 변화에 대한 생각 | "The caterpillar changed into a beautiful butterfly. That's a BIG change! Have you ever gone through a big change? How did it feel — scary, exciting, or both?" |
| **Body-3** | 교훈과 연결 | "What do you think the author wanted us to learn? Do you think waiting for something good (like the butterfly) is worth it?" |
| **Conclusion** | 개인적 의미 | "If you could write a letter to the caterpillar, what would you say? Would you recommend this book to your best friend? Why?" |

### 3.3 AI 질문 생성 시스템 프롬프트 개선안

```
QUESTION GENERATION RULES:
1. Read the book title and key plot points provided
2. Generate questions that connect the BOOK'S EVENTS to the CHILD'S OWN LIFE
3. Always ask "How did that make you FEEL?" or "What would YOU do?"
4. Use the child's NAME in questions for personal connection
5. For BODY stage, each reason should explore:
   - Reason 1: EMOTIONAL reaction to key scene
   - Reason 2: CREATIVE thinking (what would you change/add?)
   - Reason 3: LIFE CONNECTION (what did you learn for YOUR life?)
6. Never ask yes/no questions — always WHY, HOW, WHAT IF
7. If child gives 1-word answer, ask a simpler follow-up with options:
   "Was it more FUNNY or more SAD? Tell me which one!"
```

---

## 🔍 Part 4: 코드베이스 갭 분석 (현재 vs 9점)

### 4.1 현재 완성도 점수표

| 영역 | 현재 점수 | 9점 기준 | 갭 | 우선순위 |
|------|----------|---------|-----|---------|
| **로그인/인증** | 4/10 | 9/10 | -5 | 🔴 Critical |
| **책 선정** | 7/10 | 9/10 | -2 | 🟡 High |
| **워크시트 세션** | 7/10 | 9.5/10 | -2.5 | 🟡 High |
| **결과 분석** | 5/10 | 9/10 | -4 | 🔴 Critical |
| **단어 복습** | 5/10 | 9/10 | -4 | 🔴 Critical |
| **학생 프로필** | 4/10 | 9/10 | -5 | 🔴 Critical |
| **관리자 대시보드** | 3/10 | 9/10 | -6 | 🔴 Critical |
| **학생별 평가** | 2/10 | 9/10 | -7 | 🔴 Critical |
| **보안/COPPA** | 5/10 | 9.5/10 | -4.5 | 🔴 Critical |
| **성능/접근성** | 7/10 | 9/10 | -2 | 🟡 High |

### 4.2 Mock 데이터 → 실제 데이터 전환 필요 목록

현재 대부분의 페이지가 **MOCK_DATA**를 사용하고 있습니다:

| 페이지 | Mock 사용 | 실제 API 연동 |
|--------|----------|-------------|
| `page.js` (Home) | `MOCK_CHILDREN` | ✅ 부분 연동 (이번 스프린트) |
| `books/page.js` | `MOCK_BOOKS` | ❌ API 호출하지만 실패 시 목 |
| `session/page.js` | `MOCK_AI_RESPONSES` | ⚠️ API 실패 시 목으로 폴백 |
| `review/page.js` | `MOCK_REVIEW_DATA` | ❌ 대부분 Mock |
| `vocabulary/page.js` | `MOCK_VOCABULARY` | ❌ 100% Mock |
| `profile/page.js` | `MOCK_STUDENT`, `MOCK_SESSIONS` | ❌ 100% Mock |
| `admin/*` | 모든 페이지 Mock | ❌ 100% Mock |

### 4.3 누락된 핵심 기능 목록

**🔴 즉시 필요 (9점 필수):**
1. 세션 결과 Backend 영구 저장 (현재 sessionStorage만 사용 → 새로고침 시 소실)
2. 학생별 세션 이력 조회 API (`GET /api/sessions/student/:studentId`)
3. 단어 복습 Backend 연동 (practice_log 테이블 필요)
4. 관리자 인증 + 역할 기반 접근 제어
5. 부모 대시보드 (자녀 진행 상황 조회)
6. 세션 일시정지/재개 기능 ("Save & Exit")

**🟡 높음 우선순위:**
7. 책 추천 엔진 (레벨 + 이전 읽기 이력 기반)
8. 학생별 단계별 점수 저장 (`session_stage_scores` 테이블)
9. 부모 이메일 알림 (세션 완료 후 리포트)
10. 어휘 간격반복 Backend 연동
11. 세션 타임아웃 처리 (30분 비활동 시)
12. 축하 애니메이션 + 뱃지 언락 시스템

**🟢 보통 우선순위:**
13. 인쇄 가능한 워크시트/수료증
14. 학습 목표 설정 (주 3권 등)
15. 다크 모드
16. 다국어 지원 (한국어 UI)

---

## 🚀 Part 5: 6주 빌드업 스프린트 계획

### Phase 1: Foundation (Week 1~2) — "데이터 실체화"

**목표:** Mock → Real 전환, DB 스키마 확장, 핵심 API 완성

| 작업 | 담당 에이전트 | 예상 시간 |
|------|-------------|----------|
| DB 스키마 마이그레이션 (session_stage_scores, vocabulary_practice_log, achievements, student_goals) | ⚙️ Backend | 8h |
| 세션 결과 Backend 영구 저장 + 단계별 점수 | ⚙️ Backend | 8h |
| 학생별 세션 이력/통계 API | ⚙️ Backend | 6h |
| 단어 복습 API (간격반복 + practice_log) | ⚙️ Backend | 6h |
| review/page.js 실제 API 연동 | 🎨 Frontend | 6h |
| vocabulary/page.js 실제 API 연동 | 🎨 Frontend | 4h |
| profile/page.js 실제 API 연동 | 🎨 Frontend | 6h |
| 로그아웃 + 토큰 갱신 API | ⚙️ Backend | 4h |

### Phase 2: AI Enhancement (Week 2~3) — "책 맥락 기반 질문"

| 작업 | 담당 에이전트 | 예상 시간 |
|------|-------------|----------|
| 책 데이터에 줄거리/키워드 필드 추가 | ⚙️ Backend | 4h |
| prompts.js 개선: 책 줄거리 기반 감정 유도 질문 | 🤖 AI Engine | 8h |
| Body 단계 3가지 이유별 맞춤 질문 (감정/창의/교훈) | 🤖 AI Engine | 6h |
| 레벨별 질문 난이도 자동 조절 강화 | 🤖 AI Engine | 4h |
| 짧은 답변(1단어) 감지 → 후속 질문 자동 생성 | 🤖 AI Engine | 4h |
| 세션 피드백 AI 자동 생성 ("You expressed emotions well!") | 🤖 AI Engine | 6h |

### Phase 3: Child UX (Week 3~4) — "5분 안에 익숙해지는 경험"

| 작업 | 담당 에이전트 | 예상 시간 |
|------|-------------|----------|
| 레벨별 UI 분기 (Beginner: 음성 100%, Advanced: 타이핑 우선) | 🎨 Frontend | 8h |
| 축하 애니메이션 (confetti + bounce) 세션 완료 시 | 🎨 Frontend | 4h |
| 뱃지/업적 언락 UI + Backend | 🎨 Frontend + ⚙️ Backend | 8h |
| 세션 일시정지/재개 ("Save & Exit") | 🎨 Frontend + ⚙️ Backend | 6h |
| 워크시트 인쇄 기능 (PDF 생성) | 🎨 Frontend | 4h |
| 책 추천 카드 ("What to Read Next") | 🎨 Frontend + ⚙️ Backend | 6h |
| 세션 타이머 + 타임아웃 경고 | 🎨 Frontend | 3h |

### Phase 4: Admin & Parent (Week 4~5) — "관리자 데이터베이스화"

| 작업 | 담당 에이전트 | 예상 시간 |
|------|-------------|----------|
| 관리자 인증 + RBAC (admin/parent/student 역할) | 🔒 Security | 8h |
| 관리자 학생 CRUD UI 구현 | 🎨 Frontend | 6h |
| 관리자 책 CRUD UI 구현 | 🎨 Frontend | 6h |
| 학생별 성장 리포트 API + UI | ⚙️ Backend + 🎨 Frontend | 10h |
| 부모 대시보드 (자녀 진행 현황) | 🎨 Frontend + ⚙️ Backend | 10h |
| 이메일 알림 시스템 (세션 완료 리포트) | ⚙️ Backend | 6h |
| 관리자 AI 프롬프트 편집 UI | 🎨 Frontend | 4h |
| CSV 내보내기/가져오기 | ⚙️ Backend | 4h |

### Phase 5: Security & Polish (Week 5~6) — "프로덕션 준비"

| 작업 | 담당 에이전트 | 예상 시간 |
|------|-------------|----------|
| COPPA 부모 동의 플로우 구현 | 🔒 Security + 🎨 Frontend | 8h |
| JWT → httpOnly 쿠키 전환 | 🔒 Security | 6h |
| Supabase RLS 정책 강화 | 🔒 Security + ⚙️ Backend | 6h |
| 입력 길이 제한 + 비속어 필터링 | 🔒 Security | 4h |
| E2E 테스트 (Playwright) | 🧪 QA | 10h |
| 성능 최적화 (이미지 최적화, 번들 사이즈) | ⚡ Performance | 4h |
| 에러 추적 (Sentry) 연동 | ⚙️ Backend | 3h |
| CI/CD 파이프라인 구축 | ⚙️ Backend | 6h |

---

## 🤖 Part 6: 에이전트 소집 현황

### 필요 에이전트 7팀

| # | 에이전트 | 역할 | 주요 담당 Phase | 상태 |
|---|---------|------|----------------|------|
| 1 | 🏛️ **총 감독관** | 전체 품질 관리, 코드 리뷰, 충돌 해결 | 전체 | ✅ 활성 |
| 2 | ⚙️ **Backend Agent** | API, DB 마이그레이션, 인증 | Phase 1, 4 | 🟡 대기 |
| 3 | 🎨 **Frontend Agent** | UI/UX, 컴포넌트, 애니메이션 | Phase 1, 3, 4 | 🟡 대기 |
| 4 | 🤖 **AI Engine Agent** | 프롬프트 엔지니어링, 질문 생성 | Phase 2 | 🟡 대기 |
| 5 | 🔒 **Security Agent** | COPPA, 인증, 입력 검증 | Phase 5 | 🟡 대기 |
| 6 | 📱 **UX/Child Agent** | 아동 사용성, 접근성, 애니메이션 | Phase 3 | 🟡 대기 |
| 7 | 🧪 **QA Agent** | 테스트, 검증, 버그 리포트 | Phase 5 | 🟡 대기 |

---

## 📈 Part 7: 목표 점수 달성 로드맵

```
현재 5.8/10
    │
    ├─ Phase 1 (Week 1~2): Mock→Real 전환 ──────▶ 6.8/10
    │
    ├─ Phase 2 (Week 2~3): AI 질문 고도화 ──────▶ 7.5/10
    │
    ├─ Phase 3 (Week 3~4): 아이 UX 완성 ────────▶ 8.2/10
    │
    ├─ Phase 4 (Week 4~5): 관리자/부모 완성 ────▶ 8.8/10
    │
    └─ Phase 5 (Week 5~6): 보안/테스트 ─────────▶ 9.2/10 ✅
```

### 9점 달성 기준 (체크리스트)

- [ ] 모든 페이지가 실제 Backend API와 연동
- [ ] 세션 결과가 영구 저장되고 새로고침해도 유지
- [ ] 학생별 성장 그래프가 실제 데이터 기반
- [ ] AI 질문이 책 내용에 맞춤화되어 감정/사고 유도
- [ ] 부모가 자녀 학습 현황을 실시간 확인 가능
- [ ] 관리자가 학생/책/AI 프롬프트를 완전 관리 가능
- [ ] COPPA 부모 동의 프로세스 구현
- [ ] JWT httpOnly 쿠키 + RBAC 역할 기반 접근 제어
- [ ] E2E 테스트 커버리지 80% 이상
- [ ] 6세 아이가 부모 도움 없이 3번째 세션부터 혼자 진행 가능

---

## Sources

- [AI Tutors Market Size & Trends 2030](https://www.grandviewresearch.com/industry-analysis/ai-tutors-market-report)
- [Apps for Kids Market Size & Forecast 2033](https://www.businessresearchinsights.com/market-reports/apps-for-kids-market-122277)
- [AI Tutors Are Now Common in Early Reading Instruction](https://www.edweek.org/technology/ai-tutors-are-now-common-in-early-reading-instruction-do-they-actually-work/2025/11)
- [2026 Guide: AI Education Tools for Children](https://picture-cook.com/articles/2026-must-read-guide-for-parents-and-teachers-the-world-s-most-popular-ai-education-tools-for-children)
- [Best AI Tutor Tools 2026: Reddit & Harvard](https://www.allaboutai.com/best-ai-tools/productivity/tutor/)
- [Epic! App Review — Pros and Cons](https://theimportanceoftechnologyandyoungchildren.wordpress.com/2025/12/04/epic-app-review-the-real-pros-and-cons/)
- [Epic vs Kindle Kids](https://screenwiseapp.com/guides/epic-vs-kindle-for-kids-which-reading-app-wins)
- [Parent Reviews for Epic! — Common Sense Media](https://www.commonsensemedia.org/app-reviews/epic-kids-books-and-videos/user-reviews/adult)
- [Socratic Method + Gen AI Research (2026)](https://onlinelibrary.wiley.com/doi/10.1002/jcal.70210)
- [Schools Using Voice Technology to Teach Reading](https://www.edsurge.com/news/2023-03-07-schools-are-using-voice-technology-to-teach-reading-is-it-helping)
- [Ello — AI Reading Buddy](https://www.ello.com/)
- [Speakia — Speaking Practice for Kids](https://www.speakia.app/)
- [Talki — Voice AI for Children 3-10](https://talki-app.fr/en/)
- [I Don't Want a Learning Dashboard for My Child — fast.ai](https://www.fast.ai/posts/2026-02-17-education/)
- [10 Best Reading Comprehension Apps 2026](https://brighterly.com/blog/reading-comprehension-apps/)

---

*— HiAlice Senior Supervisor Report v1.0 | 2026-03-10 —*
