# HiAlice Figma Wireframes And Component Map

## Purpose

이 문서는 바로 Figma에서 화면을 만들 수 있도록:

1. 프레임 이름 규칙
2. 화면별 와이어프레임 구조
3. 현재 코드와 연결되는 컴포넌트 매핑

을 정리한 문서다.

## 1. Figma Frame Naming

추천 형식:

`[플랫폼] [플로우] [화면명] [버전]`

예시:

- `Web Student Landing v1`
- `Web Student Login v1`
- `Web Student Start Voice Search v1`
- `Web Student Start Match Confirm v1`
- `Web Student Session Worksheet Chat v1`
- `Web Student Review Studio v1`
- `Web Student Library Read Books v1`
- `Web Student Library Creations v1`
- `Web Parent Dashboard v1`

모바일 프레임:

- `Mobile Student Landing v1`
- `Mobile Student Start Voice Search v1`
- `Mobile Student Session v1`

## 2. Recommended First Frame Set

가장 먼저 만들어야 할 핵심 프레임:

1. `Web Student Landing v1`
2. `Web Student Login v1`
3. `Web Student Start Voice Search v1`
4. `Web Student Start Match Confirm v1`
5. `Web Student Session Worksheet Chat v1`
6. `Web Student Review Studio v1`
7. `Web Student Library Read Books v1`
8. `Web Student Library Creations v1`

## 3. Wireframe Structure

아래는 각 프레임에서 바로 배치할 수 있는 블록 구조다.

### A. Web Student Landing v1

구조:

1. Top nav
2. Hero illustration
3. Brand title
4. Short value statement
5. Primary CTA `Get Started`
6. Secondary CTA `Try Demo`
7. Feature cards 3개
8. Footer hint

텍스트 예시:

- Title: `HiAlice`
- Subtitle: `English Reading Adventure`
- Body: `AI-powered learning for children aged 6–13`
- CTA 1: `Get Started`
- CTA 2: `Try Demo`

### B. Web Student Login v1

구조:

1. Top nav
2. Login hero card
3. Option cards 3개
4. Student chooser panel
5. Parent login panel
6. Register panel

메인 카드:

- `I'm a Student`
- `Parent Login`
- `Create New Account`

학생 패널:

1. Panel emoji
2. Heading `Who are you?`
3. Search input
4. Student cards
5. Back button

### C. Web Student Start Voice Search v1

가장 중요한 프레임.

구조:

1. Top nav
2. Page badge `Read Then Talk`
3. Main title
4. Helper paragraph
5. Two-column layout

Left column:

1. Step title `Step 1. Say the book title`
2. Voice button
3. Support text
4. Text input fallback
5. Live transcript chip

Right column:

1. Step title `Step 2. Check the book`
2. Match result card
3. Secondary matches list

하단:

1. Guidance note card

### D. Web Student Start Match Confirm v1

구조:

1. Dimmed background from Start page
2. Center confirmation modal
3. Book title
4. Support question
5. Secondary button `Pick another book`
6. Primary button `Yes, let's go!`

### E. Web Student Session Worksheet Chat v1

구조:

1. Top nav
2. Session top bar
3. Split layout

Left rail:

1. Worksheet header
2. Step list
3. Active state row
4. Completed state rows
5. Progress summary

Step labels:

- `Title`
- `Introduction`
- `Body 1`
- `Body 2`
- `Body 3`
- `Conclusion`
- `Cross Book`

Right panel:

1. Book title/timer bar
2. Chat history
3. Alice bubble
4. Student bubble
5. Thinking state
6. Input area

Thinking state content:

- dots
- short Socratic helper line

예시:

- `That is a thoughtful start. I am shaping the next question for you.`

### F. Web Student Review Studio v1

구조:

1. Celebration header
2. Session summary card
3. Score cards
4. Imagination Studio cards 3개
5. Vocabulary summary
6. Next action buttons

CTA group:

- `Start Another Book`
- `Practice These Words`
- `Open Library`

### G. Web Student Library Read Books v1

구조:

1. Top nav
2. Library hero section
3. Tab switcher
4. Read books list/cards
5. Empty state

Tab labels:

- `Read Books`
- `Creations`

### H. Web Student Library Creations v1

구조:

1. Same hero section
2. Same tab switcher
3. Saved creations grid
4. Card tags `Saved`

## 4. Mobile Wireframe Notes

### Mobile Student Start Voice Search v1

레이아웃:

1. Top nav compact
2. Step card 1
3. Mic button centered
4. Transcript card
5. Best match card
6. Other matches accordion/list
7. Confirm button sticky

### Mobile Student Session v1

레이아웃:

1. Compact top bar
2. Worksheet summary strip
3. Chat full width
4. Input dock bottom fixed

핵심:

- 모바일에서는 채팅 몰입감이 우선
- 워크시트는 전체 사이드바 대신 요약형/드로어형으로도 검토 가능

## 5. Component Inventory For Figma

Figma에서 먼저 만들어야 할 컴포넌트:

1. `Nav / Top`
2. `Nav / Mobile Bottom`
3. `Button / Primary`
4. `Button / Secondary`
5. `Button / Ghost`
6. `Input / Search`
7. `Input / Default`
8. `Card / Option`
9. `Card / Book Match`
10. `Card / Book Secondary`
11. `Card / Reading History`
12. `Card / Creation`
13. `Card / Summary Stat`
14. `Voice / Button`
15. `Worksheet / Step Row`
16. `Chat / Alice Bubble`
17. `Chat / Student Bubble`
18. `State / Thinking`
19. `Modal / Confirmation`
20. `Tabs / Library`

## 6. Current Code To Figma Mapping

현재 코드와 가장 직접 연결되는 매핑표:

### Navigation

- Figma: `Nav / Top`
- Code: [frontend/src/app/layout.js](/Users/maxmcair/Projects/hialicebyclaude/frontend/src/app/layout.js)
- Code alt: [frontend/src/components/NavBar.js](/Users/maxmcair/Projects/hialicebyclaude/frontend/src/components/NavBar.js)

### Landing

- Figma: `Web Student Landing v1`
- Code: [frontend/src/app/page.js](/Users/maxmcair/Projects/hialicebyclaude/frontend/src/app/page.js)

### Login

- Figma: `Web Student Login v1`
- Code: [frontend/src/app/login/page.js](/Users/maxmcair/Projects/hialicebyclaude/frontend/src/app/login/page.js)

### Start

- Figma: `Web Student Start Voice Search v1`
- Code: [frontend/src/app/books/page.js](/Users/maxmcair/Projects/hialicebyclaude/frontend/src/app/books/page.js)

### Book Card

- Figma: `Card / Book Match`, `Card / Book Secondary`
- Code: [frontend/src/components/BookCard.jsx](/Users/maxmcair/Projects/hialicebyclaude/frontend/src/components/BookCard.jsx)

### Voice Button

- Figma: `Voice / Button`
- Code: [frontend/src/components/VoiceButton.jsx](/Users/maxmcair/Projects/hialicebyclaude/frontend/src/components/VoiceButton.jsx)

### Session

- Figma: `Web Student Session Worksheet Chat v1`
- Code: [frontend/src/app/session/page.js](/Users/maxmcair/Projects/hialicebyclaude/frontend/src/app/session/page.js)

### Review / Studio

- Figma: `Web Student Review Studio v1`
- Code: [frontend/src/app/review/page.js](/Users/maxmcair/Projects/hialicebyclaude/frontend/src/app/review/page.js)
- Code subcomponent: [frontend/src/components/ImaginationStudio.jsx](/Users/maxmcair/Projects/hialicebyclaude/frontend/src/components/ImaginationStudio.jsx)

### Library

- Figma: `Web Student Library Read Books v1`
- Figma: `Web Student Library Creations v1`
- Code: [frontend/src/app/library/page.js](/Users/maxmcair/Projects/hialicebyclaude/frontend/src/app/library/page.js)

### Dashboard

- Figma: `Web Student Dashboard v1`
- Code: [frontend/src/app/dashboard/page.js](/Users/maxmcair/Projects/hialicebyclaude/frontend/src/app/dashboard/page.js)

## 7. Design Handoff Checklist

각 프레임마다 꼭 남겨야 할 것:

1. desktop width
2. mobile width
3. spacing values
4. text styles
5. component states
6. loading states
7. empty states
8. error states

## 8. Suggested Working Sequence

실제 진행 순서:

1. Foundations 만들기
2. Landing 와이어프레임
3. Login 와이어프레임
4. Start 와이어프레임
5. Session 와이어프레임
6. Review 와이어프레임
7. Library 와이어프레임
8. Components 정리
9. Prototype 연결
10. Dev handoff

## 9. Best Immediate Next Deliverable

가장 실무적으로 다음에 만들면 좋은 산출물:

`Student Core Flow Wireframe Pack`

포함 프레임:

1. `Web Student Login v1`
2. `Web Student Start Voice Search v1`
3. `Web Student Start Match Confirm v1`
4. `Web Student Session Worksheet Chat v1`

이 4개만 먼저 있으면 HiAlice 핵심 UX는 거의 설계가 끝난다.
