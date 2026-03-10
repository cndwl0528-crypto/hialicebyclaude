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

## 세션 구조

4단계 Q&A 세션으로 구성:

1. **Title** — 책 제목과 첫인상 탐구
2. **Introduction** — 배경, 등장인물 이해
3. **Body** — 3가지 이유/근거 제시
4. **Conclusion** — 개인적 해석과 의견 정리

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
| S-1 | Mock→Real 전환, DB 확장, 핵심 API | 🔲 대기 |
| S-2 | AI 질문 고도화 (책 맥락+감정 유도) | 🔲 대기 |
| S-3 | 아이 UX (레벨별 UI, 뱃지, 세션 저장) | 🔲 대기 |
| S-4 | 관리자/부모 대시보드 완성 | 🔲 대기 |
| S-5 | 보안/COPPA/E2E 테스트 | 🔲 대기 |

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

---

*HiAlice v1.1 | 2026.03.10*
