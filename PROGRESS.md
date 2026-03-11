# PROGRESS.md — HiAlice 프로젝트 진행 현황

> **Single Source of Truth** — 모든 태스크의 통합 체크리스트
> 마지막 업데이트: 2026-03-11

---

## Quick Stats

| 항목 | 수 |
|------|-----|
| **전체** | 56 |
| **완료** | 13 |
| **미완료** | 43 |
| **현재 점수** | 5.8/10 |
| **목표 점수** | 9.2/10 |

---

## Phase 1: Foundation — "데이터 실체화" (Week 1~2)

> Target: 5.8 → 6.8/10 | Mock → Real 전환, DB 스키마 확장, 핵심 API 완성

- [ ] `P1-BE-01` DB 스키마 마이그레이션 (session_stage_scores, vocabulary_practice_log, achievements, student_goals)
- [ ] `P1-BE-02` 세션 결과 Backend 영구 저장 + 단계별 점수
- [ ] `P1-BE-03` 학생별 세션 이력/통계 API
- [ ] `P1-BE-04` 단어 복습 API (간격반복 + practice_log)
- [ ] `P1-FE-01` review/page.js 실제 API 연동
- [ ] `P1-FE-02` vocabulary/page.js 실제 API 연동
- [ ] `P1-FE-03` profile/page.js 실제 API 연동
- [ ] `P1-BE-05` 로그아웃 + 토큰 갱신 API

---

## Phase 2: AI Enhancement — "책 맥락 기반 질문" (Week 2~3)

> Target: 6.8 → 7.5/10 | AI 프롬프트 고도화, 책 맥락 기반 감정 유도 질문

- [ ] `P2-BE-01` 책 데이터에 줄거리/키워드 필드 추가
- [ ] `P2-AI-01` prompts.js 개선: 책 줄거리 기반 감정 유도 질문
- [ ] `P2-AI-02` Body 단계 3가지 이유별 맞춤 질문 (감정/창의/교훈)
- [ ] `P2-AI-03` 레벨별 질문 난이도 자동 조절 강화
- [ ] `P2-AI-04` 짧은 답변(1단어) 감지 → 후속 질문 자동 생성
- [ ] `P2-AI-05` 세션 피드백 AI 자동 생성

---

## Phase 3: Child UX — "5분 안에 익숙해지는 경험" (Week 3~4)

> Target: 7.5 → 8.2/10 | 아이 친화적 UX, 게이미피케이션, 세션 관리

- [ ] `P3-UX-01` 레벨별 UI 분기 (Beginner: 음성 100%, Advanced: 타이핑 우선)
- [ ] `P3-UX-02` 축하 애니메이션 (confetti + bounce) 세션 완료 시
- [ ] `P3-UX-03` 뱃지/업적 언락 UI + Backend
- [ ] `P3-UX-04` 세션 일시정지/재개 ("Save & Exit")
- [ ] `P3-UX-05` 워크시트 인쇄 기능 (PDF 생성)
- [ ] `P3-UX-06` 책 추천 카드 ("What to Read Next")
- [ ] `P3-UX-07` 세션 타이머 + 타임아웃 경고

---

## Phase 4: Admin & Parent — "관리자 데이터베이스화" (Week 4~5)

> Target: 8.2 → 8.8/10 | 관리자 CRUD, 부모 대시보드, 리포트 시스템

- [ ] `P4-AD-01` 관리자 인증 + RBAC (admin/parent/student 역할)
- [ ] `P4-AD-02` 관리자 학생 CRUD UI 구현
- [ ] `P4-AD-03` 관리자 책 CRUD UI 구현
- [ ] `P4-AD-04` 학생별 성장 리포트 API + UI
- [ ] `P4-AD-05` 부모 대시보드 (자녀 진행 현황)
- [ ] `P4-AD-06` 이메일 알림 시스템 (세션 완료 리포트)
- [ ] `P4-AD-07` 관리자 AI 프롬프트 편집 UI
- [ ] `P4-AD-08` CSV 내보내기/가져오기

---

## Phase 5: Security & Polish — "프로덕션 준비" (Week 5~6)

> Target: 8.8 → 9.2/10 | 보안 강화, 테스트, 성능, 인프라

- [ ] `P5-SE-01` COPPA 부모 동의 플로우 강화 (verifiable consent, privacy policy)
- [ ] `P5-SE-02` JWT → jsonwebtoken 라이브러리 전환 + httpOnly 강화
- [ ] `P5-SE-03` Supabase RLS 정책 강화
- [ ] `P5-SE-04` 입력 검증 + 길이 제한 + 비속어 필터링 (sanitize-html)
- [ ] `P5-SE-05` E2E 테스트 (Playwright) 커버리지 80% 이상
- [ ] `P5-SE-06` 성능 최적화 (이미지 최적화, 번들 사이즈)
- [ ] `P5-SE-07` 에러 추적 (Sentry) 연동
- [ ] `P5-SE-08` CI/CD 파이프라인 구축
- [ ] `P5-SE-09` ElevenLabs TTS 백엔드 프록시로 이동 (API 키 노출 방지)
- [ ] `P5-SE-10` API Rate Limiting (express-rate-limit)
- [ ] `P5-SE-11` 구조화된 로깅 (Winston/Pino)
- [ ] `P5-SE-12` Helmet 보안 헤더 추가
- [ ] `P5-SE-13` API 문서화
- [ ] `P5-SE-14` 모니터링/알림 설정

---

## 9점 달성 기준 (Acceptance Criteria)

1. 모든 페이지가 실제 Backend API와 연동
2. 세션 결과가 영구 저장되고 새로고침해도 유지
3. 학생별 성장 그래프가 실제 데이터 기반
4. AI 질문이 책 내용에 맞춤화되어 감정/사고 유도
5. 부모가 자녀 학습 현황을 실시간 확인 가능
6. 관리자가 학생/책/AI 프롬프트를 완전 관리 가능
7. COPPA 부모 동의 프로세스 구현
8. JWT httpOnly 쿠키 + RBAC 역할 기반 접근 제어
9. E2E 테스트 커버리지 80% 이상
10. 6세 아이가 부모 도움 없이 3번째 세션부터 혼자 진행 가능

---

## Session Log

| 날짜 | 세션 | 작업 내용 | 완료 항목 | 비고 |
|------|------|----------|----------|------|
| 2026-03-10 | Supervisor Sprint | 13개 우선순위 항목 구현 | SM-01~SM-13 | 점수 5.8→7.6 (에이전트 기준) |
| 2026-03-11 | Continuity Setup | 작업 연속성 시스템 구축 | — | PROGRESS.md 생성 |

---

## Completed (13 items — Supervisor Meeting 0310)

- [x] `SM-01` Depth-aware scaffolding prompt — `classifyAnswerDepth()` → `getDepthScaffoldingPrompt()` | `engine.js`, `prompts.js`
- [x] `SM-02` sessionStorage → DB persistence — Token key fix, startSession API | `page.js`, `books/page.js`, `session/page.js`
- [x] `SM-03` Bloom's Taxonomy tagging — `tagCognitiveData()` + real-time bloom_level | `sessions.js`
- [x] `SM-04` 6-stage session — warm_connection→title→introduction→body→conclusion→cross_book | `session/page.js`, `sessions.js`
- [x] `SM-05` Metacognitive closing — `getMetacognitiveResponse()` + `getMetacognitivePrompt()` | `engine.js`, `prompts.js`
- [x] `SM-06` Content filter — ALWAYS_BLOCKED + CONTEXT_SENSITIVE pattern matching | `sanitize.js`
- [x] `SM-07` E2E tests — 5 spec files (login, book-selection, session-flow, session-complete, vocabulary) | `frontend/e2e/`
- [x] `SM-08` Cross-Book Memory — `getCrossBookContext()` fetches last 3 sessions | `crossBookMemory.js`, `engine.js`
- [x] `SM-09` Thought Garden — seed→sprout→tree→fruit visualization | `ThoughtGarden.js`
- [x] `SM-10` Parent dashboard — Full analytics, session history, notifications | `parent/page.js`
- [x] `SM-11` Silence detection — `silenceTimerRef` + `rephraseQuestion()` | `session/page.js`, `engine.js`
- [x] `SM-12` COPPA compliance (기본) — Consent form + audit log + DB constraints | `migration 004`, `consent/page.js`
- [x] `SM-13` JWT httpOnly (기본) — httpOnly: true, secure, sameSite: 'lax' | `auth.js`

---

## Source Documents

| 문서 | 위치 | 용도 |
|------|------|------|
| SUPERVISOR_BUILDOUT_PLAN.md | 프로젝트 루트 | Phase 1~5 태스크 원본 |
| BETA_TEST_REPORT.md | 프로젝트 루트 | 보안/품질 이슈 원본 |
| AGENT_REPORT.md | 프로젝트 루트 | 에이전트 스프린트 결과 |
| supervisor-tasks.md | .claude memory | 완료 항목 상세 |

---

*— HiAlice PROGRESS v1.0 | 2026-03-11 —*
