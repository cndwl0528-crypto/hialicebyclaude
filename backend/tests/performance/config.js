// k6 performance test configuration for Hi Alice backend

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

export const THRESHOLDS = {
  http_req_duration: ['p(95)<500', 'p(99)<1500'],
  http_req_failed: ['rate<0.05'],
  http_reqs: ['rate>100'],
};

export const SCENARIOS = {
  smoke: {
    executor: 'constant-vus',
    vus: 5,
    duration: '30s',
    tags: { test_type: 'smoke' },
  },
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 50 },
      { duration: '3m', target: 200 },
      { duration: '2m', target: 500 },
      { duration: '1m', target: 0 },
    ],
    tags: { test_type: 'load' },
  },
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 100 },
      { duration: '2m', target: 500 },
      { duration: '2m', target: 1000 },
      { duration: '3m', target: 2000 },
      { duration: '1m', target: 0 },
    ],
    tags: { test_type: 'stress' },
  },
  spike: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '10s', target: 2000 },
      { duration: '1m', target: 2000 },
      { duration: '10s', target: 0 },
    ],
    tags: { test_type: 'spike' },
  },
  concurrent_sessions: {
    executor: 'per-vu-iterations',
    vus: 500,
    iterations: 20,
    maxDuration: '10m',
    tags: { test_type: 'concurrent_sessions' },
  },
};

// Mock student data for session simulation
export const MOCK_STUDENTS = Array.from({ length: 100 }, (_, i) => ({
  id: `perf-student-${i}`,
  name: `PerfStudent${i}`,
  level: ['beginner', 'intermediate', 'advanced'][i % 3],
  age: 6 + (i % 8),
}));

export const MOCK_BOOKS = [
  { id: 'book-1', title: "Charlotte's Web" },
  { id: 'book-2', title: 'The Giving Tree' },
  { id: 'book-3', title: 'Where the Wild Things Are' },
  { id: 'book-4', title: 'Matilda' },
  { id: 'book-5', title: 'The BFG' },
];
