/**
 * featureGates.js
 * HiAlice — 연령별 기능 차등 해제 (Age-Based Feature Gates)
 *
 * 6-8세는 복잡한 메뉴 없이 핵심만, 12-13세는 전체 기능
 *
 * studentLevel은 sessionStorage / localStorage의 'studentLevel' 키에서 읽음.
 * clientStorage.getItem()을 사용하므로 두 스토리지를 모두 커버함.
 */

import { getItem } from '@/lib/clientStorage';

// ============================================================================
// FEATURE_GATES 정의
// ============================================================================

/**
 * @typedef {Object} FeatureGate
 * @property {string[]} nav          - 이 레벨에서 표시할 nav 경로 목록
 * @property {boolean}  showLibrary  - Library 메뉴 노출 여부
 * @property {boolean}  showReview   - Studio(Review) 메뉴 노출 여부
 * @property {boolean}  showDashboard - Dashboard 메뉴 노출 여부
 * @property {number}   itemsPerScreen - 한 화면에 표시할 아이템 수
 * @property {number}   fontSize     - 기본 본문 폰트 사이즈 (px)
 * @property {number}   touchTarget  - 터치 타겟 최소 크기 (px)
 */

/** @type {Record<string, FeatureGate>} */
export const FEATURE_GATES = {
  beginner: {     // 6-8세 — 핵심 3개 메뉴만, 인지 과부하 방지
    nav: ['/books', '/vocabulary', '/profile'],
    showLibrary: false,
    showReview: false,    // 세션 종료 후 자동으로 리뷰로 이동
    showDashboard: false,
    itemsPerScreen: 3,
    fontSize: 18,
    touchTarget: 64,
  },
  intermediate: {  // 9-11세 — Library·Studio 추가
    nav: ['/books', '/library', '/review', '/vocabulary', '/profile'],
    showLibrary: true,
    showReview: true,
    showDashboard: false,
    itemsPerScreen: 5,
    fontSize: 16,
    touchTarget: 52,
  },
  advanced: {      // 12-13세 — 전체 기능
    nav: ['/?landing=1', '/books', '/library', '/review', '/vocabulary', '/profile'],
    showLibrary: true,
    showReview: true,
    showDashboard: true,
    itemsPerScreen: 6,
    fontSize: 14,
    touchTarget: 48,
  },
};

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * 현재 학생 레벨의 feature gates를 반환한다.
 *
 * - SSR 환경에서는 advanced(전체 공개) fallback 반환
 * - 알 수 없는 레벨 값도 advanced로 fallback
 *
 * @returns {FeatureGate}
 */
export function getFeatureGates() {
  if (typeof window === 'undefined') {
    // SSR fallback: 전체 메뉴를 노출해 hydration mismatch 방지
    return FEATURE_GATES.advanced;
  }

  // clientStorage.getItem은 sessionStorage → localStorage 순으로 읽음
  const level = getItem('studentLevel') || 'advanced';
  return FEATURE_GATES[level] ?? FEATURE_GATES.advanced;
}

/**
 * 특정 경로가 현재 레벨에서 접근 가능한지 확인한다.
 *
 * 매칭 전략: gate 경로가 href의 시작 부분과 일치하면 허용.
 * 예) gate '/books' → href '/books/123' 허용
 *
 * @param {string} href - 확인할 경로 (예: '/library', '/books/detail')
 * @returns {boolean}
 */
export function isNavAllowed(href) {
  const gates = getFeatureGates();
  return gates.nav.some((path) => href.startsWith(path));
}
