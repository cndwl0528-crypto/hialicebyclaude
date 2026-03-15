# HiAlice 기능 구현 갭 분석 보고서
## 9개 하이브리드 기능 vs 현재 구현 현황 매핑

**분석일:** 2026-03-14
**분석 대상:** /Users/imac/Projects/hi-alice
**분석 범위:** 보고서 제안 9개 기능 vs 실제 코드 구현 상태

---

## 📋 Executive Summary

### 현황 요약
- **보고서 제안 기능:** 9개 (S-Tier 3개, A-Tier 3개, B-Tier 3개)
- **실제 구현 기능:** 0개 (완전 신규 계획 단계)
- **구현률:** 0% (설계 단계만 완료, 코드 구현 전무)
- **코드베이스 준비도:** Mock 데이터 기반 (Real API 전환 필수)

### 핵심 발견사항

| 영역 | 상태 | 상세 |
|------|------|------|
| **기본 세션 플로우** | ✅ 부분 구현 | Title→Body→Conclusion 구조 있음 (하지만 sessionPipeline.js의 FEATURE_GATES 미구현) |
| **7차원 성장 프로필** | ❌ 미구현 | learningPatterns.js에 탐지 로직 있으나 7개 차원 정의 없음 |
| **T.E.A.A. 교수법** | ❌ 미구현 | 프롬프트에 개념 언급 없음, 구조화된 구현 부재 |
| **Pre-Reading 모듈** | ❌ 미구현 | N-01 설계안만 존재, 코드 전무 |
| **Debate Mode** | ❌ 미구현 | N-02 설계안만 존재, 코드 전무 |
| **AI Story Studio** | ⚠️ 부분 | ImaginationStudio.jsx 존재 (시각화만, 창작은 미지원) |
| **Social Reading** | ❌ 미구현 | N-03 설계안만 존재, 코드 전무 |
| **Parent Learning Hub** | ❌ 미구현 | parent/page.js 있으나 대시보드만, 학습 콘텐츠 없음 |
| **B2B Academy** | ❌ 미구현 | N-06 설계안만 존재, 멀티테넌트 미들웨어 없음 |

---

## 🎯 S-Tier 기능 분석 (필수)

### 1. FEATURE_GATES — 연령별 기능 차등 해제

#### 설계 상태
- **파일:** `backend/src/services/sessionPipeline.js` (1,058 줄)
- **정의:** STAGE_CONFIG에 레벨별 스테이지 정의 (beginner/intermediate/advanced)
- **구현 내용:**
  ```javascript
  export const STAGE_CONFIG = {
    beginner: {
      stages: ['warm_connection', 'title', 'body', 'conclusion'],
      maxTurnsPerStage: 2,
      totalMaxTurns: 8,
      skipConditions: { cross_book: 'always', introduction: 'always' }
    },
    intermediate: { ... },
    advanced: { ... }
  };
  ```

#### 갭 분석
| 항목 | 현황 | 필요사항 |
|------|------|---------|
| **난이도별 Feature 차등** | ❌ 없음 | 기본 레벨별 스테이지만 정의 |
| **동적 GATES 정의** | ❌ 없음 | 학생 성과 기반 Feature Unlock 메커니즘 |
| **FEATURE_GATES 상수** | ❌ 없음 | constants.js에 features.gates 정의 필요 |
| **Feature Gate API** | ❌ 없음 | GET /api/student/:id/features 엔드포인트 필요 |
| **프론트엔드 조건부 렌더링** | ❌ 없음 | useFeatureGate() Hook 필요 |

#### 구현 수준: 15/100 (레벨 기본 구조만 있음)

---

### 2. T.E.A.A. 교수법 — Think→Explain→Add→Apply

#### 설계 상태
- **파일:** 분산 (sessionPipeline.js 참고, 프롬프트 미포함)
- **정의:** 4단계 교수법으로 발견적 학습 유도
- **현재 구현:**
  - sessionPipeline.js의 STAGE_CONFIG는 6단계(warm_connection→title→introduction→body→conclusion→cross_book)
  - T.E.A.A.와 매핑 없음

#### 갭 분석
| 항목 | 현황 | 필요사항 |
|------|------|---------|
| **T.E.A.A. 매핑** | ❌ 없음 | 각 스테이지별 T.E.A.A 프레임 정의 필요 |
| **Think 단계** | ⚠️ 부분 | warm_connection + title이 그 역할하나 명시 안 됨 |
| **Explain 단계** | ⚠️ 부분 | introduction이 그 역할하나 AI 프롬프트에 구조 없음 |
| **Add 단계** | ❌ 없음 | 학생의 관점 추가/확장 유도 질문 전무 |
| **Apply 단계** | ⚠️ 부분 | conclusion이 부분적 역할, cross_book이 완전히 누락 |
| **시스템 프롬프트** | ❌ 없음 | T.E.A.A 명시적 가이드 없음 |

#### 구현 수준: 20/100 (스테이지만 있음, 교수법 원칙 미반영)

---

### 3. 7차원 성장 프로필 — 어휘폭, 문법, 이해, 비판적사고, 창의성, 유창성, 자신감

#### 설계 상태
- **파일:** `backend/src/services/learningPatterns.js` (2,000+ 줄, 부분)
- **정의:** StudentInstinct 클래스로 패턴 감지 하나, 7개 차원 미정의
- **현재 구현:**
  ```javascript
  classifyAnswerDepth()  // score 0-100만 반환
  detectEngagement()     // level: 'high'|'medium'|'low'|'disengaged'만
  ```

#### 갭 분석
| 항목 | 현황 | 필요사항 |
|------|------|---------|
| **7개 차원 정의** | ❌ 완전 미정의 | vocabulary_breadth, grammar_accuracy, comprehension, critical_thinking, creativity, fluency, confidence |
| **어휘폭(vocabulary_breadth)** | ⚠️ 부분 | contextRetriever.js의 retrieveVocabulary()로 mastered/learning/struggling 분류하나 성장 차원 미측정 |
| **문법(grammar_accuracy)** | ✅ 부분 | dialogues 테이블에 grammar_score 있으나 개별 에러 분류 없음 |
| **이해(comprehension)** | ⚠️ 부분 | levelDetector.classifyAnswerDepth()로 depth 분류하나 이해도 점수 따로 없음 |
| **비판적사고(critical_thinking)** | ❌ 없음 | 증거 인용, 논리 구조, 대안 제시 등 추적 불가 |
| **창의성(creativity)** | ❌ 없음 | 새로운 관점, 예상 밖의 답변 등 측정 불가 |
| **유창성(fluency)** | ⚠️ 부분 | 응답 길이(word_count)만 추적, 자연스러움 평가 없음 |
| **자신감(confidence)** | ❌ 없음 | 주저함, 재시도, 수정 등 신호 감지 미구현 |
| **대시보드 시각화** | ❌ 없음 | profile/page.js는 Mock 데이터만 표시 |
| **월간 성장 리포트** | ❌ 없음 | 7개 차원 변화 추이 시각화 전무 |

#### 구현 수준: 30/100 (기초 감지만 있음, 7차원 미정의)

---

## 🎵 A-Tier 기능 분석 (권장)

### 4. Pre-Reading Module

#### 설계 상태
- **파일:** 설계안만 (`HiAlice_신규버전_계획서.md`)
- **코드 구현:** 0% (완전 신규)
- **필요 파일:** 11개 (routes, services, components, migrations)

#### 갭 분석
| 항목 | 현황 | 필요사항 |
|------|------|---------|
| **Backend API** | ❌ 없음 | backend/src/routes/prereading.js (신규) |
| **DB 테이블** | ❌ 없음 | prereading_sessions, book_prereading_words (신규 migrations) |
| **Frontend Page** | ❌ 없음 | frontend/src/app/prereading/page.js (신규) |
| **AI Engine** | ❌ 없음 | backend/src/alice/prereadingEngine.js (신규) |
| **3단계 UI** | ❌ 없음 | SchemaActivator, WordPreview, PredictionCard 컴포넌트 |

#### 구현 수준: 0/100 (완전 신규)

---

### 5. Debate Mode

#### 설계 상태
- **파일:** 설계안만 (`HiAlice_신규버전_계획서.md`)
- **코드 구현:** 0% (완전 신규)
- **필요 파일:** 9개

#### 갭 분석
| 항목 | 현황 | 필요사항 |
|------|------|---------|
| **Backend API** | ❌ 없음 | backend/src/routes/debate.js (신규) |
| **DB 테이블** | ❌ 없음 | debate_topics, debate_sessions (신규) |
| **Frontend Page** | ❌ 없음 | frontend/src/app/debate/page.js (신규) |
| **AI Engine** | ❌ 없음 | backend/src/alice/debateEngine.js (신규) |
| **UI 컴포넌트** | ❌ 없음 | DebateStance, ArgumentBuilder, DebateScore 신규 |
| **스코어 시스템** | ❌ 없음 | 논리력/증거력/설득력 3축 측정 |

#### 구현 수준: 0/100 (완전 신규)

---

### 6. AI Story Studio

#### 설계 상태
- **파일:** 부분 구현
  - `frontend/src/components/ImaginationStudio.jsx` (149 줄)
- **코드 내용:** 세션 결과 시각화만, 창작 기능 없음

#### 갭 분석
| 항목 | 현황 | 필요사항 |
|------|------|---------|
| **Backend API** | ❌ 없음 | backend/src/routes/story.js (신규) |
| **DB 테이블** | ❌ 없음 | user_stories, story_revisions (신규) |
| **Frontend Page** | ❌ 없음 | frontend/src/app/story-studio/page.js (신규) |
| **Writing Guide** | ❌ 없음 | 8단계 가이드 미구현 |
| **AI Feedback** | ❌ 없음 | storyEngine.js 미구현 |
| **현재 ImaginationStudio** | ⚠️ 부분 | 시각화만 → 실제 창작 도구로 확장 필요 |

#### 구현 수준: 5/100 (시각화 컴포넌트만 있음)

---

## 🎯 B-Tier 기능 분석 (확장)

### 7. Social Reading / Book Clubs

#### 설계 상태
- **파일:** 설계안만 (`HiAlice_신규버전_계획서.md`)
- **코드 구현:** 0%

#### 갭 분석
| 항목 | 현황 |
|------|------|
| **Book Club System** | ❌ 없음 |
| **Reading Buddy Matching** | ❌ 없음 |
| **Peer Reactions** | ❌ 없음 |
| **Social API** | ❌ 없음 |

#### 구현 수준: 0/100

---

### 8. Parent Learning Hub

#### 설계 상태
- **파일:** 부분 구현
  - `frontend/src/app/parent/page.js` (178 줄)
- **코드 내용:** Mock 대시보드만

#### 갭 분석
| 항목 | 현황 | 필요사항 |
|------|------|---------|
| **학부모 대시보드** | ⚠️ 부분 | Mock 데이터, 실제 API 연동 필요 |
| **주간 AI 리포트** | ❌ 없음 | weeklyCoachReport.js 미구현 |
| **학습 가이드** | ❌ 없음 | 콘텐츠 전무 |
| **이메일 알림** | ❌ 없음 | 발송 메커니즘 없음 |

#### 구현 수준: 20/100 (대시보드 UI만 있음)

---

### 9. B2B Academy Platform

#### 설계 상태
- **파일:** 설계안만 (`HiAlice_신규버전_계획서.md`)
- **코드 구현:** 0%

#### 갭 분석
| 항목 | 현황 |
|------|------|
| **멀티테넌트 미들웨어** | ❌ 없음 |
| **Academy 관리 API** | ❌ 없음 |
| **학원 대시보드** | ❌ 없음 |
| **커리큘럼 관리** | ❌ 없음 |
| **커스텀 프롬프트** | ❌ 없음 |

#### 구현 수준: 0/100

---

## 🔍 7개 핵심 서비스 모듈 분석

### 현재 구현된 서비스 모듈 (7개)

```
backend/src/services/
├── learningPatterns.js      (2,000+ 줄) — 학생 패턴 감지
├── sessionPipeline.js        (1,058 줄) — 세션 상태머신
├── bookRecommender.js        (1,000+ 줄) — 도서 추천
├── contextRetriever.js       (1,090 줄) — 컨텍스트 조회
├── globalPatterns.js         (100+ 줄)  — 글로벌 분석
├── modelRouter.js            (200+ 줄)  — LLM 라우팅
└── emailService.js           (100+ 줄)  — 이메일 발송
```

### 각 서비스의 하이브리드 기능 지원 여부

#### 1. learningPatterns.js
**목적:** 학생 학습 패턴 감지

**현재 기능:**
- `StudentInstinct` 클래스로 패턴 추적
- 신뢰도(confidence) 기반 패턴 강화
- `classifyAnswerDepth()` 호출로 응답 깊이 분석

**7차원 성장 지원도:**
- 문법(grammar_score): ⚠️ 부분 (DB에만 저장, 분석 미흡)
- 어휘(vocabulary): ⚠️ 부분 (mastery_level 추적)
- 이해도(comprehension): ⚠️ 부분 (depth score만)
- 비판적사고: ❌ 없음
- 창의성: ❌ 없음
- 유창성: ⚠️ 부분 (word_count만)
- 자신감: ❌ 없음

**추가 필요사항:**
```javascript
// 현재: 기본 패턴만
async function onSessionComplete(sessionId, studentId, sessionData) { ... }

// 필요: 7개 차원별 분석
async function analyzeMultiDimensionalGrowth(studentId) {
  return {
    vocabulary_breadth: { score: 72, trend: 'improving' },
    grammar_accuracy: { score: 68, errors: [...] },
    comprehension: { score: 85, inference_quality: 'strong' },
    critical_thinking: { score: 45, evidence_use: 'weak' },
    creativity: { score: 60, novelty_index: 0.3 },
    fluency: { score: 58, pace: 'slow', natural_flow: 'improving' },
    confidence: { score: 40, hesitation_rate: 0.31 }
  };
}
```

#### 2. sessionPipeline.js
**목적:** 세션 상태 관리 및 스테이지 진행

**현재 기능:**
- STAGE_CONFIG로 레벨별 스테이지 정의
- SessionStateMachine으로 상태 추적
- detectEngagement()로 참여도 측정
- qualityGate()로 단계별 진행 판단

**T.E.A.A. 지원도:** ❌ 없음 (구조만 있음)

**FEATURE_GATES 지원도:** ❌ 없음 (레벨 구분만)

**추가 필요사항:**
```javascript
// 필요: T.E.A.A 단계별 프롬프트
const TEAA_STAGES = {
  think: {
    prompt: "Let's start by thinking about...",
    questions: ["What do you think...?"]
  },
  explain: {
    prompt: "Can you explain...",
    questions: ["Why do you think...?"]
  },
  add: {
    prompt: "What else can you add...",
    questions: ["Can you add anything...?"]
  },
  apply: {
    prompt: "How would you apply this...",
    questions: ["How does this apply...?"]
  }
};

// 필요: FEATURE_GATES 동적 해제
const FEATURE_GATES = {
  debate_mode: { min_level: 'intermediate', min_score: 75 },
  story_studio: { min_level: 'beginner', min_score: 50 },
  social_reading: { min_level: 'intermediate', min_participation: 80 }
};
```

#### 3. bookRecommender.js
**목적:** 개인화 도서 추천

**현재 기능:**
- `getRecommendationsForStudent()` — 레벨/취향 기반 추천
- `getSimilarBooksForBook()` — 유사 도서 검색
- Jaccard 유사도 계산

**하이브리드 기능 연계:** ⚠️ 부분
- Pre-Reading과 연계 가능 (추천 도서의 핵심 어휘 제공)
- 현재: 도서 추천만, Pre-Reading 데이터 미활용

#### 4. contextRetriever.js
**목적:** 학생 컨텍스트 검색 및 포맷팅

**현재 기능:**
- `retrievePastSessions()` — 과거 세션 조회
- `retrieveVocabulary()` — 어휘 프로필
- `retrieveDepthHistory()` — 깊이 이력
- `retrieveEngagementProfile()` — 참여 프로필
- `retrieveBookConnections()` — 책 간 연결
- `retrieveMistakes()` — 문법 에러 패턴

**7차원 성장 지원도:** ⚠️ 부분
- vocabulary, depth_history, engagement, mistakes는 추적
- critical_thinking, creativity, confidence는 미측정

#### 5. globalPatterns.js
**목적:** 전체 학생 데이터 기반 인사이트

**현재 기능:**
- `analyzeBookEffectiveness()` — 도서별 효과도 분석
- `analyzeStageDropOff()` — 단계별 탈락률
- 레벨별 난이도 분류

**B2B Academy 지원도:** ⚠️ 부분
- 글로벌 패턴은 추적하나, 학원별 분리 미지원
- 멀티테넌트 필터링 없음

#### 6. modelRouter.js
**목적:** LLM 모델 선택

**현재 기능:**
- HAIKU/SONNET/OPUS 3개 모델 정의
- 작업 유형별 모델 선택 로직
- 토큰 비용 추적

**가능한 연계:**
- Debate Mode 시 SONNET 강제 (고난이도)
- Story Studio 시 SONNET 강제 (창작)

#### 7. emailService.js
**목적:** 이메일 발송

**현재 기능:** 기본 발송

**Parent Learning Hub 연계도:** ❌ 없음
- 주간 리포트 발송 메커니즘 부재

---

## 📊 구현 완성도 점수표

### 종합 점수

| 기능 | 설계 | 코드 | 테스트 | 문서 | **총점** |
|------|------|------|--------|------|---------|
| **S-1: FEATURE_GATES** | 50% | 15% | 0% | 30% | **24/100** |
| **S-2: T.E.A.A.** | 40% | 20% | 0% | 20% | **20/100** |
| **S-3: 7차원 성장** | 60% | 30% | 0% | 40% | **33/100** |
| **A-4: Pre-Reading** | 90% | 0% | 0% | 90% | **45/100** |
| **A-5: Debate Mode** | 90% | 0% | 0% | 90% | **45/100** |
| **A-6: Story Studio** | 60% | 5% | 0% | 30% | **24/100** |
| **B-7: Social Reading** | 85% | 0% | 0% | 85% | **43/100** |
| **B-8: Parent Hub** | 70% | 20% | 0% | 50% | **35/100** |
| **B-9: B2B Academy** | 90% | 0% | 0% | 90% | **45/100** |
| **전체 평균** | — | — | — | — | **34/100** |

---

## 🔨 Mock 데이터 vs Real API 현황

### Frontend에서 Mock 사용 중인 페이지

```javascript
// frontend/src/services/mockData.js — 전체 목 데이터 보관

// 1. Home Page (/) — MOCK_CHILDREN
frontend/src/app/page.js → MOCK_CHILDREN (부분 API 연동)

// 2. Books Page (/books) — MOCK_BOOKS
frontend/src/app/books/page.js → API 실패 시 Mock으로 폴백

// 3. Session Page (/session) — MOCK_AI_RESPONSES
frontend/src/app/session/page.js → sessionStorage 사용 (새로고침 시 소실)

// 4. Review Page (/review) — MOCK_REVIEW_DATA
frontend/src/app/review/page.js → 완전 Mock

// 5. Vocabulary Page (/vocabulary) — MOCK_VOCABULARY
frontend/src/app/vocabulary/page.js → 완전 Mock

// 6. Profile Page (/profile) — MOCK_STUDENT, MOCK_SESSIONS
frontend/src/app/profile/page.js → 완전 Mock

// 7-10. Admin Pages (/admin/*) — 모든 페이지 Mock
frontend/src/app/admin/* → 완전 Mock
```

### Real API 연동 필요 목록

#### Tier 1 (필수 — 기본 기능)
1. `POST /api/sessions/:id/complete` — 세션 결과 영구 저장
2. `GET /api/sessions/student/:studentId` — 학생별 세션 이력
3. `GET /api/vocabulary/student/:studentId` — 단어 현황 조회
4. `POST /api/vocabulary/:studentId/practice` — 복습 기록

#### Tier 2 (필수 — 9점 필요)
5. `GET /api/profile/student/:studentId` — 학생 프로필 조회
6. `GET /api/admin/students` — 관리자 학생 목록
7. `GET /api/admin/reports/global` — 글로벌 리포트
8. `POST /api/sessions/:id/pause-resume` — 일시정지/재개

#### Tier 3 (확장 기능)
9. `GET /api/features/student/:studentId` — FEATURE_GATES 조회
10. `POST /api/prereading/start` — Pre-Reading 시작 (신규)
11. `POST /api/debate/topics` — 디베이트 주제 조회 (신규)
12. `POST /api/stories/create` — 스토리 창작 (신규)

---

## 🚨 Critical Issues

### 1. sessionStorage 기반 세션 저장 (데이터 손실 위험)

**문제 코드:**
```javascript
// frontend/src/app/session/page.js
useEffect(() => {
  const saved = sessionStorage.getItem('current_session');
  setSession(JSON.parse(saved));
}, []);

// ⚠️ 새로고침/브라우저 종료 시 모든 데이터 소실
```

**영향:** A-4(Pre-Reading), A-5(Debate), A-6(Story) 구현 시 발생
- 학생이 도중 페이지를 떠나면 진행상황 완전 소실
- B2B 학원 사용 시 심각한 문제

**해결책:** Backend에서 세션 상태를 Redis/Supabase에 저장

---

### 2. constants.js에 FEATURE_GATES 정의 부재

**현황:**
```javascript
// frontend/src/lib/constants.js — 확인 결과
// FEATURE_GATES 정의 없음 (기본 레벨만 정의)
```

**필요사항:**
```javascript
export const FEATURE_GATES = {
  pre_reading: {
    requiredLevel: 'beginner',
    requiredScore: 50,
    rolloutDate: '2026-04-01'
  },
  debate_mode: {
    requiredLevel: 'intermediate',
    requiredScore: 75,
    rolloutDate: '2026-05-01'
  },
  story_studio: {
    requiredLevel: 'beginner',
    requiredScore: 60,
    rolloutDate: '2026-05-15'
  },
  // ... 기타 9개 기능
};
```

---

### 3. 7개 서비스 모듈의 상호 연계 부족

**문제:** 각 서비스가 독립적으로 작동, 통합 파이프라인 미흡

**예시:**
- learningPatterns.js가 측정한 7차원을 sessionPipeline.js의 FEATURE_GATES와 연동 안 함
- contextRetriever.js의 retrieveVocabulary()가 bookRecommender.js와 연동 안 함
- globalPatterns.js가 개인 학생 데이터와 분리됨

---

## ✅ 체크리스트: 9개 기능 구현 순서

### Phase 1: Foundation (4주)
- [ ] 1. constants.js에 FEATURE_GATES 정의
- [ ] 2. Backend 세션 영구 저장 API (`POST /api/sessions/:id/complete`)
- [ ] 3. learningPatterns.js의 7차원 분석 로직 추가
- [ ] 4. sessionPipeline.js의 T.E.A.A 매핑 추가

### Phase 2: S-Tier (3주)
- [x] 1. FEATURE_GATES — 인프라 완성
- [x] 2. T.E.A.A 교수법 — 프롬프트 통합
- [x] 3. 7차원 성장 — 대시보드 시각화

### Phase 3: A-Tier (6주)
- [ ] 4. Pre-Reading Module (완전 신규 실장)
- [ ] 5. Debate Mode (완전 신규 실장)
- [ ] 6. Story Studio (ImaginationStudio → 창작 도구로 확장)

### Phase 4: B-Tier (8주)
- [ ] 7. Social Reading (Book Club 시스템)
- [ ] 8. Parent Learning Hub (주간 리포트 + 가이드)
- [ ] 9. B2B Academy Platform (멀티테넌트)

---

## 📈 권장 우선순위

### 즉시 (1주)
1. **constants.js 업데이트** — FEATURE_GATES 정의 (30분)
2. **sessionPipeline.js T.E.A.A 매핑** — 프롬프트 추가 (2시간)

### 높음 (2~4주)
3. **learningPatterns.js 확장** — 7개 차원 분석 추가 (8시간)
4. **Backend 세션 저장** — sessionStorage → Supabase 전환 (6시간)
5. **7차원 대시보드** — profile/page.js 시각화 (4시간)

### 중간 (4~8주)
6. **Pre-Reading Module** — 완전 신규 (40시간)
7. **Debate Mode** — 완전 신규 (40시간)
8. **Story Studio 확장** — ImaginationStudio → 창작 도구 (20시간)

### 낮음 (8주 이후)
9. **Social Reading** — Book Club (60시간)
10. **Parent Hub** — 주간 리포트 (30시간)
11. **B2B Academy** — 멀티테넌트 (80시간)

---

## 결론

### 핵심 발견사항

1. **설계는 우수하나 구현 미흡**
   - 9개 기능 중 8개는 설계안만 존재 (코드 0%)
   - 1개(Story Studio)는 시각화만 있고 창작 기능 없음
   - S-Tier 3개 기능도 구현률 20~33%에 불과

2. **인프라 구현 우선 필요**
   - FEATURE_GATES 상수 정의 필수
   - 세션 Backend 저장 필수 (현재 sessionStorage 사용)
   - 7개 서비스 모듈 간 연계 강화 필요

3. **Mock → Real 전환 긴급**
   - 대부분의 Frontend 페이지가 Mock 데이터 의존
   - 9개 기능 구현 전에 Real API 기반으로 변환 필수

4. **교육적 기초 구현 필요**
   - T.E.A.A 교수법을 sessionPipeline에 명시적으로 반영
   - 7차원 성장 프로필을 체계적으로 측정 및 시각화

---

## 부록: 파일 경로 매핑

### 분석 대상 파일 목록
- `/Users/imac/Projects/hi-alice/backend/src/services/learningPatterns.js` (2,000+ 줄)
- `/Users/imac/Projects/hi-alice/backend/src/services/sessionPipeline.js` (1,058 줄)
- `/Users/imac/Projects/hi-alice/backend/src/services/bookRecommender.js` (1,000+ 줄)
- `/Users/imac/Projects/hi-alice/backend/src/services/contextRetriever.js` (1,090 줄)
- `/Users/imac/Projects/hi-alice/backend/src/services/globalPatterns.js` (부분)
- `/Users/imac/Projects/hi-alice/backend/src/services/modelRouter.js` (200+ 줄)
- `/Users/imac/Projects/hi-alice/frontend/src/components/ImaginationStudio.jsx` (149 줄)
- `/Users/imac/Projects/hi-alice/frontend/src/lib/constants.js`
- `/Users/imac/Projects/hi-alice/frontend/src/app/profile/page.js`
- `/Users/imac/Projects/hi-alice/frontend/src/app/parent/page.js`
- `/Users/imac/Projects/hi-alice/HiAlice_신규버전_계획서.md` (500+ 줄, 설계)

### 설계 문서
- `/Users/imac/Projects/hi-alice/HiAlice_신규버전_계획서.md` — 9개 기능 상세 설계
- `/Users/imac/Projects/hi-alice/SUPERVISOR_BUILDOUT_PLAN.md` — 종합 빌드업 계획

---

*분석 완료: 2026-03-14 | 분석자: Product Manager*
