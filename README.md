# HiAlice — AI 영어 독서 학습 앱

> 6~13세 아동을 위한 영어 원서 독서 후 AI 선생님과의 대화형 리뷰 학습 플랫폼

---

## 서비스 개요

**HiAlice**는 소크라테스식 교육법을 기반으로, 아동이 영어 원서를 읽고 AI 선생님(HiAlice)과 1:1 대화하며 사고력과 영어 표현력을 함께 키우는 에듀테크 서비스입니다.

## 핵심 차별화

| 요소 | HiAlice | 경쟁사 |
|------|---------|--------|
| 음성 대화 | ✅ | Ello만 부분 지원 |
| 소크라테스식 교육 | ✅ | Khanmigo만 부분 지원 |
| 독후 활동 특화 | ✅ | 대부분 미지원 |
| 6-13세 전연령 | ✅ | 대부분 K-3 또는 범용 |
| ESL 특화 | ✅ | 거의 없음 |

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| Frontend | React / Next.js 14 + Tailwind CSS |
| Backend | Node.js + Express + Supabase |
| AI Engine | Claude API (Sonnet 4) |
| Speech | Whisper (STT) / ElevenLabs (TTS) |
| Database | PostgreSQL (Supabase) |
| Mobile | React Native (Expo) |
| Infra | Docker + GitHub Actions CI/CD |

## 핵심 기능 (Sprint 1-3 구현)

| 기능 | 설명 | 상태 |
|------|------|------|
| Bloom's Taxonomy 태깅 | 학생 응답의 인지 수준 자동 분류 | ✅ |
| 부분 정답 인정 | Khanmigo 차별화 — 틀려도 사고 방향 인정 | ✅ |
| 답변 깊이 분류기 | surface/developing/analytical/deep 4단계 | ✅ |
| 사고 모멘텀 | 세션 내 답변 깊이 상승 추세 수치화 | ✅ |
| 6단계 세션 구조 | Warm Connection + Cross Book 추가 | ✅ |
| 메타인지 클로징 | 세션 마지막 자기 성찰 질문 2개 | ✅ |
| Cross-Book Memory | 이전 책 키워드를 AI 프롬프트에 주입 | ✅ |
| 문맥 인식 필터 | 독서 토론 허용, 폭력 의도만 차단 | ✅ |
| Thought Garden | 뱃지 대신 사고가 성장하는 정원 시각화 | ✅ |
| 학부모 인사이트 카드 | "오늘 우리 아이가 한 말" — 점수 아닌 사고 공유 | ✅ |
| 침묵 감지 | 3초 침묵 = 사고 시간 (오류 아님) | ✅ |
| COPPA VPC | Stripe $0.50 소액 인증으로 부모 동의 검증 | ✅ |
| httpOnly 쿠키 | XSS 토큰 탈취 방지 (아동 앱 필수) | ✅ |
| Prediction Portfolio | 예측-검증 메타인지 트래킹 시스템 | ✅ |
| E2E 테스트 | Playwright 5개 시나리오 15개 테스트 | ✅ |

## 세션 구조

6단계 Q&A 세션으로 구성:

1. **Warm Connection** — 라포 형성, 이전 독서 경험 연결
2. **Title** — 책 제목과 첫인상 탐구
3. **Introduction** — 배경, 등장인물 이해
4. **Body** — 3가지 이유/근거 제시
5. **Conclusion** — 개인적 해석과 의견 정리
6. **Cross Book** — 책과 책을 연결하는 횡단 학습

## 개발 로드맵

### 기초 빌드 (완료)

| Phase | 내용 | 상태 |
|-------|------|------|
| 1 | 프로젝트 셋업, DB 설계, AI 프롬프트 초안 | ✅ 완료 |
| 2 | Core UI, 음성 인식, 기본 대화 플로우 | ✅ 완료 |
| 3 | Q&A 세션 완성, 단어 학습 시스템, TTS | ✅ 완료 |
| 4 | 어드민 대시보드, 리포트, QA | ✅ 완료 |
| 5 | 베타 테스트, 피드백 반영, 지브리 UI 테마 | ✅ 완료 |

### 슈퍼바이저 빌드업 (5.8 → 9.2 목표)

| Phase | 내용 | 상태 |
|-------|------|------|
| S-1 | Bloom's 태깅, 답변 깊이 분류, 부분정답 인정 | ✅ 완료 |
| S-2 | 6단계 세션, 메타인지, Cross-Book Memory, E2E | ✅ 완료 |
| S-3 | Thought Garden, 학부모 카드, COPPA VPC, 보안 | ✅ 완료 |
| S-4 | 전체 통합, API 연결, 성능 최적화, 문서 정리 | 🔄 진행 중 |

## 프로젝트 문서

| 문서 | 설명 |
|------|------|
| `CLAUDE.md` | 프로젝트 핵심 가이드 + 아키텍처 |
| `SUPERVISOR_BUILDOUT_PLAN.md` | 6주 빌드업 전략 (시장조사 포함) |
| `RESEARCH_EDUCATION_PROGRAMS_2026.md` | Reddit + 교육 프로그램 리서치 |
| `AGENT_REPORT.md` | 멀티에이전트 분석 결과 |
| `BETA_TEST_REPORT.md` | 베타 테스트 결과 |

## 근거 기반 교육 설계

- **Amira Learning RCT**: AI 튜터 30세션 → 인간 튜터와 동등한 효과
- **PIRLS 2026**: 기억→추론→통합→비판→창조 5단계 독서 평가
- **SEL 메타분석 (33,700명)**: 사회정서학습 → 학업 성취도 4.2~8.4 퍼센타일 향상
- **간격반복 연구**: 능동적 인출 > 수동적 재읽기, 장기 기억 전환

## 목표 점수 로드맵

```
시작 5.8/10
    │
    ├─ Sprint 1: 부분정답 + DB영속 + Bloom's ────────▶ 6.5 ✅
    │
    ├─ Sprint 2: 6단계 세션 + 메타인지 + 필터 개선 ──▶ 7.5 ✅
    │
    ├─ Sprint 3: Thought Garden + 학부모 카드 + COPPA ▶ 8.5 ✅
    │
    └─ Sprint 4: 전체 통합 + API + 성능 최적화 ──────▶ 9.2+ 🔄
```

---

*HiAlice v2.0 | 2026.03.10*
