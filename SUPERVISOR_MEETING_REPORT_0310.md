# 🏛️ 슈퍼바이저 통합 미팅 보고서

## HiAlice 에이전트 전체 회의 결과 | 2026-03-10

---

## 핵심 합의 사항: 7개 에이전트 공통 결론

### 1. "결과가 아닌 사고 과정을 추적하라"

| 에이전트 | 제안 |
|---------|------|
| ⚙️ Backend | `dialogue_cognitive_tags` — Bloom's 레벨 자동 태깅 |
| 🤖 AI Engine | 실시간 사고 깊이 추적 (Cognitive Depth Tracker) |
| 🧪 QA | 답변 깊이 점수 (because/however/I think 기반) |
| 📚 Education | 비가시 평가 6개 지표 (퀴즈 없이 PIRLS 측정) |

### 2. "책과 책을 연결하라"

| 에이전트 | 제안 |
|---------|------|
| ⚙️ Backend | `vocabulary_cross_session_usage` 테이블 |
| 🤖 AI Engine | Cross-Book Memory (이전 책 키워드를 프롬프트에 주입) |
| 📱 UX/Child | Thought Garden (생각이 자라는 정원) |
| 📚 Education | Cross-Book Synapse (간격반복 + IB PYP 횡단 학습) |

### 3. "아이를 응답자가 아닌 질문자로 전환하라"

| 에이전트 | 제안 |
|---------|------|
| 🎨 Frontend | "나도 질문할게" 버튼 + "질문 만들기" 역할 반전 모드 |
| 🤖 AI Engine | 메타인지 자기 점검 루틴 (세션 마지막 2질문) |
| 📚 Education | Prediction Portfolio (예측-검증 메타인지 트래킹) |

---

## 에이전트별 핵심 보고 요약

### ⚙️ Backend Agent
- **핵심**: Bloom's Taxonomy 태깅 테이블 + 사고 패턴 집계 뷰 신설
- **혁신**: "사고 모멘텀 점수" — 세션 내 답변이 점점 깊어지는 상승 추세 수치화
- **즉시 해결**: sessionStorage → DB 영속화 (API 이미 완성, 프론트 연결만 필요)
- **리스크**: 세션 완료 시 Claude 동기 호출 → 비동기 분리 필수

### 🎨 Frontend Agent
- **핵심**: 레벨별 사고 유도 UI 차별화 (6-8세: 감각, 9-11세: 구조, 12-13세: 비판)
- **혁신**: "생각의 메아리" — 자기 음성 응답 타임라인 리플레이 (메타인지 훈련)
- **즉시 해결**: 색상 대비 WCAG 미충족, 책 카드 `<div onClick>` → `<button>` 교체
- **학부모**: "오늘 우리 아이가 한 말" 카드 — 점수가 아닌 사고의 순간 공유

### 🤖 AI Engine Agent
- **핵심**: 4단계 → 6단계 세션 진화 (Warm Connection ~ Cross-Book Connection)
- **혁신**: 부분 정답 인정 프롬프트 — Khanmigo 최대 약점 즉시 해결 (4h)
- **즉시 해결**: `classifyAnswerDepth()` 함수로 surface/analytical/deep 3단계 분류
- **정답 없는 질문**: "이 책이 날씨라면 어떤 날씨일까?" — 채점 불안 없는 창의 사고

### 🔒 Security Agent
- **핵심**: 콘텐츠 필터 문맥 인식 전환 ("die" = 독서 토론 허용, 폭력 의도만 차단)
- **혁신**: "Confidence Vault" — 서버 저장 안 하는 비공개 사고 공간
- **COPPA**: 검증 가능 부모 동의(VPC) 미구현 → Stripe $0.50 소액 인증 제안
- **즉시 해결**: JWT → httpOnly 쿠키, 대화 원문 90일 후 자동 삭제

### 📱 UX/Child Agent
- **핵심**: "원터치 사고 흐름" — 앱 열면 마이크+Alice 얼굴 하나만, 탭 즉시 시작
- **혁신**: "침묵을 읽는 AI" — 3초 침묵을 오류가 아닌 사고의 증거로 해석
- **Thought Garden**: 뱃지 대신 아이의 생각이 씨앗→새싹→나무→열매로 성장
- **결론**: "다른 앱은 아이가 앱을 잘 사용하도록 설계. HiAlice는 앱 밖에서도 생각하도록 설계"

### 🧪 QA Agent
- **핵심**: AI 질문 품질 A/B 테스트 + 이탈 지점 디버깅
- **혁신**: 골든셋 기반 Bloom's 회귀 테스트 (프롬프트 변경 시 품질 저하 탐지)
- **즉시 해결**: E2E 테스트 0개 → Playwright 5개 핵심 시나리오 우선 구축
- **KPI 정의**: 세션 완주율 70%+, 답변 깊이 30%+, 재방문율 60%+

### 📚 Education Research Agent
- **핵심**: "Reading becomes Thinking" 파이프라인 — 읽기를 사고력 입력 재료로
- **혁신**: Prediction Portfolio — 예측 누적 추적으로 메타인지 자기 이해 개발
- **교육학 USP**: 소크라테스+SEL 통합 = 경쟁사 어디에도 없는 조합
- **다독 vs 정독**: ZPD 기반 세션 강도 조절로 동시 구현

---

## 통합 실행 우선순위

### 🔴 즉시 착수 (1주)

| # | 작업 | 담당 | 시간 | 근거 |
|---|------|------|------|------|
| 1 | 부분 정답 인정 프롬프트 추가 | 🤖 AI | 4h | Khanmigo 즉시 차별화 |
| 2 | sessionStorage → DB 영속화 | 🎨 FE | 4h | API 완성됨, 연결만 |
| 3 | Bloom's 태깅 DB 스키마 추가 | ⚙️ BE | 8h | 모든 분석의 기반 |
| 4 | 답변 깊이 분류기 구현 | 🤖 AI | 8h | surface/analytical/deep |

### 🟡 2주 내

| # | 작업 | 담당 | 시간 |
|---|------|------|------|
| 5 | 6단계 세션 구조 확장 | 🤖 AI + ⚙️ BE | 16h |
| 6 | 메타인지 클로징 질문 2개 | 🤖 AI | 4h |
| 7 | 콘텐츠 필터 문맥 인식 전환 | 🔒 Security | 6h |
| 8 | E2E 테스트 5개 시나리오 | 🧪 QA | 10h |
| 9 | Cross-Book Memory 프롬프트 | 🤖 AI + ⚙️ BE | 12h |

### 🟢 4주 내

| # | 작업 | 담당 | 시간 |
|---|------|------|------|
| 10 | Thought Garden UI | 🎨 FE + 📱 UX | 12h |
| 11 | 학부모 "오늘 아이가 한 말" 카드 | 🎨 FE + ⚙️ BE | 10h |
| 12 | 침묵 감지 + 질문 재구성 | 🤖 AI + 🎨 FE | 8h |
| 13 | COPPA VPC (Stripe 소액 인증) | 🔒 Security | 8h |
| 14 | JWT → httpOnly 쿠키 전환 | 🔒 Security | 6h |
| 15 | Prediction Portfolio | 🤖 AI + ⚙️ BE | 6h |

---

## 목표 점수 로드맵

```
현재 5.8/10
    │
    ├─ 즉시 착수 (1주): 부분정답 + DB영속 + Bloom's ──▶ 6.5
    │
    ├─ 2주 내: 6단계 세션 + 메타인지 + 필터 개선 ────▶ 7.5
    │
    ├─ 4주 내: Thought Garden + 학부모 카드 + COPPA ─▶ 8.5
    │
    └─ 6주: 전체 통합 + E2E + 성능 최적화 ──────────▶ 9.2+ ✅
```

---

*— HiAlice Senior Supervisor Meeting Report v1.0 | 2026-03-10 —*
