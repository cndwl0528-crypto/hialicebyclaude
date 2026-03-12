# HiAlice Student Core Flow Content Pack

## Purpose

이 문서는 Figma에서 바로 사용할 수 있도록 학생 핵심 플로우의:

1. 화면별 카피
2. 상태별 문구
3. 컴포넌트 상태 규칙

을 정리한 문서다.

## 1. Core Flow Frames

이번 문서 기준 핵심 프레임은 아래 4개다.

1. `Web Student Login v1`
2. `Web Student Start Voice Search v1`
3. `Web Student Start Match Confirm v1`
4. `Web Student Session Worksheet Chat v1`

## 2. Screen Copy

### A. Web Student Login v1

#### Hero Copy

- Eyebrow: `Welcome Back`
- Title: `Let us find your next reading talk.`
- Body: `Choose your profile to continue your reading adventure with Alice.`

#### Option Cards

- Card 1 title: `I'm a Student`
- Card 1 body: `Start with a book you already read.`
- Card 1 CTA: `Choose Me`

- Card 2 title: `Parent Login`
- Card 2 body: `See progress, reading history, and saved creations.`
- Card 2 CTA: `Sign In`

- Card 3 title: `Create New Account`
- Card 3 body: `Set up a new learning journey for your family.`
- Card 3 CTA: `Get Started`

#### Student Picker

- Panel title: `Who is reading today?`
- Search placeholder: `Type your name`
- Helper line: `Pick your profile and we will help you find the book you read.`
- Back CTA: `Back`

### B. Web Student Start Voice Search v1

#### Header Copy

- Eyebrow: `Start`
- Title: `Tell me the book you read.`
- Body: `You can say the title out loud or type it. I will help you find the right book.`

#### Left Panel

- Step label: `Step 1`
- Step title: `Say the book title`
- Voice button idle: `Tap to Speak`
- Voice button listening: `I am listening...`
- Voice helper: `Speak naturally. Even part of the title is okay.`
- Input label: `Or type it here`
- Input placeholder: `Example: Charlotte's Web`
- Transcript label: `I heard`

#### Right Panel

- Step label: `Step 2`
- Step title: `Check the book`
- Match card label: `Best Match`
- Match helper: `Does this look like the book you read?`
- Secondary list label: `You might also mean`
- Empty state title: `Let us try another clue.`
- Empty state body: `You can say the title again, say the character's name, or type part of the book title.`

#### Bottom Guidance Card

- Title: `Need help remembering?`
- Body: `You can say a character, a place, or one important scene from the book.`

### C. Web Student Start Match Confirm v1

#### Modal Copy

- Title: `Is this the book you read?`
- Body: `Once you confirm, we will start your reading talk and worksheet together.`
- Secondary CTA: `Pick Another Book`
- Primary CTA: `Yes, Let's Go!`

### D. Web Student Session Worksheet Chat v1

#### Top Bar

- Session tag: `Reading Talk`
- Support line: `We are exploring your ideas one step at a time.`
- Exit CTA: `Save and Exit`

#### Left Worksheet Panel

- Panel title: `My Reading Notes`
- Panel body: `We will build your ideas as we talk.`

#### Step Labels

- `Title`
- `Introduction`
- `Body 1`
- `Body 2`
- `Body 3`
- `Conclusion`
- `Cross Book`

#### Right Chat Area

- Alice starter: `What book did you read, and what made you choose it?`
- Input placeholder: `Tell Alice what you are thinking`
- Voice CTA: `Speak`
- Send CTA: `Send`

## 3. Socratic Prompt Examples

로딩이나 다음 질문 준비 중에도 대화가 끊기지 않도록, 아래 문구를 순환해서 쓴다.

### Thinking Helpers

- `That is a thoughtful answer. I am shaping the next question for you.`
- `You noticed something important. Let us dig a little deeper.`
- `I am connecting your idea to the next part of the story.`
- `You are building a strong reading thought. One more question is coming.`

### Gentle Follow-Up Prompts

- `What makes you think that?`
- `Which part of the story helped you decide that?`
- `How did the character change from the beginning to the end?`
- `What would you tell a friend about this part?`
- `What is one clue from the book that supports your idea?`

## 4. Component State Rules

### Voice Button

상태는 최소 4개로 잡는다.

1. `Idle`
2. `Listening`
3. `Processing`
4. `Error`

상태별 기준:

- `Idle`: primary color, mic icon, short CTA
- `Listening`: active glow, waveform or pulse
- `Processing`: disabled tap, spinner or dots
- `Error`: warm red outline, retry helper

### Book Match Card

상태는 최소 4개로 잡는다.

1. `Default`
2. `Highlighted`
3. `Confirmed`
4. `No Result`

상태별 기준:

- `Default`: cover, title, author, one short summary
- `Highlighted`: stronger border and shadow
- `Confirmed`: success badge or check state
- `No Result`: illustration plus retry helper

### Worksheet Step Row

상태는 최소 4개로 잡는다.

1. `Not Started`
2. `Active`
3. `Completed`
4. `Locked Optional`

상태별 기준:

- `Not Started`: muted text
- `Active`: bold label plus highlight bar
- `Completed`: small check plus short summary preview
- `Locked Optional`: lighter tone for future expansion

### Chat Bubble

최소 3개 타입으로 구분한다.

1. `Alice`
2. `Student`
3. `Thinking`

구분 원칙:

- `Alice`: calmer support color
- `Student`: warmer personal color
- `Thinking`: dotted or soft animated container

## 5. Empty, Error, and Loading States

### Start Empty State

- Title: `Ready when you are.`
- Body: `Say the title of a book you already read.`

### Start Error State

- Title: `I could not hear that clearly.`
- Body: `Please try again or type the title instead.`
- CTA: `Try Again`

### Session Loading State

- Title: `Alice is thinking`
- Body: `She is preparing your next question.`

### Session Recovery State

- Title: `Let us keep going.`
- Body: `You can answer again, or I can ask the question in a different way.`
- CTA 1: `Ask Again`
- CTA 2: `Say It Differently`

## 6. Prototype Notes

Figma 프로토타입에서는 아래 전환만 먼저 잡아도 핵심 데모가 된다.

1. Login card click -> Student picker open
2. Student picker select -> Start page
3. Voice input complete -> Match card highlight
4. Confirm modal open -> Session page
5. Session step progress -> next step active

## 7. Best Next Design Task

이 문서 다음으로 가장 효율적인 작업은:

`Student Core Flow High-Fidelity Pack`

포함 내용:

1. 컬러 적용
2. 실제 버튼 상태 적용
3. 책 카드 일러스트 스타일 적용
4. 채팅 버블 스타일 확정
5. 모바일 프레임 2개 추가
