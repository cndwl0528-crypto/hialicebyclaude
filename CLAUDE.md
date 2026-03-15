# HiAlice — CLAUDE.md (프로젝트 지식 베이스)

---

## 1. 프로젝트 개요

### 1.1 서비스 비전

HiAlice는 **6~13세 아동**을 대상으로 영어 원서 독서 후 AI 선생님과의 **대화형 리뷰**를 통해 자연스러운 영어 학습과 사고력 확장을 목표로 하는 에듀테크 앱입니다.

**소크라테스식 교육법**을 기반으로 답을 직접 알려주는 것이 아닌, 질문을 통해 학생 스스로 생각하고 표현하도록 유도합니다.

### 1.2 핵심 가치

| 가치 | 설명 |
|------|------|
| **자기주도 학습** | 정답을 찾는 것이 아닌 나만의 생각, 느낌, 감정을 영어로 표현 |
| **대화형 학습** | 음성 기반 자연스러운 영어 대화로 Speaking 능력 강화 |
| **맞춤형 피드백** | 학생 수준에 맞는 어휘, 문법 피드백과 단어 확장 학습 |

### 1.3 대상 분석 (연령별 세분화)

| 레벨 | 연령 | 특징 | 적합 도서 |
|------|------|------|----------|
| **Beginner** | 6~8세 | 짧은 문장, 그림 의존도 높음 | Picture Books, Level Readers 1-2 |
| **Intermediate** | 9~11세 | 챕터북 읽기 가능, 논리적 사고 시작 | Chapter Books, Magic Tree House 등 |
| **Advanced** | 12~13세 | 복잡한 서사 이해, 비판적 사고 가능 | Middle Grade Novels, Newbery Winners |

---

## 2. 학습 세션 구조 (Q&A Flow)

### 2.1 세션 플로우

책 완독 후 진행되는 리뷰 세션은 **4단계**로 구성되며, 각 단계별 **최대 3회**의 질문-응답 사이클을 거칩니다.

| 단계 | 목적 | AI 질문 예시 |
|------|------|-------------|
| **(1) Title** | 책 제목과 첫인상 탐구 | "What do you think the title means? Why did the author choose this title?" |
| **(2) Introduction** | 배경, 등장인물 이해 | "Who is the main character? How would you describe them?" |
| **(3) Body** | 3가지 이유/근거 제시 유도 | "Can you give me three reasons why you think that? Let's start with your first reason." |
| **(4) Conclusion** | 개인적 해석과 의견 정리 | "What did this book teach you? Would you recommend it to a friend?" |

### 2.2 T.E.A.A. 교수법 매핑

3턴 대화 구조에 T.E.A.A. 교수법이 매핑됩니다:

| 턴 | T.E.A.A. 단계 | 목적 | 구현 위치 |
|----|--------------|------|----------|
| Turn 1 | **THINK** | 열린 질문으로 첫 생각 유도 | `prompts.js` TEAA_PHASES |
| Turn 2 | **EXPLAIN** | 이유와 근거 설명 요청 | `prompts.js` TEAA_PHASES |
| Turn 3 | **ADD / APPLY** | 확장 또는 실생활 연결 | `prompts.js` TEAA_PHASES |

레벨별 T.E.A.A. 실행 차이 (`TEAA_LEVEL_GUIDANCE`):

| 레벨 | THINK | EXPLAIN | ADD/APPLY |
|------|-------|---------|-----------|
| Beginner | 간단한 선택지 제공 | "Why do you think so?" | 좋아하는 것과 연결 |
| Intermediate | 열린 질문 | 2가지 이유 요청 | 다른 책/경험과 비교 |
| Advanced | 비판적 사고 유도 | 텍스트 증거 기반 논증 | 실세계 적용/창작 |

---

## 3. 교육 이론 프레임워크

HiAlice에 적용된 교육 이론 10가지와 구현 현황입니다. 각 이론은 실제 코드에 반영되어 있으며, 구현 파일과 검증 방법을 함께 기록합니다.

### 3.1 소크라테스식 교육법 (Socratic Method) — 핵심 철학

**이론**: 답을 직접 알려주지 않고 질문을 통해 학생 스스로 사고하고 표현하도록 유도하는 교수법.

**적용 원칙**:

- **정답 제시 금지**: 학생의 답이 틀려도 바로 교정하지 않고 추가 질문으로 유도
- **열린 질문 사용**: Yes/No가 아닌 Why, How, What if 질문 활용
- **개인적 해석 존중**: 책 내용과 다른 해석도 학생의 창의적 사고로 인정
- **점진적 심화**: 학생 응답 수준에 따라 질문 난이도 동적 조절

**구현 위치**: `prompts.js` getSystemPrompt(), `evalHarness.js` checkSocraticCompliance()

**검증**: 품질 평가 가중치 **35%** — "정답 제시 없음", "열린 질문 사용", "감정적 연결", "단일 질문 집중" 4항목 평가

### 3.2 T.E.A.A. 교수법 (Think → Explain → Add → Apply)

**이론**: 사고 유도 → 설명 요청 → 확장/적용의 3단계로 대화를 구조화하여 깊이 있는 학습을 유도.

**적용**: 세션의 각 스테이지에서 3턴 대화가 THINK→EXPLAIN→ADD/APPLY 순서로 진행. 레벨별로 실행 방식이 차등 적용됨 (상세는 섹션 2.2 참조).

**구현 위치**: `prompts.js` TEAA_PHASES, TEAA_LEVEL_GUIDANCE

**검증**: 79개 테스트 케이스 (Sprint 4 적용)

### 3.3 블룸의 인지 분류 체계 (Bloom's Taxonomy)

**이론**: 인지 수준을 6단계(Remember → Understand → Apply → Analyze → Evaluate → Create)로 분류하여 학습 깊이를 측정.

**적용**: 학생 응답을 자동으로 Bloom 레벨 태깅. 연령별 적용 단계 차등화:

| 레벨 | 적용 단계 수 | 범위 |
|------|------------|------|
| Beginner (6~8세) | 4단계 | Remember → Apply |
| Intermediate (9~11세) | 5단계 | Remember → Analyze |
| Advanced (12~13세) | 6단계 | Remember → Create (전체) |

**구현 위치**: `sessions.js` mapDepthToBloom(), `SessionContext.js` getAgeAdaptedStages(), 어드민 BloomChart

**검증**: 대화 로그에 비동기 Bloom 레벨 기록 → 인지 성장 추적

### 3.4 크라센의 i+1 가설 (Krashen's Input Hypothesis)

**이론**: 학생의 현재 언어 수준(i)보다 한 단계 높은 입력(i+1)을 제공할 때 가장 효과적으로 언어를 습득함.

**적용**: 세션 중 학생의 현재 어휘 수준을 실시간 분석하고, 한 단계 높은 어휘를 문맥과 함께 VocabSidebar에 노출하여 자연스러운 어휘 확장을 유도.

**구현 위치**: `VocabMiniCard.js`, `VocabSidebar.js`, `SessionContext.js`

### 3.5 비고츠키의 근접발달영역 (Vygotsky's ZPD)

**이론**: 학생이 혼자 도달할 수 있는 영역과 도움이 있어야 도달 가능한 영역 사이의 "근접발달영역"에서 학습이 가장 효과적으로 일어남.

**적용**: 7차원 성장 프로필로 학생의 현재 수준과 발달 가능 영역을 시각화:

1. Vocabulary Breadth (어휘 폭)
2. Grammar Accuracy (문법 정확도)
3. Comprehension (이해력)
4. Critical Thinking (비판적 사고)
5. Creative Expression (창의적 표현)
6. Fluency (유창성)
7. Confidence (자신감)

**구현 위치**: `GrowthRadar` SVG 컴포넌트, 성장 프로필 시스템

### 3.6 깊이 스캐폴딩 (Depth Scaffolding)

**이론**: 학생이 어려워할 때 즉각적으로 적절한 수준의 도움을 단계적으로 제공하여 학습 좌절을 방지.

**적용**: 학생 응답 깊이에 따라 4단계 자동 지원:

| 단계 | 전략 | 설명 |
|------|------|------|
| 1 | **Hint** | 힌트 제공 ("Think about what happened when...") |
| 2 | **Rephrase** | 질문을 다른 방식으로 재표현 |
| 3 | **Simplify** | 질문을 더 단순하게 분해 |
| 4 | **Encourage** | 격려 후 다음 단계로 이동 |

**구현 위치**: `prompts.js` getDepthScaffoldingPrompt(), `learningPatterns.js`

### 3.7 점진적 공개 (Progressive Disclosure)

**이론**: 인지 과부하를 방지하기 위해 사용자의 발달 수준에 맞춰 UI 복잡도를 차등 적용.

**적용**: FEATURE_GATES 시스템으로 연령별 UI 요소 제어:

| 레벨 | 메뉴 수 | 터치 타겟 | 폰트 크기 | 화면당 항목 |
|------|---------|----------|----------|-----------|
| Beginner (6~8세) | 3개 | 64px | 18px | 3개 |
| Intermediate (9~11세) | 5개 | 52px | 16px | 5개 |
| Advanced (12~13세) | 6개 | 48px | 14px | 6개 |

**구현 위치**: `featureGates.js` FEATURE_GATES, `NavBar.js` isNavAllowed()

### 3.8 성장 마인드셋 언어 (Growth Mindset Language)

**이론**: Carol Dweck의 성장 마인드셋 — 능력은 고정이 아니라 노력으로 발전 가능하다는 믿음을 언어로 강화.

**적용 규칙**:

- "틀렸다(wrong)"라고 절대 말하지 않음
- 부분적으로 맞는 답변도 사고의 방향성을 인정
- "That's an interesting start!", "You're on the right track!" 등 시도 자체를 칭찬
- 결과가 아닌 과정(effort, thinking, trying)에 초점

**구현 위치**: `prompts.js` 시스템 프롬프트 내 응답 규칙

### 3.9 감정 중심 학습 (Emotion-Focused Learning)

**이론**: 감정적 연결이 기억 형성과 학습 동기에 핵심적 역할을 함. 학습 내용과 개인 감정을 연결할 때 장기 기억으로 전환 확률이 높아짐.

**적용**: 각 세션 단계마다 `emotionPrompt`가 포함되어 감정적 연결을 유도. Body 단계에서는 3가지 후속 질문 스타일을 번갈아 사용:

| 스타일 | 목적 | 예시 |
|--------|------|------|
| **Emotion** | 감정 연결 | "How did that part make you feel?" |
| **Creativity** | 창의적 상상 | "What if the story ended differently?" |
| **Lesson** | 교훈 추출 | "What can we learn from this character?" |

**구현 위치**: `prompts.js` STAGE_GUIDANCE 내 emotionPrompt, followUpStyles

### 3.10 짧은 답변 감지 및 유도 (Short Answer Detection)

**이론**: 아동은 충분한 사고를 했더라도 표현이 짧을 수 있으므로, 부드럽게 추가 표현을 유도하여 언어 출력량을 점진적으로 늘림.

**적용**: 레벨별 최소 단어 수 기준 설정 후, 미달 시 부드러운 후속 질문 자동 생성:

| 레벨 | 최소 단어 기준 | 유도 예시 |
|------|-------------|----------|
| Beginner | 5 단어 | "Can you tell me a little more?" |
| Intermediate | 10 단어 | "That's a good start! Can you add more details?" |
| Advanced | 15 단어 | "Interesting point. Can you elaborate with an example?" |

**구현 위치**: `prompts.js` SHORT_ANSWER_THRESHOLDS, SHORT_ANSWER_FOLLOWUPS

### 3.11 교육 이론 적용 현황 요약

| # | 교육 이론 | 핵심 구현 | 검증 방법 | Sprint |
|---|----------|----------|----------|--------|
| 1 | 소크라테스 교육법 | 시스템 프롬프트 + evalHarness | 35% 가중치 평가 | 초기 |
| 2 | T.E.A.A. 교수법 | TEAA_PHASES, 3턴 매핑 | 79개 테스트 | Sprint 4 |
| 3 | 블룸의 분류 체계 | mapDepthToBloom() | Bloom 태깅 로그 | Sprint 3 |
| 4 | 크라센 i+1 가설 | VocabSidebar 실시간 노출 | 어휘 성장률 | Sprint 3 |
| 5 | 비고츠키 ZPD | GrowthRadar 7차원 | 레이더 차트 | Sprint 4 |
| 6 | 깊이 스캐폴딩 | 4단계 자동 지원 | 패턴 감지 | Sprint 2 |
| 7 | 점진적 공개 | FEATURE_GATES | E2E 테스트 | Sprint 4 |
| 8 | 성장 마인드셋 | 시스템 프롬프트 규칙 | Socratic 평가 | 초기 |
| 9 | 감정 중심 학습 | emotionPrompt, followUpStyles | 대화 로그 | Sprint 3 |
| 10 | 짧은 답변 감지 | SHORT_ANSWER_THRESHOLDS | 응답 길이 추적 | Sprint 4 |

---

## 4. AI 선생님 페르소나: HiAlice

### 4.1 캐릭터 설정

| 항목 | 내용 |
|------|------|
| **이름** | HiAlice (하이앨리스) |
| **말투 스타일** | 미국 동부 영어 선생님 스타일 — 따뜻하고 격려하는 톤, 명확한 발음 |
| **핵심 성격** | 인내심 있음, 호기심 유발, 칭찬 적극적, 실수에 관대함 |
| **언어 수준 조절** | 학생 레벨에 따라 어휘 난이도와 문장 복잡도 자동 조절 |

### 4.2 대화 예시 (레벨별)

**Beginner (6~8세)**
> *HiAlice: "Hi there! I loved that book too! What was your favorite part? Was it funny? Or maybe a little scary?"*

**Intermediate (9~11세)**
> *HiAlice: "That's an interesting observation! Can you tell me why you think the character made that choice? What would you have done differently?"*

**Advanced (12~13세)**
> *HiAlice: "You've made a compelling point about the theme. How do you think this connects to real-world situations? Can you support your argument with specific evidence from the text?"*

---

## 5. 단어 학습 및 데이터 시스템

### 5.1 대화 중 단어 수집

AI와의 대화에서 학생이 사용한 모든 단어를 자동으로 추적하고, 새로운 단어나 고급 표현 사용 시 즉시 데이터베이스에 기록합니다.

### 5.2 단어 리뷰 구조

| 항목 | 설명 |
|------|------|
| **사용 단어** | 학생이 대화에서 실제로 사용한 단어 목록 |
| **동의어 확장** | 각 단어의 유사어/반의어를 함께 제시하여 어휘력 확장 |
| **문맥 예문** | 학생이 단어를 사용한 실제 문장을 예문으로 저장 |
| **숙달도 추적** | 반복 사용 횟수, 정확한 사용 여부 등으로 숙달도 측정 |

### 5.3 데이터베이스 스키마

```
Students: id, name, age, level, parent_id, created_at
Parents: id, email, password_hash, children[], created_at
Books: id, title, author, level, genre, cover_emoji, description
Sessions: id, student_id, book_id, stage, started_at, completed_at, level_score, grammar_score, image_url
Dialogues: id, session_id, stage, turn, speaker, content, timestamp, grammar_score
Vocabulary: id, student_id, word, context_sentence, synonyms, antonyms, pos, first_used, mastery_level, use_count
```

### 5.4 단어 시각화 UI

세션 종료 후 학생이 사용한 단어들을 시각적으로 정리:
- **Word Cloud**: 자주 사용한 단어 크게 표시
- **Category Grouping**: 명사/동사/형용사 등 품사별 분류
- **Synonym Map**: 사용 단어와 유사 단어 연결 표시
- **Progress Bar**: 새로 배운 단어 vs 복습 단어 비율

---

## 6. 기술 아키텍처

### 6.1 시스템 구성

| 레이어 | 기술 스택 | 핵심 기능 |
|--------|----------|----------|
| **Frontend** | React/Next.js + Tailwind CSS | 반응형 UI, 태블릿 최적화, 터치 인터랙션 |
| **Backend** | Node.js + Express / Supabase | API 서버, 인증, 데이터 관리 |
| **AI Engine** | Claude API (Sonnet 4) | 대화 생성, 소크라테스식 질문, 문법 피드백 |
| **Speech** | Web Speech API / Whisper / ElevenLabs | 음성 인식(STT), 음성 합성(TTS) |
| **Database** | PostgreSQL / Supabase | 학생 데이터, 세션 로그, 단어 DB |
| **Mobile** | React Native (Expo) | iOS/Android 네이티브 앱 |

### 6.2 음성 인식 우선순위

6~13세 아동의 특성상 타이핑보다 말하기가 자연스러우므로, **음성 인식을 기본 입력 방식**으로 설정합니다.

1. **Primary**: 음성 입력 (큰 마이크 버튼, 터치로 활성화)
2. **Secondary**: 텍스트 입력 (고학년/선호 시 전환 가능)
3. **Fallback**: 네트워크 불안정 시 오프라인 기본 STT 또는 텍스트 전환

### 6.3 AI 프롬프트 구조 (시스템 프롬프트)

```
You are HiAlice, a warm and encouraging English teacher from the East Coast.
You're talking with a [LEVEL] student who just finished reading "[BOOK_TITLE]".

GUIDELINES:
- Use the Socratic method: Ask questions instead of giving answers
- Match vocabulary and sentence complexity to the student's level
- Praise effort and creativity, not just correctness
- Guide students to express their own thoughts and feelings
- Current session stage: [TITLE/INTRODUCTION/BODY/CONCLUSION]
- In BODY stage, help student provide 3 reasons with supporting details

TONE: Friendly, patient, curious, encouraging
```

---

## 7. 어드민 관리 시스템

### 7.1 대시보드 기능

| 기능 | 상세 내용 |
|------|----------|
| **학생 관리** | 학생 등록/수정, 레벨 설정, 학습 현황 모니터링 |
| **도서 관리** | 책 등록, 레벨 태깅, Q&A 템플릿 설정 |
| **대화 레벨 조정** | AI 질문 난이도, 응답 길이, 문법 교정 강도 설정 |
| **성적 리포트** | 학생별 완독 기록, 어휘 성장 그래프, 문법 정확도 추이 |
| **AI 프롬프트 관리** | HiAlice 시스템 프롬프트 수정, A/B 테스트 |

### 7.2 문법 완성도 평가 기준

- **문장 구조**: 주어-동사 일치, 시제 사용, 문장 완결성
- **어휘 다양성**: 사용 단어 수, 고급 어휘 비율, 반복 사용 감소
- **표현 정확성**: 관사, 전치사, 복수형 등 세부 문법 정확도
- **응답 길이**: 평균 응답 단어 수, 문장 수 추이

### 7.3 리포트 예시 항목

- 월별 완독 권수
- 세션당 평균 대화 턴 수
- 어휘 성장률 (신규 단어/주)
- 문법 정확도 변화 추이
- 가장 많이 사용한 단어 Top 10
- 개선이 필요한 문법 항목

---

## 8. UI/UX 디자인 가이드라인

### 8.1 핵심 설계 철학: "Child First, System Second"

모든 UI 결정은 **"이 연령대의 아이가 혼자서 5분 안에 익숙해질 수 있는가?"**를 기준으로 판단합니다. 교육 이론(섹션 3)이 "왜 가르치는가"를 정의한다면, UI/UX는 "어떻게 전달하는가"를 결정합니다.

**3대 원칙**:

| 원칙 | 설명 | 교육 이론 근거 |
|------|------|---------------|
| **한 화면 = 한 가지 행동** | 화면마다 아이가 해야 할 일이 하나만 존재 | 인지 과부하 방지 (§3.7 점진적 공개) |
| **실패 없는 경험** | 어떤 버튼을 눌러도 "틀렸다"는 메시지 없음 | 성장 마인드셋 (§3.8) |
| **보이는 진행** | 현재 위치와 남은 단계를 항상 시각적으로 표시 | 스캐폴딩 (§3.6) + ZPD (§3.5) |

### 8.2 연령별 UI 분기 (3-Tier Visual Density)

교육 이론 §3.7(점진적 공개)의 실제 구현입니다. 연령별로 **보이는 것 자체가 다릅니다**:

| 설계 요소 | Beginner (6~8세) | Intermediate (9~11세) | Advanced (12~13세) |
|----------|-----------------|---------------------|-------------------|
| **네비게이션 메뉴** | 3개 (Books, Words, Profile) | 5개 (+Library, Review) | 6개 (전체 + Dashboard) |
| **터치 타겟** | 64px | 52px | 48px |
| **본문 폰트** | 18px | 16px | 14px |
| **화면당 항목** | 3개 | 5개 | 6개 |
| **기본 입력 방식** | 음성 100% (큰 마이크 버튼) | 음성 우선 + 텍스트 보조 | 텍스트 우선 + 음성 보조 |
| **세션 단계 수** | 4단계 (블룸 Remember~Apply) | 5단계 (+Warm Connection) | 6단계 (전체, Create 포함) |

**구현 위치**: `featureGates.js` FEATURE_GATES, `VoicePanel.js` 3-way input layout, `SessionContext.js` getAgeAdaptedStages()

### 8.3 세션 화면의 교육적 흐름

세션 화면은 **4개 모듈**로 분해되어 있으며, 각각이 교육 이론을 담당합니다:

| 모듈 | 역할 | 교육 이론 매핑 |
|------|------|---------------|
| **StageRenderer** (좌측 패널) | 워크시트 진행 표시 — "지금 어디에 있는지" 시각화 | §3.6 스캐폴딩 (진행 안내) |
| **ChatColumn** (중앙) | AI 대화 — 한 번에 하나의 질문만 표시 | §3.1 소크라테스 (단일 질문 집중) |
| **VoicePanel** (하단 입력) | 연령별 입력 방식 자동 전환 | §3.7 점진적 공개 |
| **VocabSidebar** (우측 사이드바) | 대화 중 i+1 어휘 실시간 노출 | §3.4 크라센 i+1 |

**추가 오버레이**:

| 오버레이 | 트리거 | 교육 이론 매핑 |
|---------|--------|---------------|
| **AchieveOverlay** | 단계 전환, 세션 완료 | §3.8 성장 마인드셋 (과정 칭찬) |
| **ConfettiCelebration** | 세션 완료 | §3.9 감정 중심 학습 (긍정 감정 강화) |
| **SessionTimer** | 15분/25분 마일스톤 | 집중력 관리 + 인지 과부하 방지 |

**구현 위치**: `session/page.js` (269줄 진입점), `StageRenderer.js`, `VoicePanel.js`, `VocabSidebar.js`, `AchieveOverlay.js`

### 8.4 입력 방식의 교육적 설계

6~13세 아동은 타이핑보다 말하기가 자연스럽습니다. 입력 UI는 연령에 따라 **자동 전환**됩니다:

| 레벨 | 입력 레이아웃 | 설계 근거 |
|------|------------|----------|
| **Beginner** | 화면 중앙에 큰 마이크 버튼(80px+), 텍스트 입력은 토글로 숨김 | 소근육 미발달 → 타이핑 부담 제거 |
| **Intermediate** | 마이크 버튼 강조 + 옆에 텍스트 입력 노출 | 점진적 타이핑 경험 제공 |
| **Advanced** | 텍스트 입력 우선 + 작은 마이크 버튼 | 복잡한 논증은 텍스트가 효과적 |

**Fallback 전략**: 네트워크 불안정 시 → 오프라인 기본 STT 또는 텍스트 전환, 음성 미지원 브라우저 → 자동 텍스트 모드

**구현 위치**: `VoicePanel.js` (isBeginnerMode / isAdvancedMode 분기)

### 8.5 진행 표시의 교육적 설계

아이가 **"지금 어디에 있고, 얼마나 남았는지"**를 항상 알 수 있어야 학습 불안이 줄어듭니다:

| 요소 | 시각화 방식 | 교육 이론 근거 |
|------|-----------|---------------|
| **Tree Garden 프로그레스바** | 🌱→🌿→🌳→🌲→🌸→🍎 나무 성장 | §3.9 감정 중심 (성장 메타포) |
| **워크시트 행** | 현재 단계 하이라이트 + 완료 단계 체크 | §3.6 스캐폴딩 (위치 안내) |
| **턴 카운터** | "Turn 1/3" 또는 Beginner용 이모지 표시 | §3.2 T.E.A.A. (3턴 구조 시각화) |
| **짧은 답변 격려** | "Tell me more!" 부드러운 프롬프트 | §3.10 짧은 답변 유도 |

**구현 위치**: `StageProgress.js`, `StageRenderer.js`, `VoicePanel.js`

### 8.6 컬러 시스템

Ghibli 영감의 따뜻한 팔레트로 통일. 아동의 집중력 유지를 위해 차분하면서도 친근한 색상을 사용합니다:

| 용도 | 컬러 | 적용 위치 |
|------|------|----------|
| Primary | `#5C8B5C` (지브리 그린) | 헤더, 진행 표시, HiAlice 아바타 |
| Background | `#FFFCF3` (크림) | 전체 배경 — 눈의 피로 최소화 |
| Border | `#D6C9A8` (따뜻한 베이지) | 구분선, 카드 테두리 |
| Accent | `#D4A843` (골드) | 강조 요소, 보상, 알림 |
| Success | `#27AE60` (녹색) | 완료 표시, 긍정 피드백 |
| Text | `#3D2E1E` (다크 브라운) | 본문 텍스트 |

**구현 위치**: `constants.js` COLORS, `tailwind.config.js` 통합 팔레트

### 8.7 터치 인터랙션

| 요소 | 사양 | 설계 근거 |
|------|------|----------|
| **최소 터치 영역** | 48×48px (Beginner는 64px) | WCAG 2.1 AA + 아동 소근육 |
| **버튼 간격** | 최소 8px | 오터치 방지 |
| **마이크 버튼** | 하단 중앙, 80px 이상 | 가장 중요한 행동 = 가장 큰 버튼 |
| **스와이프 제스처** | 좌우 스와이프로 단계 이동 | 태블릿 자연스러운 조작 |
| **피드백 애니메이션** | 터치 즉시 시각적 반응 | 행동 → 결과 인과 관계 명확화 |

### 8.8 화면 구성 (주요 페이지)

| 화면 | 핵심 행동 | 교육적 설계 포인트 |
|------|---------|-----------------|
| **로그인/학생 선택** | 프로필 탭 | 아바타 선택으로 자기 정체감 형성 |
| **책 선택** | 책 고르기 | 레벨별 자동 필터링 — 적합 도서만 노출 |
| **Q&A 세션** | AI와 대화 | 4~6단계 진행 + 3턴 T.E.A.A. + 1질문 집중 |
| **단어 리뷰** | 학습 단어 확인 | Word Cloud + 품사 분류 + Synonym Map |
| **마이 프로필** | 성장 확인 | GrowthRadar 7차원 레이더 + 완독 기록 |
| **Story Studio** | 창작 글쓰기 | Beginner: 스캐폴딩 힌트, Advanced: 자유 작성 |

### 8.9 교육 이론 → UI 매핑 요약

| 교육 이론 (§3) | UI/UX 구현 | 구현 파일 |
|---------------|-----------|----------|
| §3.1 소크라테스 | 한 번에 하나의 질문만 표시 | ChatColumn |
| §3.2 T.E.A.A. | 3턴 진행 카운터 | VoicePanel 턴 표시 |
| §3.3 블룸 분류 | 연령별 세션 단계 수 차등 (4/5/6) | SessionContext getAgeAdaptedStages() |
| §3.4 크라센 i+1 | 대화 중 사이드바 어휘 노출 | VocabSidebar, VocabMiniCard |
| §3.5 비고츠키 ZPD | 7차원 성장 레이더 차트 | GrowthRadar SVG |
| §3.6 스캐폴딩 | 워크시트 진행 표시 + Tree Garden | StageRenderer, StageProgress |
| §3.7 점진적 공개 | 3-Tier 메뉴/폰트/터치 분기 | featureGates.js, NavBar.js |
| §3.8 성장 마인드셋 | 업적 언락 + 오류 없는 UI | AchieveOverlay, AchievementUnlock |
| §3.9 감정 학습 | 축하 애니메이션 + 감정 이모지 반응 | ConfettiCelebration, emotionReact |
| §3.10 짧은 답변 유도 | "Tell me more!" 격려 프롬프트 | VoicePanel shortAnswer 표시 |

---

## 9. 개발 로드맵

| Phase | 기간 | 주요 작업 | 상태 |
|-------|------|----------|------|
| **1** | Week 1-2 | 프로젝트 셋업, DB 스키마 설계, AI 프롬프트 초안 | ✅ 완료 |
| **2** | Week 3-4 | Core UI 구현, 음성 인식 통합, 기본 대화 플로우 | ✅ 완료 |
| **3** | Week 5-6 | Q&A 세션 완성, 단어 학습 시스템, TTS 적용 | ✅ 완료 |
| **4** | Week 7-8 | 어드민 대시보드, 리포트 기능, 테스트 및 버그 수정 | ✅ 완료 |
| **5** | Week 9+ | 베타 테스트, 사용자 피드백 반영, 정식 런칭 | ✅ 완료 |

### 9.1 개발 검증 프로세스

각 기능 개발 시 다음 루프를 반복합니다:

**탐색 → 수정 → 검증 → 보고**

1. 코드베이스 탐색 및 관련 파일 확인
2. 기능 구현 또는 버그 수정
3. 테스트 실행 (실패 시 재수정)
4. 변경 이유와 검증 결과 문서화
5. 빌드 검증 완료 전까지 작업 미완료 처리

### 9.2 검증 체크리스트

- [ ] 요구사항 전부 충족했는가?
- [ ] 코드 수정이 실제 원인을 해결하는가?
- [ ] 테스트/빌드가 통과하는가?
- [ ] 출력 형식이 요청과 일치하는가?
- [ ] 검증 실패 시 수정 후 다시 검증했는가?

---

## 10. 에이전트 역할 분담

| 에이전트 | 담당 영역 | 상태 |
|---------|---------|------|
| 🏛️ Admin Agent | 전체 감독, QA, 충돌 해결 | 활성 |
| ⚙️ Backend Agent | Express API, Supabase DB, 인증 | 🔲 대기 |
| 🎨 Frontend Agent | React/Next.js + Tailwind CSS UI/UX | 🔲 대기 |
| 📱 Mobile Agent | React Native (Expo) 모바일 앱 | 🔲 대기 |
| 🤖 AI Agent | HiAlice 엔진, Claude API, 프롬프트 | 🔲 대기 |
| 🔒 Security Agent | COPPA, 콘텐츠 필터, 암호화 | 🔲 대기 |
| 🔊 Speech Agent | STT(Whisper), TTS(ElevenLabs) 통합 | 🔲 대기 |

---

## 11. 환경변수 설정

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# AI Engine
ANTHROPIC_API_KEY=your-anthropic-api-key     # Claude Sonnet 4 (HiAlice 대화)

# Speech
OPENAI_API_KEY=your-openai-key               # Whisper STT (선택)
ELEVENLABS_API_KEY=your-elevenlabs-key       # TTS 음성 합성 (선택)

# Image
OPENAI_API_KEY=your-openai-key               # DALL-E 3 이미지 생성 (선택)

# Auth
JWT_SECRET=hialice-secret-change-in-prod
```

---

## 부록: 추가 고려사항

### A. 보안

- 아동 대상 서비스이므로 COPPA 등 아동 개인정보보호 규정 준수
- 학부모 동의 프로세스 구현
- 대화 로그 암호화 저장

### B. 오프라인 대응

- 음성 인식은 네트워크 의존적이므로 Fallback UI 필요
- 기본 단어 데이터 로컬 캐싱

### C. 게이미피케이션 (향후 확장)

- 완독 배지, 스트릭 보상
- 어휘 레벨업 시스템
- 친구와 비교 (선택적)

---

## 12. 작업 연속성 프로토콜

### 12.1 세션 시작 프로토콜

1. **PROGRESS.md 읽기** — 프로젝트 루트의 `PROGRESS.md`를 먼저 확인
2. **상태 파악** — Quick Stats와 Session Log로 현재 진행 상황 파악
3. **작업 선택** — 미완료 항목 중 Phase 순서대로 작업 선택
4. **Supervisor 지시 우선** — Supervisor의 명시적 지시가 있으면 해당 항목 우선

### 12.2 작업 중 프로토콜

- 커밋 메시지에 항목 ID 포함 (예: `[P1-BE-01] DB 스키마 마이그레이션`)
- 복수 항목 작업 시 관련 ID 모두 기재
- 코드 변경과 PROGRESS.md 업데이트를 같은 커밋 또는 연속 커밋으로 처리

### 12.3 세션 종료 프로토콜

1. **체크박스 업데이트** — 완료된 항목을 `[x]`로 변경
2. **Quick Stats 업데이트** — 완료/미완료 수 갱신
3. **Session Log 추가** — 날짜, 작업 내용, 완료 항목 ID 기록
4. **커밋** — PROGRESS.md 변경사항 커밋

### 12.4 우선순위 규칙

1. Supervisor 명시적 지시 (최우선)
2. 현재 Phase의 미완료 항목
3. 이전 Phase의 잔여 항목
4. Beta Test 이슈 (보안 관련 우선)

---

*— HiAlice 운영기획서 v1.0 | 2026.03 —*
