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

### 2.2 소크라테스식 대화 원칙

- **정답 제시 금지**: 학생의 답이 틀려도 바로 교정하지 않고 추가 질문으로 유도
- **열린 질문 사용**: Yes/No가 아닌 Why, How, What if 질문 활용
- **개인적 해석 존중**: 책 내용과 다른 해석도 학생의 창의적 사고로 인정
- **점진적 심화**: 학생 응답 수준에 따라 질문 난이도 동적 조절

---

## 3. AI 선생님 페르소나: HiAlice

### 3.1 캐릭터 설정

| 항목 | 내용 |
|------|------|
| **이름** | HiAlice (하이앨리스) |
| **말투 스타일** | 미국 동부 영어 선생님 스타일 — 따뜻하고 격려하는 톤, 명확한 발음 |
| **핵심 성격** | 인내심 있음, 호기심 유발, 칭찬 적극적, 실수에 관대함 |
| **언어 수준 조절** | 학생 레벨에 따라 어휘 난이도와 문장 복잡도 자동 조절 |

### 3.2 대화 예시 (레벨별)

**Beginner (6~8세)**
> *HiAlice: "Hi there! I loved that book too! What was your favorite part? Was it funny? Or maybe a little scary?"*

**Intermediate (9~11세)**
> *HiAlice: "That's an interesting observation! Can you tell me why you think the character made that choice? What would you have done differently?"*

**Advanced (12~13세)**
> *HiAlice: "You've made a compelling point about the theme. How do you think this connects to real-world situations? Can you support your argument with specific evidence from the text?"*

---

## 4. 단어 학습 및 데이터 시스템

### 4.1 대화 중 단어 수집

AI와의 대화에서 학생이 사용한 모든 단어를 자동으로 추적하고, 새로운 단어나 고급 표현 사용 시 즉시 데이터베이스에 기록합니다.

### 4.2 단어 리뷰 구조

| 항목 | 설명 |
|------|------|
| **사용 단어** | 학생이 대화에서 실제로 사용한 단어 목록 |
| **동의어 확장** | 각 단어의 유사어/반의어를 함께 제시하여 어휘력 확장 |
| **문맥 예문** | 학생이 단어를 사용한 실제 문장을 예문으로 저장 |
| **숙달도 추적** | 반복 사용 횟수, 정확한 사용 여부 등으로 숙달도 측정 |

### 4.3 데이터베이스 스키마

```
Students: id, name, age, level, parent_id, created_at
Parents: id, email, password_hash, children[], created_at
Books: id, title, author, level, genre, cover_emoji, description
Sessions: id, student_id, book_id, stage, started_at, completed_at, level_score, grammar_score, image_url
Dialogues: id, session_id, stage, turn, speaker, content, timestamp, grammar_score
Vocabulary: id, student_id, word, context_sentence, synonyms, antonyms, pos, first_used, mastery_level, use_count
```

### 4.4 단어 시각화 UI

세션 종료 후 학생이 사용한 단어들을 시각적으로 정리:
- **Word Cloud**: 자주 사용한 단어 크게 표시
- **Category Grouping**: 명사/동사/형용사 등 품사별 분류
- **Synonym Map**: 사용 단어와 유사 단어 연결 표시
- **Progress Bar**: 새로 배운 단어 vs 복습 단어 비율

---

## 5. 기술 아키텍처

### 5.1 시스템 구성

| 레이어 | 기술 스택 | 핵심 기능 |
|--------|----------|----------|
| **Frontend** | React/Next.js + Tailwind CSS | 반응형 UI, 태블릿 최적화, 터치 인터랙션 |
| **Backend** | Node.js + Express / Supabase | API 서버, 인증, 데이터 관리 |
| **AI Engine** | Claude API (Sonnet 4) | 대화 생성, 소크라테스식 질문, 문법 피드백 |
| **Speech** | Web Speech API / Whisper / ElevenLabs | 음성 인식(STT), 음성 합성(TTS) |
| **Database** | PostgreSQL / Supabase | 학생 데이터, 세션 로그, 단어 DB |
| **Mobile** | React Native (Expo) | iOS/Android 네이티브 앱 |

### 5.2 음성 인식 우선순위

6~13세 아동의 특성상 타이핑보다 말하기가 자연스러우므로, **음성 인식을 기본 입력 방식**으로 설정합니다.

1. **Primary**: 음성 입력 (큰 마이크 버튼, 터치로 활성화)
2. **Secondary**: 텍스트 입력 (고학년/선호 시 전환 가능)
3. **Fallback**: 네트워크 불안정 시 오프라인 기본 STT 또는 텍스트 전환

### 5.3 AI 프롬프트 구조 (시스템 프롬프트)

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

## 6. 어드민 관리 시스템

### 6.1 대시보드 기능

| 기능 | 상세 내용 |
|------|----------|
| **학생 관리** | 학생 등록/수정, 레벨 설정, 학습 현황 모니터링 |
| **도서 관리** | 책 등록, 레벨 태깅, Q&A 템플릿 설정 |
| **대화 레벨 조정** | AI 질문 난이도, 응답 길이, 문법 교정 강도 설정 |
| **성적 리포트** | 학생별 완독 기록, 어휘 성장 그래프, 문법 정확도 추이 |
| **AI 프롬프트 관리** | HiAlice 시스템 프롬프트 수정, A/B 테스트 |

### 6.2 문법 완성도 평가 기준

- **문장 구조**: 주어-동사 일치, 시제 사용, 문장 완결성
- **어휘 다양성**: 사용 단어 수, 고급 어휘 비율, 반복 사용 감소
- **표현 정확성**: 관사, 전치사, 복수형 등 세부 문법 정확도
- **응답 길이**: 평균 응답 단어 수, 문장 수 추이

### 6.3 리포트 예시 항목

- 월별 완독 권수
- 세션당 평균 대화 턴 수
- 어휘 성장률 (신규 단어/주)
- 문법 정확도 변화 추이
- 가장 많이 사용한 단어 Top 10
- 개선이 필요한 문법 항목

---

## 7. UI/UX 디자인 가이드라인

### 7.1 컬러 시스템

6~13세 아동의 집중력 유지를 위해 차분하면서도 친근한 컬러 팔레트를 사용합니다.

| 용도 | 컬러 | 적용 위치 |
|------|------|----------|
| Primary | `#4A90D9` (밝은 파랑) | 버튼, 강조 요소, HiAlice 아바타 |
| Background | `#F5F7FA` (연한 회색) | 전체 배경 (눈의 피로 최소화) |
| Accent | `#F39C12` (오렌지) | 진행 표시, 알림, 보상 요소 |
| Success | `#27AE60` (녹색) | 완료 표시, 정답 피드백 |

### 7.2 터치 인터랙션

- **큰 터치 영역**: 최소 48x48px, 버튼 간격 최소 8px
- **마이크 버튼**: 화면 하단 중앙, 80px 이상 크기
- **스와이프 제스처**: 세션 단계 이동 시 좌우 스와이프 지원
- **피드백 애니메이션**: 터치 시 즉각적인 시각적 반응

### 7.3 화면 구성 (주요 페이지)

1. **로그인/학생 선택**: 간단한 프로필 선택 UI
2. **책 선택**: 레벨별 필터링, 표지 썸네일
3. **Q&A 세션**: 대화 인터페이스 + 마이크 버튼 + 4단계 진행 표시
4. **단어 리뷰**: 사용 단어 시각화 + 동의어 확장
5. **마이 프로필**: 완독 기록, 성장 그래프

---

## 8. 개발 로드맵

| Phase | 기간 | 주요 작업 | 상태 |
|-------|------|----------|------|
| **1** | Week 1-2 | 프로젝트 셋업, DB 스키마 설계, AI 프롬프트 초안 | ✅ 완료 |
| **2** | Week 3-4 | Core UI 구현, 음성 인식 통합, 기본 대화 플로우 | 🔄 진행중 |
| **3** | Week 5-6 | Q&A 세션 완성, 단어 학습 시스템, TTS 적용 | 🔲 대기 |
| **4** | Week 7-8 | 어드민 대시보드, 리포트 기능, 테스트 및 버그 수정 | 🔲 대기 |
| **5** | Week 9+ | 베타 테스트, 사용자 피드백 반영, 정식 런칭 | 🔲 대기 |

### 8.1 개발 검증 프로세스

각 기능 개발 시 다음 루프를 반복합니다:

**탐색 → 수정 → 검증 → 보고**

1. 코드베이스 탐색 및 관련 파일 확인
2. 기능 구현 또는 버그 수정
3. 테스트 실행 (실패 시 재수정)
4. 변경 이유와 검증 결과 문서화
5. 빌드 검증 완료 전까지 작업 미완료 처리

### 8.2 검증 체크리스트

- [ ] 요구사항 전부 충족했는가?
- [ ] 코드 수정이 실제 원인을 해결하는가?
- [ ] 테스트/빌드가 통과하는가?
- [ ] 출력 형식이 요청과 일치하는가?
- [ ] 검증 실패 시 수정 후 다시 검증했는가?

---

## 9. 에이전트 역할 분담

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

## 10. 환경변수 설정

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

*— HiAlice 운영기획서 v1.0 | 2026.03 —*
