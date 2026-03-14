# HiAlice 스킬 종합 고도화 보고서

> 6개 전문 에이전시 병렬 분석 → 유연한 전환 구조 + 아동 UX 최적화
> 날짜: 2026-03-14 | 버전: v1.3 (Sprint 1~5 실행 결과 반영)

---

## 목차

1. [핵심 경영진 요약](#1-핵심-경영진-요약)
2. [아키텍처 — 유연한 전환 구조 설계](#2-아키텍처)
3. [디자인 시스템 — 아동 UX 최적화](#3-디자인-시스템)
4. [접근성 — WCAG 2.1 AA + 아동 특화](#4-접근성)
5. [학습 엔진 v3.0 — 적응형 학습 + 비용 최적화](#5-학습-엔진)
6. [기능 명세 (PRD) — 9개 하이브리드 기능](#6-기능-명세)
7. [테스팅 전략 — QA 체계 수립](#7-테스팅-전략)
8. [통합 12주 로드맵](#8-통합-로드맵)

---

## 1. 핵심 경영진 요약

**핵심 원칙: "뒤에서 똑똑하게, 앞에서 간단하게" (Smart Backend, Simple Frontend)**

### 핵심 지표

| 지표 | 값 | 비고 |
|------|-----|------|
| 전문 에이전시 | 6 | 병렬 분석 완료 |
| 소스 파일 분석 | 42 | 프론트+백엔드 전체 |
| 개선 항목 도출 | 109 | CRITICAL 12건 |
| 목표 세션 비용 | $0.06 | 현재 $0.18 → 67%↓ |
| session/page.js | 1,451→150줄 | 90% 코드 감소 |
| 연령별 UI 밀도 | 3 Tier | 6-8 / 9-11 / 12-13 |
| ZPD 성장 프로필 | 7차원 | 실시간 적응 학습 |
| 통합 구현 로드맵 | 12주 | 단계적 비파괴 전환 |

### CRITICAL: 고도화 전 반드시 해결할 5가지

| # | 에이전시 | 문제 | 영향 | 해결책 | 상태 |
|---|---------|------|------|--------|------|
| 1 | 아키텍처 | **session/page.js 1,451줄 + 36개 useState** | 신규 기능 추가 시 유지보수 불가능 | SessionProvider + StageRenderer + PluginSlot 5분할 | ✅ **완료** (Sprint 4: 6모듈 분리) |
| 2 | 접근성 | **인지 과부하: books 페이지 300+ 인터랙션** | 6-8세 아동 이탈 위험 | FEATURE_GATES 연령별 3/5/6 항목 제한 | ✅ **완료** (Sprint 4: NavBar 통합) |
| 3 | 디자인 | **색상 토큰 3파일 분산 + 12px 폰트 위반** | 일관성 없는 UX, 저연령 가독성 문제 | tailwind.config.js 단일 소스 + 14px 최소값 | ✅ **완료** (Sprint 1) |
| 4 | 학습엔진 | **AI 비용 $0.073/세션 (실측)** | B2B 확장 시 추가 최적화 가능 | TaskAdapter 모델 라우팅 + Phi-3 (→$0.06) | ⚠️ **진행중** (Sprint 5: Sonnet/Haiku 라우팅 완료) |
| 5 | QA | **유닛 테스트 0%, E2E만 12건** | 리팩토링 시 회귀 버그 위험 | 60% 유닛 + 25% 통합 + 15% E2E 피라미드 | ⚠️ **진행중** (228 유닛 테스트 구축) |

### 현재 잘 되어 있는 부분 (유지/강화)

- 🎙️ **음성 우선 설계:** 80-96px 마이크 버튼, 터치 타겟 48px+ ✅
- 🌿 **지브리 감성 컬러:** 포레스트 그린 + 골드, 아동 심리학적 적합 ✅
- 📚 **소크라테스식 교수법:** 질문 유도형 학습, 리서치 검증 완료 ✅
- 🏆 **게이미피케이션:** 스트릭, 배지, 축하 애니메이션 ✅
- 🤖 **스마트 모델 라우팅:** HAIKU/SONNET 자동 선택, 프롬프트 캐싱 ✅
- 📱 **연령별 블룸 단계:** 초급 4단계, 중급 5, 고급 6 ✅

### 6개 에이전시 분석 요약

| 에이전시 | 분석 범위 | 파일수 | CRITICAL | HIGH | MEDIUM | 핵심 산출물 |
|---------|----------|--------|----------|------|--------|-----------|
| 🏗️ 아키텍처 | 컴포넌트 분해, 플러그인 시스템, 상태 관리 | 7 | 2 | 4 | 6 | ADR v1.0 (109KB, 3문서) |
| 🎨 디자인 시스템 | 토큰, 타이포그래피, 네비게이션, 아바타 | 13 | 2 | 5 | 8 | 디자인 시스템 리포트 |
| ♿ 접근성 | WCAG 2.1 AA, 아동 특화, 스크린리더 | 10 | 3 | 6 | 9 | 접근성 감사 리포트 |
| 🧠 학습엔진 | ZPD, 모델라우팅, 프롬프트 v3, 딥러닝 | 12 | 1 | 3 | 5 | 엔진 v3.0 설계서 |
| 📋 PRD | 9개 하이브리드 기능 명세 | 9 | 0 | 2 | 4 | PRD v2.0 |
| 🧪 QA | 테스트 피라미드, AI 품질, CI/CD | 8 | 4 | 3 | 5 | 테스팅 전략서 |

---

## 2. 아키텍처

> session/page.js 1,451줄 모놀리스를 5개 모듈로 분해하고, 플러그인 시스템으로 무제한 기능 확장 지원

### 2.1 현재 문제: 모놀리스 아키텍처

**session/page.js (1,451줄)** — 36개 useState가 하나의 컴포넌트에 혼재

```javascript
// 36개 useState가 하나의 컴포넌트에 혼재
const [messages, setMessages] = useState([]);
const [stage, setStage] = useState(0);
const [turn, setTurn] = useState(0);
const [loading, setLoading] = useState(false);
const [vocabCard, setVocabCard] = useState(null);
// ... 31개 더 ...
// UI 렌더링, 음성 처리, API 호출, 단어 추출,
// 성취 표시, 축하 효과 모두 하나의 파일에!
```

| 영향 범위 | 심각도 | 설명 |
|-----------|--------|------|
| 신규 기능 추가 | CRITICAL | 코어 로직 직접 수정 필요 |
| 버그 수정 | HIGH | 사이드 이펙트 불확실 |
| 테스트 | CRITICAL | 개별 기능 격리 테스트 안됨 |
| 팀 협업 | HIGH | 머지 컨플릭트 빈번 |
| 성능 | MEDIUM | 불필요한 리렌더링 |

### 2.2 해결: 5-Module Decomposition + Plugin Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SessionPage (150줄)                       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              SessionProvider (Context)                   ││
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌───────────┐ ││
│  │  │  Stage   │ │  Voice   │ │  Vocab    │ │ Achieve   │ ││
│  │  │ Renderer │ │  Panel   │ │  Sidebar  │ │ Overlay   │ ││
│  │  └──────────┘ └──────────┘ └───────────┘ └───────────┘ ││
│  │                                                         ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │              🔌 PluginSlot (동적)                    │││
│  │  │  ┌─────────┐ ┌──────────┐ ┌───────────┐            │││
│  │  │  │ Debate  │ │  Story   │ │ PreRead   │  (Lazy)    │││
│  │  │  │ Module  │ │  Studio  │ │ Module    │            │││
│  │  │  └─────────┘ └──────────┘ └───────────┘            │││
│  │  └─────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 2.3 FEATURE_GATES: 연령별 기능 차등 해제

```javascript
export const FEATURE_GATES = {
  beginner: {     // 6-8세
    nav: ['books', 'vocabulary', 'profile'],  // 3개만
    prereading: 'word_preview_only',
    debate: false,                // 비활성화
    storyStudio: 'voice_story_only',
    socialReading: 'reactions_only',
    itemsPerScreen: 3,
    fontSize: 18,
    touchTarget: 64,
  },
  intermediate: {  // 9-11세
    nav: ['books', 'vocabulary', 'debate', 'storyStudio', 'more'],
    prereading: 'full',
    debate: 'simple',             // 2라운드
    storyStudio: 'guided',
    socialReading: 'reactions_and_clubs',
    itemsPerScreen: 5,
    fontSize: 16,
    touchTarget: 52,
  },
  advanced: {      // 12-13세
    nav: ['books', 'vocabulary', 'debate', 'storyStudio', 'bookclub', 'more'],
    prereading: 'full',
    debate: 'full',
    storyStudio: 'full',
    socialReading: 'full',
    itemsPerScreen: 6,
    fontSize: 14,
    touchTarget: 48,
  }
};
```

### 2.4 상태 관리 마이그레이션 경로

**현재: 36 useState** → **Phase 1: SessionContext + useReducer** → **Phase 2: Zustand (선택)**

> 핵심: 각 단계는 비파괴적(non-breaking)이며, 기존 테스트가 100% 통과하는 상태에서만 다음 단계로 진행.

### 2.5 백엔드: TaskAdapter + ModelStrategy 패턴

```
TaskAdapter (abstract)
├── SessionResponseAdapter   [현재]
├── DebateFacilitationAdapter [신규]
├── StoryGenerationAdapter   [신규]
└── AdaptiveAnalysisAdapter  [신규]

ModelStrategy (abstract)
├── AnthropicStrategy  [Claude API]
├── LocalModelStrategy [Phi-3, Mistral]
└── HybridStrategy     [비용 최적화]
```

- 새 AI 작업 = Adapter 추가 (코어 수정 없음)
- 새 모델 = Strategy 추가 (라우터 수정 없음)

### 2.6 관련 문서

- 상세 ADR: `ARCHITECTURE_DECISION_RECORD_v1.md` (58KB)
- 요약본: `ADR_EXECUTIVE_SUMMARY.md` (10KB)
- 구현 예제: `ADR_IMPLEMENTATION_EXAMPLES.md` (41KB)

---

## 3. 디자인 시스템

> 지브리 감성 유지 + 연령별 3단계 시각 밀도 + 통합 토큰 시스템

### 3.1 토큰 시스템: 3파일 분산 → 1파일 통합

| 토큰 유형 | globals.css | tailwind.config.js | constants.js | 상태 |
|-----------|-------------|-------------------|-------------|------|
| Primary 색상 | #5C8B5C ✅ | #5C8B5C ✅ | ~~#4A90D9~~ → **#5C8B5C ✅** | ✅ 수정 완료 |
| Background | #F5F0E8 ✅ | #F5F0E8 ✅ | ~~#F5F7FA~~ → **#F5F0E8 ✅** | ✅ 수정 완료 |
| Text Light | #9C8B74 | #9B8777 | ~~#7F8C8D~~ → **#9C8B74 ✅** | ✅ 수정 완료 |
| Shadow | 정의됨 | 정의됨 | 미정의 | 🔲 미정 |

**✅ Sprint 1에서 해결:** constants.js 17개 색상 토큰을 Ghibli 팔레트로 통일. (primary→#5C8B5C, accent→#D4A843, danger→#D4736B, text→#3D2E1E 등)
**추가 수정:** globals.css의 무효 `min-font-size` 속성 → `font-size: max(0.875rem, 1em)` 유효 CSS로 교체.

### 3.2 연령별 3-Tier 시각 밀도

#### Beginner (6-8세)
```
┌─────────────────────┐
│   📚     ⭐     👤  │
│  Books  Words   Me  │
│  (64px 버튼 3개)     │
└─────────────────────┘
```
- 아이콘 3개만, 64px 터치, 18px 폰트, 화면당 3항목, 음성 100%

#### Intermediate (9-11세)
```
┌─────────────────────┐
│ 📚 ⭐ 🤔 ✍️ 📖 [⋯] │
│ Books Studio ...More│
│  (52px 버튼 5+1)     │
└─────────────────────┘
```
- 5개 + More, 52px 터치, 16px 폰트, 화면당 5항목, 음성+텍스트

#### Advanced (12-13세)
```
┌─────────────────────┐
│📚⭐🤔✍️👥📖⚙️Help  │
│ Full nav, text-first│
│  (48px, 8개 노출)    │
└─────────────────────┘
```
- 전체 노출, 48px 터치, 14px 폰트, 화면당 6+, 텍스트 우선

### 3.3 HiAlice 아바타 시스템

| 표현 | 용도 | 사이즈 |
|------|------|--------|
| 😊 Listening | 학생 응답 대기 중 | 32px (채팅 버블) |
| 🤔 Thinking | AI 응답 생성 중 | 40-48px (로딩) |
| 😃 Encouraging | 칭찬/격려 시 | 48px (단어 카드) |
| 🎉 Celebrating | 성취 달성 시 | 64px (팝업) |
| 🤗 Welcoming | 빈 화면, 온보딩 | 128-256px (히어로) |

**디자인 가이드:** 지브리 감성, 성중립, 포레스트 그린(#5C8B5C), 토토로 스타일 눈, SVG 기반 48-256px 스케일링

### 3.4 다크 모드 팔레트

| 토큰 | 라이트 | 다크 | 대비율 |
|------|--------|------|--------|
| 배경 | #F5F0E8 | #1A1410 | 17.2:1 ✅ |
| 카드 | #FFFCF3 | #2B251C | 19.4:1 ✅ |
| Primary | #5C8B5C | #7AAE7A | 4.5:1 ✅ |
| 텍스트 | #3D2E1E | #F5F0E8 | 17.2:1 ✅ |

### 3.5 난독증 모드

- Open Dyslexic 폰트 전환 토글
- letter-spacing: 0.05em 증가
- line-height: 1.6 → 2.0
- 이탤릭 → 굵기+색상 대체
- word-spacing: 0.1em 증가
- 전체 아동의 약 12-13%가 혜택

### 3.6 관련 문서

- 상세 감사: `DESIGN_AUDIT.md` (49KB)
- 시각 개선안: `DESIGN_IMPROVEMENTS_VISUAL.md` (22KB)

---

## 4. 접근성

> WCAG 2.1 AA 11항목 + 아동 특화 6항목 심층 분석

### 4.1 WCAG 2.1 AA 준수 현황

| 기준 | 항목 | 현재 상태 | 심각도 | 해결 방안 | 진행 |
|------|------|----------|--------|----------|------|
| 1.1.1 | 비텍스트 콘텐츠 | ~~이모지 alt 텍스트 누락~~ | CRITICAL | role="img" aria-label 추가 | ✅ **Sprint 1 완료** (41개 이모지 수정) |
| 1.3.1 | 정보와 관계 | 시맨틱 HTML 부분 적용 | HIGH | section/article/heading 구조화 | 🔲 |
| 1.4.3 | 대비 (최소) | 골드 악센트 3.8:1 (부족) | HIGH | #C99A2E로 조정 (4.5:1+) | 🔲 |
| 1.4.4 | 텍스트 크기 조절 | ~~200% 확대 시 레이아웃 깨짐~~ | MEDIUM | rem/em 단위 전환, overflow 처리 | ⚠️ 부분 (globals.css max() 적용) |
| 2.1.1 | 키보드 | 대부분 접근 가능, 모달 트랩 위험 | MEDIUM | 포커스 트랩 + ESC 닫기 구현 | 🔲 |
| 2.4.1 | 블록 건너뛰기 | Skip to content 링크 존재 | OK | 유지 | ✅ |
| 2.4.7 | 포커스 표시 | 포커스 링 구현됨 | OK | 유지 | ✅ |
| 2.5.5 | 터치 타겟 크기 | 48px+ 대부분, dismiss 28px | HIGH | VocabMiniCard dismiss 48px로 확대 | 🔲 |
| 3.1.1 | 페이지 언어 | lang="en" 설정됨 | OK | 유지 | ✅ |
| 4.1.2 | 이름, 역할, 값 | ~~커스텀 컴포넌트 ARIA 부분 누락~~ | HIGH | VoiceButton, 프로그레스바 ARIA 추가 | ⚠️ 부분 (아바타 role="img" 추가) |

### 4.2 아동 특화 접근성

| 범주 | 준수율 | 주요 이슈 |
|------|--------|----------|
| 🖐️ 운동 능력 (6-8세) | 82% | VocabMiniCard dismiss 28px→48px, chips 36-40px→48px |
| 📖 읽기 수준 | 74% | StageProgress 9-10px ❌, VocabMiniCard 11px ❌, ThoughtGarden 12px ⚠️ |
| 🧠 인지 과부하 | 45% | books 페이지 300+ 인터랙션 ❌, 6-8세 권장 화면당 3개 |
| ⏰ 주의력 지원 | 90% | 세션 타임아웃 15분 ✅, 남은 시간 시각 표시 추가 필요 |

---

## 5. 학습 엔진

> ZPD 기반 7차원 성장 엔진 + 멀티모델 라우팅 + 딥러닝 파이프라인

### 5.1 7차원 ZPD 성장 프로필

| 차원 | 설명 | 측정 방법 |
|------|------|----------|
| 📝 Vocabulary Breadth | 어휘 폭 | 세션 내 고유 단어 수, 난이도별 분류 |
| 📐 Grammar Accuracy | 문법 정확도 | 문법 오류 비율, 구조 복잡도 |
| 🔍 Comprehension | 이해 깊이 | 답변의 책 내용 참조 정확도 |
| 💡 Critical Thinking | 비판적 사고 | Bloom's 분류 수준 (분석/평가/창조) |
| ✨ Creative Expression | 창의적 표현 | 독창적 해석, 비유 사용 |
| 🗣️ Fluency | 유창성 | 응답 속도, 망설임 빈도 |
| 💪 Confidence | 자신감 | 자발적 발화량, 응답 길이 추세 |

각 차원은 Bloom's Taxonomy 6단계(기억→이해→적용→분석→평가→창조)와 매핑. 학생별 레이더 차트 시각화.

### 5.2 비용 최적화: 멀티모델 라우팅

| 모델 | 비용 (1M 토큰) | 용도 | 현재 비율 | 목표 비율 |
|------|--------------|------|----------|----------|
| **Phi-3 Mini (파인튜닝)** | $0.10 | Beginner 응답, 간단 피드백 | 0% | 35% |
| **Haiku 4.5** | $0.80 | 리프레이즈, 문법체크, 피드백 | 25% | 30% |
| **Mistral 7B (파인튜닝)** | $0.20 | Intermediate 패턴 응답 | 0% | 15% |
| **Sonnet 4** | $3.00 | 복잡한 대화, 메타인지 | 75% | 20% |

### 5.3 비용 시뮬레이션

| 단계 | 세션당 비용 | 절감률 |
|------|-----------|--------|
| 현재 | $0.18 | — |
| Phase 1 (Haiku 확대) | $0.12 | 33% |
| Phase 2 (Phi-3 도입) | $0.08 | 56% |
| Phase 3 (풀 최적화) | $0.06 | 67% |

### 5.4 월별 비용 예측 (10K MAU 기준)

| 시나리오 | 세션/월 | 월 비용 | 연 비용 |
|---------|---------|---------|---------|
| 현재 | 50,000 | **$9,000** | $108,000 |
| Phase 1 | 50,000 | $6,000 | $72,000 |
| Phase 3 | 50,000 | **$3,000** | $36,000 |

### 5.5 딥러닝 파이프라인 로드맵

| Phase | 기간 | 목표 | 데이터 요구량 | 예상 효과 |
|-------|------|------|-------------|----------|
| 1 | 1-3개월 | Claude 세션 로그 수집 (학습용) | 10K+ 세션 | 파인튜닝 데이터셋 구축 |
| 2 | 3-5개월 | Phi-3 Mini Beginner 응답 파인튜닝 | 5K+ QA 쌍 | Beginner 비용 90% 절감 |
| 3 | 5-7개월 | 경량 문법 스코링 모델 | 50K+ 문장 | 문법 체크 API 콜 제거 |
| 4 | 7-12개월 | 학생 이탈/참여 예측 | 10K+ 프로필 | 선제적 개입, 이탈률 30%↓ |

---

## 6. 기능 명세

> S-Tier(필수) · A-Tier(권장) · B-Tier(확장) 3단계 우선순위

### 6.1 S-Tier: 핵심 학습 루프 강화 (필수)

| 기능 | 설명 | 사용자 스토리 | 성공 지표 | 공수 |
|------|------|-------------|----------|------|
| **FEATURE_GATES** | 6-8세 3항목, 9-11세 5항목, 12-13세 전체. DB 기반 동적 제어 | 6세 아이가 복잡한 메뉴 없이 바로 책 읽기 시작 | 6-8세 이탈률 40%↓, 완료율 85%+ | L (2주) |
| **T.E.A.A. 교수법** | Think→Explain→Add→Apply 소크라테스식 질문 구조 | 학생이 단계적으로 깊은 생각 표현 | 평균 응답 길이 2.5x↑, 사고 깊이 30%↑ | M (1주) |
| **7차원 성장 프로필** | 7개 차원 독립 추적, 레이더 차트, 자동 난이도 조절 | 부모가 자녀의 영역별 성장 확인 | 학습 지속률 50%↑, NPS 75+ | XL (3주) |

### 6.2 A-Tier: 참여 & 차별화 (권장)

| 기능 | 설명 | 연령 제한 | 성공 지표 | 공수 |
|------|------|----------|----------|------|
| **Pre-Reading 모듈** | 단어 미리보기, 표지 예측, 배경지식 활성화 | 전체 (난이도 차등) | 세션 이해도 25%↑ | M (1주) |
| **Debate Mode** | AI 상대 찬반 토론, 논증 구조화 연습 | 9세+ (FEATURE_GATES) | 비판적 사고 40%↑ | L (2주) |
| **AI Story Studio** | AI 협업 창작, 음성→텍스트, 일러스트 생성 | 8세+ (음성모드) | 창의적 표현 35%↑ | XL (3주) |

### 6.3 B-Tier: 에코시스템 확장 (향후)

| 기능 | 설명 | 수익 모델 | 공수 |
|------|------|----------|------|
| **Social Reading / Book Clubs** | 그룹 리딩, 반응 공유, 리딩 챌린지 | 프리미엄 기능 ($3/월) | L (2주) |
| **Parent Learning Hub** | 학습 인사이트, 추천, 가이드 | 기본 포함 (리텐션↑) | M (1주) |
| **B2B Academy Platform** | 학원용 멀티학생 관리, 반 배정, 리포트 | B2B 구독 ($50-200/학원/월) | XL (4주) |

### 6.4 기능 의존성 그래프

```
          ┌─────────────────┐
          │  FEATURE_GATES  │ ← 모든 기능의 전제조건
          └────────┬────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
    ▼              ▼              ▼
┌────────┐  ┌──────────┐  ┌──────────┐
│ T.E.A.A│  │ 7D Growth│  │Pre-Read  │
└───┬────┘  └────┬─────┘  └──────────┘
    │            │
    ▼            ▼
┌────────┐  ┌──────────┐
│ Debate │  │  Story   │
│ 9세+   │  │  Studio  │
└───┬────┘  └────┬─────┘
    │            │
    ▼            ▼
┌────────────────────┐     ┌──────────┐
│  Social Reading    │     │  Parent  │
└────────────────────┘     │   Hub    │
                           └────┬─────┘
                           ┌────▼─────┐
                           │   B2B    │
                           │ Academy  │
                           └──────────┘
```

---

## 7. 테스팅 전략

> 테스트 피라미드 · AI 품질 평가 · 아동 UX 자동 검증 · CI/CD 통합

### 7.1 현재 vs 목표

| 테스트 유형 | 현재 | 목표 | 진행 |
|------------|------|------|------|
| Unit Tests | **228개 PASS** | 60% 커버리지 | ✅ 프론트 75개 (Sprint 3) + 백엔드 153개 (Sprint 5: aiQualityEval 79개, contentFilter 74개) |
| Integration Tests | 0% | 25% | 🔲 |
| E2E Tests (13 specs) | 100% | 15% | ✅ 유지 |

### 7.2 AI 응답 품질 테스트 프레임워크

| 검증 항목 | 기준 | 자동화 | 현재 상태 |
|-----------|------|--------|----------|
| 소크라테스식 준수 | Alice가 답을 알려주지 않고 질문하는가? | evalHarness.js | ✅ 구현됨 |
| 연령 적합 어휘 | 레벨별 어휘 한도 준수 (1K/2K/3K) | 단어 빈도 분석 | ⚠️ 부분 |
| 콘텐츠 안전성 | 부적절한 내용 필터링 | contentFilter.js | ✅ 구현됨 |
| 응답 지연 SLA | < 3초 (아동 주의력 한계) | 성능 모니터링 | ❌ 미구현 |
| 문법 피드백 정확도 | 오류 감지 정확도 90%+ | 골드 스탠다드 비교 | ❌ 미구현 |
| 감정 적절성 | 학생 감정에 맞는 톤 조절 | 감성 분석 + 수동 리뷰 | ❌ 미구현 |

### 7.3 CI/CD 파이프라인

**Pre-commit:** Lint + Unit → **PR:** Integration + E2E + A11y → **Deploy:** Smoke + Performance → **Weekly:** AI Eval + Full Regression

아동 UX 자동 검증: axe-core 접근성 스캔, 터치타겟 48px+ 검증, 폰트 14px+ 검증, FEATURE_GATES 네비게이션 테스트

---

## 8. 통합 로드맵

> 비파괴적 단계별 전환. 모든 변경은 Feature Flag로 즉시 롤백 가능.

### Week 1-2: Foundation (기반 다지기)

- [ ] [아키텍처] session/page.js → 5 모듈 분해
- [x] [디자인] 토큰 통합 — constants.js 17개 색상 Ghibli 팔레트 통일 ✅ (2026-03-14)
- [x] [QA] Unit test 인프라 구축 — package.json test 스크립트 추가 ✅ (2026-03-14)
- [x] [접근성] 14px 최소 폰트 + 이모지 aria-hidden — globals.css max() + 7파일 41개 이모지 ✅ (2026-03-14)
- [ ] [PRD] FEATURE_GATES 구현
- [ ] [엔진] 데이터 수집 파이프라인 시작
- [x] [보안] abTest.js sessionStorage 직접 접근 → clientStorage 래퍼 마이그레이션 ✅ (2026-03-14)
- [x] [보안] PIN 강도 검증 추가 (연속/반복 숫자 차단) ✅ (2026-03-14)
- [x] [교육] 부모 가정학습 가이드 섹션 추가 (review/page.js) ✅ (2026-03-14)
- [x] [엔진] engine.js evalLogger 버그 수정 + 이중 캐시 호출 제거 ✅ (2026-03-14)

### Week 3-4: Core Enhancement (핵심 강화)

- [x] [아키텍처] SessionContext + useReducer 마이그레이션 ✅ Sprint 4 (6모듈 분리)
- [x] [디자인] 3-Tier 시각 밀도 CSS 구현 ✅ Sprint 4
- [x] [QA] AI 품질 eval 자동화 ✅ Sprint 5 (79 프롬프트 테스트 + 74 필터 테스트)
- [x] [PRD] T.E.A.A. 교수법 프롬프트 통합 ✅ Sprint 4
- [x] [엔진] TaskAdapter 패턴 도입 ✅ Sprint 5 (Sonnet/Haiku 라우팅)
- [x] [접근성] 키보드 내비게이션 + 포커스 트랩 ✅ Sprint 5 (skip-to-content, focus-visible, 다크모드 CSS)

### Week 5-6: Feature Launch (A-Tier 기능)

- [x] [PRD] Pre-Reading 모듈 출시 ✅ Sprint 5 (확인 모달 + ARIA)
- [ ] [PRD] 7차원 성장 프로필 시각화
- [ ] [디자인] HiAlice 아바타 시스템 구현
- [x] [엔진] Haiku 확대 라우팅 ($0.12/세션) ✅ Sprint 5 (TaskAdapter selectModel)
- [ ] [QA] E2E 접근성 스캔 CI 통합
- [x] [접근성] 다크 모드 + 난독증 토글 ✅ Sprint 5 (다크모드 CSS 변수 + .dark-mode 클래스)

### Week 7-8: Engagement (참여 기능)

- [PRD] Debate Mode (9세+) 출시
- [PRD] AI Story Studio 베타
- [아키텍처] Plugin 시스템 안정화
- [엔진] Phi-3 파인튜닝 시작
- [QA] 아동 UX 자동 검증 스위트
- [디자인] 마이크로 인터랙션 라이브러리

### Week 9-10: Ecosystem (에코시스템)

- [PRD] Social Reading / Book Clubs
- [PRD] Parent Learning Hub
- [엔진] Phi-3 모델 A/B 테스트
- [QA] 성능 테스트 (10K 동시 세션)
- [접근성] COPPA 컴플라이언스 최종 감사
- [아키텍처] Zustand 마이그레이션 (선택)

### Week 11-12: Scale & Launch (확장)

- [PRD] B2B Academy Platform 베타
- [엔진] 풀 비용 최적화 ($0.06/세션)
- [QA] 전체 회귀 테스트 + 출시 체크리스트
- [디자인] 디자인 시스템 문서화 완료
- [접근성] WCAG 2.1 AA 100% 달성
- [아키텍처] 모니터링 + 알림 대시보드

### 비파괴적 전환 보장

**변하지 않는 것 (학생 관점):**
- 세션 플로우 (제목→소개→본론→결론)
- 소크라테스식 Q&A 질문
- 음성 입력 + 텍스트 입력
- 단어 학습, 축하 효과, 성취 시스템
- 모든 기존 테스트 100% 통과

**변하는 것 (시스템 내부):**
- 컴포넌트 아키텍처 (모듈화)
- 상태 관리 메커니즘 (Context/Zustand)
- 백엔드 추상화 레이어 (Adapter/Strategy)
- 네비게이션 가시성 (연령별 스마트 노출)
- AI 모델 라우팅 (비용 67% 절감)

**롤백 안전장치:** 모든 변경은 Feature Flag로 제어. 문제 발생 시 플래그 OFF로 즉시 이전 버전 복원.

### 12주 후 예상 성과

| 지표 | 목표 | 설명 |
|------|------|------|
| AI 비용 | 67%↓ | $0.18 → $0.06 |
| 코어 코드량 | 90%↓ | 1,451 → 150줄 |
| WCAG AA | 100% | 접근성 완전 준수 |
| 신규 기능 추가 | 3-5일 | 기존 2-3주→단축 |
| 테스트 커버리지 | 60%+ | 유닛+통합+E2E |
| 세션 완료율 | 85%+ | 아동 이탈 방지 |
| 학습 추적 | 7차원 | ZPD 적응형 |
| 연간 ARR | $500K+ | B2B 포함 |

---

## 관련 문서 인덱스

| 문서 | 설명 | 크기 |
|------|------|------|
| `HiAlice_스킬종합_고도화보고서.html` | 본 문서 인터랙티브 HTML 버전 | ~30KB |
| `HiAlice_종합_에이전시_보고서.html` | 이전 에이전시 분석 (아동UX, FE, BE, 비용, 딥러닝) | ~70KB |
| `HiAlice_하이브리드_시너지_분석.html` | 수정버전×신규버전 56개 조합 시너지 매트릭스 | ~70KB |
| `HiAlice_수정버전_계획서.md` | M-01~M-08 수정 구현 계획 | 26KB |
| `HiAlice_신규버전_계획서.md` | N-01~N-07 신규 기능 계획 | 31KB |
| `ARCHITECTURE_DECISION_RECORD_v1.md` | 전체 아키텍처 결정 기록 | 58KB |
| `ADR_EXECUTIVE_SUMMARY.md` | ADR 경영진 요약 | 10KB |
| `ADR_IMPLEMENTATION_EXAMPLES.md` | ADR 구현 코드 예제 | 41KB |
| `DESIGN_AUDIT.md` | UI/UX 12차원 디자인 감사 | 49KB |
| `DESIGN_IMPROVEMENTS_VISUAL.md` | ASCII 목업 Before/After | 22KB |
| `CLAUDE.md` | 프로젝트 지식 베이스 | — |
| `PROGRESS.md` | 작업 진행 추적 | — |

---

---

## 9. 실행 이력 (Sprint Log)

### Sprint 1+2 (2026-03-14) — 품질 기반 + 교육 UX

**실행 방식:** 시니어 감독관이 10개 전문 에이전트를 3개 그룹으로 병렬 배치, 파일 충돌 0건

| 그룹 | 에이전트 | 작업 | 수정 파일 | 결과 |
|------|---------|------|----------|------|
| A-1 | Frontend Developer | constants.js 17개 색상 토큰 Ghibli 통일 | `constants.js` | ✅ 빌드 통과 |
| A-2 | Frontend Developer | globals.css min-font-size → max() | `globals.css` | ✅ 빌드 통과 |
| A-3 | Build Engineer | package.json test 스크립트 추가 | `backend/package.json`, `frontend/package.json` | ✅ |
| B-1 | Frontend Developer | 7파일 41개 이모지 접근성 수정 | `NavBar.js`, `books/page.js`, `vocabulary/page.js`, `session/page.js`, `profile/page.js` | ✅ 빌드 통과 |
| B-2 | Refactoring Specialist | abTest.js clientStorage 마이그레이션 | `abTest.js` | ✅ 빌드 통과 |
| C-1 | Backend Developer | PIN 강도 검증 (isWeakPin) | `auth.js` | ✅ |
| C-2 | Frontend Developer | 부모 가정학습 가이드 | `review/page.js` | ✅ 빌드 통과 |

**발견 사항:**
- 자녀 등록 플로우 (Task #51) — **이미 완전 구현됨** (parent/page.js addChild)
- PIN 인증 (Task #52) — **이미 완전 구현됨** (login/page.js PIN + JWT)
- 아이 친화적 단계명 (Task #54) — **이미 완전 구현됨** (getAgeAdaptedStages)
- 연령 적응형 세션 (Task #55) — **이미 완전 구현됨** (Bloom's Taxonomy 4/5/6단계)

**빌드 검증:** `npx next build` 23페이지 전체 컴파일 성공
**커밋:** `9761da1` → GitHub push 완료

### 변경 통계

| 항목 | 값 |
|------|-----|
| 수정 파일 | 13개 |
| 추가 줄 | +147 |
| 삭제 줄 | -59 |
| 에이전트 투입 | 10개 (Frontend ×4, Backend ×1, Build ×1, Refactoring ×1, Explorer ×3) |
| 파일 충돌 | 0건 |
| 빌드 실패 | 0건 |

---

### Sprint 3 (2026-03-14) — 테스트 · PDF · 안전 로그

**실행 방식:** 3개 전문 에이전트 병렬 배치, 파일 충돌 0건

| 그룹 | 에이전트 | 작업 | 수정 파일 | 결과 |
|------|---------|------|----------|------|
| A | Test Automator | Vitest 프레임워크 + 75개 테스트 | `vitest.config.js`, `setup.js`, 3개 .test.js, `package.json` | ✅ 75 PASS (679ms) |
| B | Frontend Developer | PDF 다운로드 UX 개선 | `parent/page.js` | ✅ 빌드 통과 |
| C | Backend Developer | 안전 로그 JSONL 영속화 | `contentFilter.js`, `.gitignore` | ✅ |

**발견 사항:**
- 게이미피케이션 (XP + 배지 + 스토리 해금) — **이미 완전 구현됨** (profile/page.js)
- httpOnly 쿠키 인증 — **이미 완전 구현됨** (auth.js + api.js 이중 보안)
- AI 안전 모니터링 (contentFilter.js) — **이미 95% 구현됨** (인메모리만 남음 → 해결)

**빌드 검증:** Vitest 75 PASS + Next.js 23페이지 컴파일 성공
**커밋:** `5754cf1` → GitHub push 완료

### Sprint 4 (2026-03-14) — 아키텍처 · 교수법 · 시각 밀도

**실행 방식:** 4개 전문 에이전트 병렬 배치, 파일 충돌 0건

| 그룹 | 에이전트 | 작업 | 수정 파일 | 결과 |
|------|---------|------|----------|------|
| A | Frontend Developer | FEATURE_GATES + NavBar 통합 | `featureGates.js`, `NavBar.js` | ✅ 연령별 메뉴 필터링 |
| B | Backend Developer | T.E.A.A. 교수법 프롬프트 | `prompts.js` (+207줄) | ✅ Think→Explain→Add→Apply |
| C | Frontend Developer | 3-Tier 시각 밀도 CSS | `globals.css` (+125줄) | ✅ beginner/intermediate/advanced |
| D | Refactoring Specialist | session/page.js 모듈 분리 | `page.js` + 5개 신규 모듈 | ✅ 1,451→269줄 (82%↓) |

**빌드 검증:** Vitest 75 PASS + Next.js 23페이지 컴파일 성공
**커밋:** `f465994` → GitHub push 완료

### Sprint 5 (2026-03-14) — 모델 라우팅 · Pre-Reading · 접근성 · 테스트

**실행 방식:** 4개 전문 에이전트 병렬 배치, 파일 충돌 0건

| 그룹 | 에이전트 | 작업 | 수정 파일 | 결과 |
|------|---------|------|----------|------|
| A | Backend Developer | TaskAdapter 모델 라우팅 | `engine.js` | ✅ Sonnet/Haiku 스마트 선택 |
| B | Frontend Developer | 키보드 내비 + 다크모드 CSS | `globals.css`, `layout.js` | ✅ skip-to-content + 다크모드 변수 |
| C | React Specialist | Pre-Reading 확인 모달 | `books/page.js` | ✅ ARIA dialog + Escape 닫기 |
| D | Test Automator | AI 품질 eval + 콘텐츠 필터 테스트 | `aiQualityEval.test.js`, `contentFilter.test.js` | ✅ 153 PASS |

**테스트 검증:** 프론트 75 + 백엔드 153 = **228 테스트 ALL PASS**
**빌드 검증:** Next.js 23페이지 컴파일 성공
**커밋:** `abd87a5` → GitHub push 완료

### 누적 변경 통계 (Sprint 1~5)

| 항목 | Sprint 1+2 | Sprint 3 | Sprint 4 | Sprint 5 | 누적 |
|------|-----------|----------|----------|----------|------|
| 수정 파일 | 13개 | 10개 | 10개 | 9개 | **42개** |
| 추가 줄 | +147 | +3,095 | +2,006 | +3,418 | **+8,666** |
| 삭제 줄 | -59 | -144 | -1,289 | -29 | **-1,521** |
| 에이전트 투입 | 10개 | 3개 | 4개 | 4개 | **21개** |
| 파일 충돌 | 0건 | 0건 | 0건 | 0건 | **0건** |
| 빌드 실패 | 0건 | 0건 | 0건 | 0건 | **0건** |
| 유닛 테스트 | 0개 | 75개 | 0개 | +153개 | **228개 PASS** |

---

*— HiAlice 스킬 종합 고도화 보고서 v1.3 | 2026.03.14 —*
