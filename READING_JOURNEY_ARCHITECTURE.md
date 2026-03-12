# HiAlice Reading Journey Architecture

## Goal

아이들이 로그인한 뒤 자연스럽게:

1. 자신이 읽은 책을 찾고
2. 책을 고르고
3. AI와 대화하며 워크시트를 채우고
4. 자기 생각이 반영된 이미지 결과물을 받는 흐름을 만든다.

이번 설계는 실제 AI 엔진 연결 전까지 프런트 목업과 데이터 계약을 먼저 안정화하는 데 초점을 둔다.

## Core User Flow

### 1. Login + Child Context

- 입력: `parent`, `student`, `recent_sessions`, `student_level`
- 출력 UI:
  - 오늘의 아이 프로필
  - 최근 읽은 책
  - 이어서 하기 세션
  - 추천 책 / 최근 책 우선 노출

핵심 원칙:

- 부모/자녀 인증과 독서 시작 화면을 분리하지 말고 하나의 여정으로 이어준다.
- 로그인 직후 첫 CTA는 `책 찾기` 또는 `이어서 하기`여야 한다.

### 2. Book Discovery Layer

- 데이터 소스 우선순위:
  1. real `books` table
  2. mock catalog fallback
- 검색 키:
  - `title`
  - `author`
  - `genre`
  - `synopsis`
  - `curiosityHook`
  - `searchTokens`
  - `discoveryThemes`
  - `moods`

필수 필드:

```ts
type DiscoveryBook = {
  id: string;
  title: string;
  author: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  genre: string;
  description: string;
  synopsis?: string;
  curiosityHook?: string;
  animationStyle?: string;
  searchTokens?: string[];
  discoveryThemes?: string[];
  moods?: string[];
};
```

### 3. Session Orchestration

세션은 한 화면 안에서 세 가지를 동시에 보여줘야 한다.

- AI 대화
- 워크시트 진행 상태
- 아이 감정/생각의 누적 맥락

추천 상태 모델:

```ts
type ReadingSessionState = {
  sessionId: string;
  studentId: string;
  bookId: string;
  stage: 'warm_connection' | 'title' | 'introduction' | 'body' | 'conclusion' | 'cross_book';
  messages: Message[];
  worksheetAnswers: Record<string, string>;
  promptMemory: {
    favoriteScene?: string;
    emotion?: string;
    lesson?: string;
    characterFocus?: string;
  };
  imageConcepts?: GeneratedConcept[];
};
```

### 4. Worksheet to Image Pipeline

실서비스 연결 시 권장 파이프라인:

1. 음성/텍스트 입력 수집
2. 세션 요약 생성
3. 이미지용 구조화 프롬프트 생성
4. 아동 친화 안전 규칙 적용
5. 이미지 생성
6. 부모 검토 후 저장

프런트 계약 예시:

```ts
type GeneratedConcept = {
  id: string;
  label: string;
  title: string;
  prompt: string;
  status: 'draft' | 'queued' | 'generated' | 'approved';
  imageUrl?: string;
};
```

## Recommended Service Split

### Frontend

- `/dashboard`
  - 로그인 직후 진입점
  - child context + reading journey 표시
- `/books`
  - discovery hub
  - 검색, 추천, curiosity hook
- `/session`
  - worksheet + chat synchronized experience
- `/review`
  - vocabulary + score + imagination studio

### Backend

- `GET /books?level=&search=`
- `GET /books/recommendations/:studentId`
- `POST /sessions/start`
- `POST /sessions/:id/message`
- `POST /sessions/:id/complete`
- `POST /sessions/:id/image-concepts`
- `POST /sessions/:id/image-approve`

## AI Integration Notes

### Conversation Engine

- 입력:
  - 책 메타데이터
  - 이전 turns
  - worksheet answers
  - child profile
- 출력:
  - 다음 질문
  - 추출된 감정/주제
  - 이미지 생성용 메모리 조각

### Image Generation Engine

- 입력:
  - session summary
  - child-selected favorite moment
  - safety policy
  - chosen visual style
- 출력:
  - 2~3개 콘셉트 프롬프트
  - 썸네일 또는 생성 이미지

## Data Priorities

가장 먼저 안정화해야 할 순서:

1. `books` 검색 가능한 목업/실데이터 통합
2. 로그인 후 child context 유지
3. 세션 메시지와 worksheet answer 동기화
4. review 단계에서 image concept 생성
5. 부모 승인 후 최종 저장

## Why This Structure

- 아이는 "기능"보다 "흐름"을 기억한다.
- 책 찾기와 대화가 끊기면 이탈이 커진다.
- 이미지 생성은 마지막 보상이므로, 앞단의 책 선택과 워크시트 문맥을 반드시 이어받아야 한다.
