# HiAlice Figma Design Guide

## Goal

HiAlice의 화면을 코드 수정 전에 Figma에서 먼저 설계해, 아이 중심 흐름과 시각 규칙을 안정적으로 고정한다.

핵심 목표:

1. 로그인 후 아이가 어디로 가야 하는지 한눈에 보이게 만들기
2. `Start / Library / Studio` 역할을 명확히 분리하기
3. 워크시트와 대화 화면을 아이가 이해하기 쉽게 단순화하기
4. 아동 친화적 그래픽 톤을 일관되게 맞추기

## Recommended Figma File Structure

Figma 파일 이름 예시:

`HiAlice Product Design v1`

페이지 구성:

1. `00 Foundations`
2. `01 User Flows`
3. `02 Student App`
4. `03 Parent Views`
5. `04 Components`
6. `05 Prototypes`
7. `06 Handoff`

## 00 Foundations

여기에는 공통 디자인 기준을 먼저 정리한다.

### Color Tokens

- Forest Green: primary action
- Warm Cream: page background
- Sky Blue: friendly support tone
- Golden Yellow: encouragement/highlight
- Coral Red: alerts

예시 토큰:

- `Primary / 500` `#5C8B5C`
- `Primary / 700` `#3D6B3D`
- `Surface / Base` `#F5F0E8`
- `Surface / Card` `#FFFCF3`
- `Accent / Gold` `#D4A843`
- `Accent / Sky` `#87CEDB`
- `Feedback / Danger` `#D4736B`

### Typography

- Heading: bold, rounded, child-friendly
- Body: clear and simple
- Label: compact but readable

추천 체계:

- `Display / 40 / ExtraBold`
- `Heading / 28 / ExtraBold`
- `Title / 20 / Bold`
- `Body / 16 / SemiBold`
- `Caption / 12 / SemiBold`

### Spacing

기본 spacing scale:

- `4`
- `8`
- `12`
- `16`
- `24`
- `32`
- `40`

### Radius

- Card: `24`
- Button: `16`
- Input: `16`
- Tag: `999`

## 01 User Flows

여기서는 실제 사용자 흐름을 먼저 도식화한다.

### Student Flow

1. Landing
2. Login
3. Child Select
4. Start
5. Say Book Title
6. Book Match Confirm
7. Session
8. Review
9. Library

### Parent Flow

1. Landing
2. Parent Login
3. Dashboard
4. Child Progress
5. Reports
6. Library Review

## 02 Student App

우선순위가 가장 높은 화면부터 설계한다.

### A. Landing

목적:

- 앱 첫인상
- 학생/부모 진입 분기

필수 요소:

- 브랜드 히어로
- `Get Started`
- `Try Demo`
- 학생/부모 선택 유도

### B. Login

목적:

- 학생 선택
- 부모 로그인

필수 요소:

- 학생 선택 카드
- 부모 로그인 카드
- 신규 계정 카드

### C. Start

가장 중요한 학생 화면.

목적:

- 아이가 읽은 책을 말하고
- 자동 검색 결과를 보고
- 확인 후 워크시트로 넘어가게 하기

필수 섹션:

1. `Step 1. Say the book title`
2. `Live transcript / typed input`
3. `Best match`
4. `Other close matches`
5. `Confirm CTA`

디자인 포인트:

- 화면의 첫 시선은 마이크 버튼
- 결과 카드는 1개를 가장 크게
- 추가 후보는 보조 리스트로

### D. Session

목적:

- 왼쪽: 워크시트 단계
- 오른쪽: 실시간 대화

필수 구조:

- Left rail:
  - Title
  - Introduction
  - Body 1
  - Body 2
  - Body 3
  - Conclusion
  - Cross Book
- Right panel:
  - Alice chat bubbles
  - Student chat bubbles
  - voice/text input
  - thinking prompt

디자인 포인트:

- 왼쪽은 질문 카드보다 “단계 진행표” 느낌
- 오른쪽은 채팅 몰입감 우선
- 로딩 시 `thinking bubble + gentle Socratic prompt`

### E. Review / Studio

목적:

- 워크시트 결과 확인
- 이미지 생성 콘셉트 확인

필수 요소:

- session summary
- vocabulary
- imagination studio cards
- next action buttons

### F. Library

목적:

- 읽은 책 기록 보관
- 생성 결과물 보관

탭 구조 추천:

1. `Read Books`
2. `Creations`

## 03 Parent Views

학생보다 후순위지만, 구조는 함께 정리한다.

우선 필요한 화면:

1. Parent Login
2. Parent Dashboard
3. Student Detail
4. Reading History
5. Saved Outputs

## 04 Components

피그마 컴포넌트로 먼저 정의할 항목:

1. Top navigation
2. Bottom mobile nav
3. Primary button
4. Secondary button
5. Voice button
6. Book match card
7. Reading history card
8. Creation card
9. Worksheet step row
10. Chat bubble
11. Empty state
12. Confirmation modal

상태도 같이 만든다:

- default
- hover
- active
- disabled
- loading

## 05 Prototypes

프로토타입은 최소 아래 3개를 만든다.

### Prototype 1

`Landing -> Login -> Child Select -> Start`

### Prototype 2

`Start -> Book Confirm -> Session`

### Prototype 3

`Session -> Review -> Library`

## 06 Handoff

개발 연결 시 남겨야 할 것:

1. spacing tokens
2. color tokens
3. typography scale
4. component specs
5. page notes
6. responsive behavior

필수로 적을 것:

- desktop layout
- tablet layout
- mobile layout
- interaction notes
- loading states
- empty states
- error states

## Recommended Work Order

Figma 작업 우선순위:

1. Landing
2. Login
3. Start
4. Session
5. Review / Studio
6. Library
7. Parent Dashboard

이 순서가 좋은 이유:

- 지금 가장 중요한 문제는 아이의 시작 흐름
- 그래서 `Start`와 `Session`이 가장 먼저 고정돼야 함
- `Library`와 `Studio`는 그 다음 정리해도 됨

## How This Changes Development

피그마를 먼저 만들면:

- 화면 우선순위가 분명해진다
- 팀이 “이 화면이 맞다”를 먼저 합의할 수 있다
- 구현 후 구조를 다시 바꾸는 비용이 줄어든다
- 컴포넌트 일관성이 생긴다

## Suggested Next Step

바로 시작한다면 가장 먼저 Figma에서 아래 3개 프레임을 만든다.

1. `Landing`
2. `Start - Voice Book Search`
3. `Session - Worksheet + Chat`

이 3개만 먼저 고정해도 HiAlice 전체 UX 방향이 거의 정리된다.
