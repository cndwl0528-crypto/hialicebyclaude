# HiAlice High-Fidelity Style Guide

## Scope

이 문서는 HiAlice 학생 핵심 플로우의 하이파이 스타일 기준을 정리한다.

대상 화면:

1. `Login`
2. `Start`
3. `Session`

## 1. Visual Direction

HiAlice 학생 화면은 아래 감정을 동시에 주는 방향으로 잡는다.

- safe
- bright
- curious
- calm
- guided

즉, 너무 장난감처럼 산만하지 않고, 아이가 혼자서도 다음 행동을 이해할 수 있는 구조를 목표로 한다.

## 2. Color Use

### Primary

- `Forest Green` for main action
- `Warm Cream` for background
- `Sky Blue` for guidance/support
- `Golden Yellow` for encouragement
- `Coral` for warning or active recording

### Screen Use

#### Login

- hero: sky + cream + green gradient
- student card: green accent
- parent card: gold accent
- register card: sky accent

#### Start

- hero: warm gradient
- voice panel: green emphasis
- match panel: cream card with gold label
- support note: sky-tinted helper card

#### Session

- worksheet rail: cream background with green active states
- chat area: warm base
- Alice bubble: soft green
- Student bubble: cream with outlined edge
- thinking bubble: pale green with animated dots

## 3. Typography

### Heading

- strong rounded sans
- extra bold
- compact line-height

### Body

- semi-bold
- friendly and readable
- no long dense paragraphs

### UI Labels

- uppercase only for small eyebrow or micro labels
- use sentence case for main actions

## 4. Layout Rules

### Login

- hero first
- feature strip second
- three role cards third
- each card must clearly explain next action

### Start

- first screen should immediately show voice action
- best match must be visually dominant
- secondary matches should be shorter and lighter

### Session

- worksheet on left should feel like a progress guide, not a form wall
- chat on right should feel alive and primary
- save/exit should stay visible but secondary

## 5. Component Styling

### Role Card

- 24px radius
- subtle shadow
- top accent bar
- icon tile
- title + one-line explanation
- arrow affordance

### Voice Button

- circular
- thick soft shadow
- idle pulse ring allowed
- listening state must clearly switch to coral tone

### Book Match Card

- cover or emoji anchor on left
- title and author strong
- one-line curiosity copy
- primary CTA on bottom

### Worksheet Row

- active row: green rail + brighter background
- complete row: check state + softer green
- future row: muted cream

### Thinking State

- dots first
- one short supportive line
- no long spinner-only wait states

## 6. Copy Tone

학생용 카피 기준:

- short
- direct
- encouraging
- not robotic

예시:

- good: `Tell me the book you read.`
- good: `I am listening.`
- good: `Is this the book you read?`
- avoid: long instructional paragraphs

## 7. Done Criteria

아래가 맞으면 하이파이 1차 완료로 본다.

- Login, Start, Session가 같은 브랜드처럼 보임
- 학생이 첫 행동을 3초 안에 알 수 있음
- Voice, Match, Worksheet 상태 구분이 분명함
- 로딩 중에도 대화가 끊긴 느낌이 적음
