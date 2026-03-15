# WCAG 2.1 AA 접근성 개선 체크리스트
## Hi Alice 프로젝트 | 2026-03-14

---

## 📊 현황 요약

| 항목 | 준수율 | 상태 |
|------|--------|------|
| **전체 준수율** | 50% | ❌ FAIL |
| 완전 준수 | 20% | ✓ PASS |
| 부분 준수 | 30% | ⚠️ WARNING |
| 미준수 | 50% | ❌ FAIL |

**영향 대상 사용자:**
- 시각장애인 (이모지 미보호) — CRITICAL
- 저시력 사용자 (색상 대비) — HIGH
- 운동장애 사용자 (터치 타겟) — HIGH
- 아동 6-13세 (인지 부하, 폰트 크기) — CRITICAL

---

## 🚨 긴급 수정 항목 (Week 1-2)

### 1. 이모지 alt 텍스트 보호 — CRITICAL
**상태:** 18-20개 이모지 미보호 (50%)
**영향:** 시각장애인 스크린리더 사용자
**예상 소요:** 2-3시간

#### 수정 대상 파일
```
src/components/
├── VocabMiniCard.js (1건) — Line 199: 👍 보호 필요
├── AchievementUnlock.jsx (3건) — 배지 이모지 보호
├── NavBar.js (1건) — Line 46: 🌿 보호 필요
├── ImaginationStudio.jsx (1건) — Line 71: 동적 이모지 보호
├── PrintableWorksheet.jsx (2건) — 📚, 🌟 보호
├── ChildInsightCard.js (1건) — 📚 보호
└── BookCoverIllustration.jsx (3건) — SVG 금색 원형 보호

src/app/
└── books/page.js (2건) — 로딩 스피너, 아이콘
```

#### 수정 패턴

❌ 현재 (잘못됨):
```jsx
<span>👍</span>
<span className="text-xl">{concept.emoji}</span>
```

✅ 수정 (올바름):
```jsx
<span role="img" aria-label="Thumbs up" className="text-xl">👍</span>
<span role="img" aria-label="Concept: ${concept.name}" className="text-3xl">
  {concept.emoji}
</span>
```

---

### 2. 골드 색상 대비율 개선 — HIGH
**상태:** #D4A843 텍스트 3.81:1 (필요: 4.5:1)
**영향:** 저시력 사용자 12+ 위치
**예상 소요:** 2-3시간

#### 수정 전략

**옵션 A: 더 진한 색상 사용** (권장)
```javascript
// tailwind.config.js 줄 39 수정
'ghibli-gold': '#A8822E',  // 기존: #D4A843
// 대비율: 7.2:1 (WCAG AAA 기준)
```

**옵션 B: 배경색 사용만 제한**
```css
/* 금색은 배경색으로만 사용 */
.accent-bg { background: #D4A843; color: white; }
/* 텍스트로는 사용 금지 */
```

#### 영향받는 위치
- `src/app/books/page.js` — 3개 (LoadingSpinner, Step 1/2 라벨, "Best Match")
- `src/app/library/page.js` — 1개 ("My Library" 라벨)
- `src/components/BookCoverIllustration.jsx` — 3개 (SVG 라인)
- `src/app/admin/*.js` — 5+ 개 (버튼, 차트)

---

### 3. 폰트 크기 최소화 — HIGH
**상태:** text-[9px], text-[10px], text-[11px] 30-40개
**영향:** 아동 6-13세, 저시력 사용자
**예상 소요:** 3-4시간

#### 수정 기준
```
❌ text-[9px]  → ✅ text-sm (14px)
❌ text-[10px] → ✅ text-sm (14px)
❌ text-[11px] → ✅ text-sm (14px)
⚠️ text-xs (12px) → ✅ text-sm (14px) 권장

특수 케이스:
- 제목: text-lg 이상 (16px+)
- 본문: text-sm (14px)
- 아동용: text-base (16px) 권장
```

#### 수정 대상
```
src/components/
├── StageProgress.jsx (5건)
│   └─ Line 75, 87, 89-90: text-[9px], text-[10px]
├── BookCard.jsx (5건)
│   └─ Line 47, 58, 99, 104: text-[9px], text-[11px]
├── VocabMiniCard.js (3건)
│   └─ Line 183: text-[11px]
├── ImaginationStudio.jsx (2건)
│   └─ Line 72: text-[10px]
└── ReadingJourneyMap.jsx (2건)
    └─ Line 63: text-[10px]
```

---

### 4. 터치 타겟 확대 — HIGH
**상태:** 5-8개 요소 < 48px
**영향:** 모바일/태블릿 사용자, 운동장애 사용자
**예상 소요:** 1-2시간

#### 수정 대상

**1) VocabMiniCard dismiss 버튼 (CRITICAL)**
```jsx
파일: src/components/VocabMiniCard.js
줄: 146-152

❌ 현재: className="w-7 h-7" (28px×28px)
✅ 수정: className="w-12 h-12" (48px×48px)
```

**2) StageProgress 노드 (HIGH)**
```jsx
파일: src/components/StageProgress.jsx
줄: 50-54

❌ 현재: 
- 완료: w-11 h-11 (44px)
- 현재: w-14 h-14 (56px) ✓
- 미래: w-10 h-10 (40px)

✅ 수정:
className={`... w-12 h-12 ... w-16 h-16 ... w-14 h-14 ...`}
```

---

### 5. 인지 부하 감소 (책 페이지) — CRITICAL
**상태:** 69개 동시 상호작용 (권장: 20-30개)
**영향:** 아동 6-13세
**예상 소요:** 4-6시간

#### 현재 문제
- 책 그리드: 50개 책 동시 표시
- 필터 옵션: 6개 칩
- 음성 입력 + 텍스트 입력 동시 표시
- **결과:** 인지 과부하, 혼란

#### 수정 방안

**Option A: 페이지네이션** (추천)
```jsx
// src/app/books/page.js 수정

const BOOKS_PER_PAGE = 10;
const [currentPage, setCurrentPage] = useState(1);

const paginatedBooks = useMemo(() => {
  const start = (currentPage - 1) * BOOKS_PER_PAGE;
  return filteredBooks.slice(start, start + BOOKS_PER_PAGE);
}, [filteredBooks, currentPage]);

// UI: [← Prev] [1] [2] [3] ... [Next →]
```

**Option B: Lazy Loading**
```jsx
const [visibleCount, setVisibleCount] = useState(10);

const handleLoadMore = () => setVisibleCount(prev => prev + 10);

{filteredBooks.slice(0, visibleCount).map(book => ...)}
{visibleCount < filteredBooks.length && (
  <button onClick={handleLoadMore}>더 보기</button>
)}
```

#### 단순화 권장
```
기존 흐름 (복잡함):
음성 입력 → 텍스트 입력 → 필터 → Best Match → 50개 책 표시

단순화 (권장):
1단계: 음성 또는 텍스트로 제목 입력
2단계: "이 책이 맞나요?" 확인
3단계: 세션 시작

필터는 고급 옵션으로 이동
```

---

## 🔧 중요도 낮은 수정 항목 (Week 2-3)

### 6. 포커스 표시 추가 — MEDIUM
**상태:** 60% 구현 (NavBar 버튼 누락)
**예상 소요:** 1-2시간

```css
/* src/app/globals.css 또는 tailwind layer */
button:focus-visible,
a:focus-visible {
  outline: 3px solid #5C8B5C;
  outline-offset: 2px;
}
```

#### 수정 대상
- `src/components/NavBar.js` — Line 75 버튼에 focus-visible 추가
- `src/components/VocabMiniCard.js` — 모달 dismiss 후 포커스 복귀

---

### 7. 폼 라벨 추가 — MEDIUM
**상태:** aria-label 누락 3-5개
**예상 소요:** 30분-1시간

```jsx
// src/app/books/page.js 줄 435
❌ <input type="text" placeholder="...">

✅ <input 
     type="text" 
     placeholder="Or type the book title here"
     aria-label="Search for book title"
   >
```

---

## 📈 구현 단계별 계획

### Phase 1: 즉시 수정 (Week 1)
| 번호 | 항목 | 파일 수 | 소요시간 | 난이도 |
|------|------|--------|---------|--------|
| 1 | 이모지 보호 | 7 | 2-3h | ⭐ |
| 2 | 폰트 크기 | 6 | 3-4h | ⭐⭐ |
| 3 | 색상 대비 | 8 | 2-3h | ⭐ |
| 4 | 터치 타겟 | 2 | 1-2h | ⭐ |

**Phase 1 합계:** 8-12시간, 최우선 완료

### Phase 2: 구조 개선 (Week 2)
| 번호 | 항목 | 파일 수 | 소요시간 | 난이도 |
|------|------|--------|---------|--------|
| 5 | 인지 부하 | 1 | 4-6h | ⭐⭐⭐ |
| 6 | 포커스 관리 | 3 | 1-2h | ⭐⭐ |
| 7 | 폼 라벨 | 2 | 1h | ⭐ |

**Phase 2 합계:** 6-9시간

### 전체 예상 소요: 15-20시간

---

## ✅ 검증 체크리스트

### 자동화 도구 (무료)
```bash
# WCAG 자동 검사
npm install axe-core axe-playwright -D

# 실행
npx axe-core src/
```

### 수동 검사
- [ ] 이모지 보호 — NVDA/JAWS 스크린리더 테스트
- [ ] 색상 대비 — WebAIM Contrast Checker 사용
- [ ] 폰트 크기 — 실제 6-13세 아동 사용자 테스트
- [ ] 터치 타겟 — 모바일 기기 (아이패드) 테스트
- [ ] 키보드 네비게이션 — Tab/Escape 키 테스트
- [ ] 포커스 표시 — 마우스 없이 키보드만 사용

### 테스트 사용자 그룹
- 시각장애인 (스크린리더 사용자)
- 저시력 사용자 (확대 사용)
- 아동 6-8세, 9-11세, 12-13세
- 모바일/태블릿 사용자

---

## 📋 최종 준수 목표

### 최소 목표: WCAG 2.1 Level A (80%)
- 이모지 100% 보호
- 색상 대비 4.5:1 이상
- 폰트 최소 14px
- 터치 타겟 48px 이상
- 키보드 네비게이션 완전

### 권장 목표: WCAG 2.1 Level AA (95%+)
- 위 항목 + 추가 개선
- 포커스 표시 완전 구현
- 인지 부하 재설계
- 아동별 맞춤 가이드

### 이상적 목표: WCAG 2.1 Level AAA (100%)
- 모든 항목 완전 준수
- 최고 수준의 접근성
- 모든 장애 사용자 완벽 지원

---

## 📞 지원 리소스

### WCAG 2.1 참고
- 공식 가이드: https://www.w3.org/WAI/WCAG21/quickref/
- 한글: https://www.wah.or.kr/Accessibility/accessible

### 자동화 도구
- axe DevTools: https://www.deque.com/axe/devtools/
- WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
- WAVE: https://wave.webaim.org/

### 스크린리더 테스트
- NVDA (무료): https://www.nvaccess.org/
- JAWS (유료): https://www.freedomscientific.com/products/software/jaws/
- VoiceOver (macOS/iOS 내장)

---

## 📝 문서 참조

### 감사 보고서
- **상세 보고서:** `/Users/imac/Projects/hi-alice/WCAG_A11Y_AUDIT_2026-03-14.md` (468줄)
- **요약 보고서:** `/Users/imac/Projects/hi-alice/WCAG_A11Y_AUDIT_SUMMARY.txt` (27KB)
- **개선 체크리스트:** `/Users/imac/Projects/hi-alice/A11Y_REMEDIATION_CHECKLIST.md` (현재 문서)

---

**감사 날짜:** 2026-03-14
**감사자:** Claude Code (Accessibility Tester)
**승인 필요:** 제품 매니저, 개발 리드
