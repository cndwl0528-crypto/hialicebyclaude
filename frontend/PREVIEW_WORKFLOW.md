# HiAlice Preview Workflow

## Why previews kept breaking

반복된 미리보기 장애의 핵심 원인은 코드 자체보다 아래 두 가지였다.

1. `next dev`의 HMR/webpack 캐시가 `frontend/.next/cache` 안에서 깨짐
2. 개발용 서버를 그대로 검수용 미리보기로 사용하면서 오래된 상태가 남음

이 구조에서는 포트만 바꿔도 같은 문제가 다시 생길 수 있다.

## New rule

앞으로는 아래처럼 분리해서 사용한다.

### 1. 개발 중 수정

사용 명령:

`npm run dev:stable`

의미:

- `.next`를 먼저 비운다
- `localhost:5174`에서 깨끗한 상태로 `next dev`를 실행한다
- 코딩 중 빠른 확인용이다

### 2. 실제 검수/공유용 미리보기

사용 명령:

`npm run preview`

의미:

- `.next`를 먼저 비운다
- production build를 다시 만든다
- `localhost:5173`에서 `next start`로 안정적인 preview 서버를 연다
- 사용자 확인용은 이 모드를 우선으로 본다

## Recommended habit

작업 중:

- `npm run dev:stable`

검수 전:

- `npm run preview`

문제가 생기면:

1. 기존 preview 탭 종료
2. `npm run preview` 다시 실행
3. 새 주소만 확인

## Why this is safer

- dev cache corruption 영향을 크게 줄인다
- HMR 상태와 실제 배포 상태를 구분할 수 있다
- "포트는 열렸는데 화면이 안 뜸" 같은 애매한 상황이 줄어든다
