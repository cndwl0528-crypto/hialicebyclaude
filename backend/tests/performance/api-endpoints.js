// k6 core API endpoint performance tests for Hi Alice backend
// Covers books, experiments, variant assignment, event tracking, and book clubs
// under ramping load conditions up to 500 VUs.

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { BASE_URL, THRESHOLDS, SCENARIOS, MOCK_STUDENTS, MOCK_BOOKS } from './config.js';

const apiLatency = new Trend('api_latency');
const apiErrors = new Rate('api_errors');
const requestCount = new Counter('total_requests');

export const options = {
  scenarios: {
    load: SCENARIOS.load,
  },
  thresholds: {
    ...THRESHOLDS,
    api_latency: ['p(95)<800', 'p(99)<2000'],
    api_errors: ['rate<0.05'],
  },
};

export default function () {
  const student = MOCK_STUDENTS[__VU % MOCK_STUDENTS.length];
  const book = MOCK_BOOKS[__ITER % MOCK_BOOKS.length];
  const headers = { 'Content-Type': 'application/json' };

  // 1. GET /api/books — Book listing
  group('Books API', () => {
    const res = http.get(`${BASE_URL}/api/books`, { headers });
    apiLatency.add(res.timings.duration);
    requestCount.add(1);

    const passed = check(res, {
      'books: status 200': (r) => r.status === 200,
      'books: has data': (r) => {
        try {
          const body = r.json();
          return body.data !== undefined || Array.isArray(body);
        } catch {
          return false;
        }
      },
      'books: response < 500ms': (r) => r.timings.duration < 500,
    });

    if (!passed) apiErrors.add(1);
    else apiErrors.add(0);
  });

  sleep(0.3);

  // 2. GET /api/experiments — Experiment listing
  group('Experiments API', () => {
    const res = http.get(`${BASE_URL}/api/experiments`, { headers });
    apiLatency.add(res.timings.duration);
    requestCount.add(1);

    const passed = check(res, {
      'experiments: status 200': (r) => r.status === 200,
      'experiments: has experiments array': (r) => {
        try {
          return r.json().data?.experiments !== undefined;
        } catch {
          return false;
        }
      },
      'experiments: response < 500ms': (r) => r.timings.duration < 500,
    });

    if (!passed) apiErrors.add(1);
    else apiErrors.add(0);
  });

  sleep(0.3);

  // 3. GET /api/experiments/:name/variant — Variant assignment
  group('Variant Assignment', () => {
    const experiments = [
      'session_turns',
      'reward_type',
      'pre_reading',
      'vocab_timing',
      'ai_model',
    ];

    for (const exp of experiments) {
      const res = http.get(
        `${BASE_URL}/api/experiments/${exp}/variant?studentId=${student.id}`,
        { headers }
      );
      apiLatency.add(res.timings.duration);
      requestCount.add(1);

      const passed = check(res, {
        [`variant ${exp}: status 200`]: (r) => r.status === 200,
        [`variant ${exp}: has variant string`]: (r) => {
          try {
            return typeof r.json().data?.variant === 'string';
          } catch {
            return false;
          }
        },
        [`variant ${exp}: response < 500ms`]: (r) => r.timings.duration < 500,
      });

      if (!passed) apiErrors.add(1);
      else apiErrors.add(0);
    }
  });

  sleep(0.3);

  // 4. POST /api/experiments/track — Event tracking
  group('Event Tracking', () => {
    const payload = JSON.stringify({
      experimentName: 'ai_model',
      variant: 'haiku_boost',
      event: 'session_complete',
      metadata: {
        grammarScore: 78,
        duration: 420,
      },
      studentId: student.id,
      timestamp: new Date().toISOString(),
    });

    const res = http.post(`${BASE_URL}/api/experiments/track`, payload, { headers });
    apiLatency.add(res.timings.duration);
    requestCount.add(1);

    const passed = check(res, {
      'track: status 201': (r) => r.status === 201,
      'track: has event id': (r) => {
        try {
          return typeof r.json().data?.id === 'number';
        } catch {
          return false;
        }
      },
      'track: response < 800ms': (r) => r.timings.duration < 800,
    });

    if (!passed) apiErrors.add(1);
    else apiErrors.add(0);
  });

  sleep(0.3);

  // 5. GET /api/book-clubs — Book club listing
  group('Book Clubs API', () => {
    const res = http.get(`${BASE_URL}/api/book-clubs`, { headers });
    apiLatency.add(res.timings.duration);
    requestCount.add(1);

    const passed = check(res, {
      'clubs: status 200': (r) => r.status === 200,
      'clubs: response < 500ms': (r) => r.timings.duration < 500,
    });

    if (!passed) apiErrors.add(1);
    else apiErrors.add(0);
  });

  // Suppress unused variable warning — book is used in session-flow.js
  void book;

  sleep(0.5);
}
