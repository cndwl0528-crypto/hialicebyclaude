// k6 full session flow simulation for Hi Alice backend
// Simulates a complete student session: health check -> browse books ->
// get experiment variants -> start session -> conversation turns -> complete session.
// Runs with 500 concurrent VUs, 20 iterations each (10,000 total session simulations).

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { BASE_URL, THRESHOLDS, SCENARIOS, MOCK_STUDENTS, MOCK_BOOKS } from './config.js';

const sessionFlowLatency = new Trend('session_flow_latency');
const sessionFlowErrors = new Rate('session_flow_errors');

export const options = {
  scenarios: {
    concurrent: SCENARIOS.concurrent_sessions,
  },
  thresholds: {
    ...THRESHOLDS,
    session_flow_latency: ['p(95)<1000'],
    session_flow_errors: ['rate<0.10'],
  },
};

export default function () {
  const student = MOCK_STUDENTS[__VU % MOCK_STUDENTS.length];
  const book = MOCK_BOOKS[__ITER % MOCK_BOOKS.length];
  const headers = { 'Content-Type': 'application/json' };

  // Step 1: Health check (warm-up / circuit breaker gate)
  group('Step 1: Health Check', () => {
    const res = http.get(`${BASE_URL}/health`);
    sessionFlowLatency.add(res.timings.duration);

    const passed = check(res, {
      'health: status 200': (r) => r.status === 200,
      'health: service ok': (r) => {
        try {
          return r.json().status === 'ok';
        } catch {
          return false;
        }
      },
    });

    if (!passed) sessionFlowErrors.add(1);
    else sessionFlowErrors.add(0);
  });

  sleep(0.2);

  // Step 2: Browse available books
  group('Step 2: Browse Books', () => {
    const res = http.get(`${BASE_URL}/api/books`, { headers });
    sessionFlowLatency.add(res.timings.duration);

    const passed = check(res, {
      'books: available': (r) => r.status === 200,
      'books: response < 500ms': (r) => r.timings.duration < 500,
    });

    if (!passed) sessionFlowErrors.add(1);
    else sessionFlowErrors.add(0);
  });

  sleep(0.2);

  // Step 3: Retrieve experiment variant for this student
  group('Step 3: Get Experiment Variants', () => {
    const res = http.get(
      `${BASE_URL}/api/experiments/ai_model/variant?studentId=${student.id}`,
      { headers }
    );
    sessionFlowLatency.add(res.timings.duration);

    const passed = check(res, {
      'variant: assigned': (r) => r.status === 200,
      'variant: has value': (r) => {
        try {
          return typeof r.json().data?.variant === 'string';
        } catch {
          return false;
        }
      },
    });

    if (!passed) sessionFlowErrors.add(1);
    else sessionFlowErrors.add(0);
  });

  sleep(0.2);

  // Step 4: Track session start event
  group('Step 4: Start Session', () => {
    const payload = JSON.stringify({
      experimentName: 'session_turns',
      variant: 'control',
      event: 'session_start',
      metadata: {
        bookId: book.id,
        bookTitle: book.title,
        studentLevel: student.level,
        studentAge: student.age,
      },
      studentId: student.id,
      timestamp: new Date().toISOString(),
    });

    const res = http.post(`${BASE_URL}/api/experiments/track`, payload, { headers });
    sessionFlowLatency.add(res.timings.duration);

    const passed = check(res, {
      'session start: tracked': (r) => r.status === 201,
      'session start: response < 800ms': (r) => r.timings.duration < 800,
    });

    if (!passed) sessionFlowErrors.add(1);
    else sessionFlowErrors.add(0);
  });

  sleep(0.5);

  // Step 5: Simulate age-appropriate conversation turns
  group('Step 5: Conversation Turns', () => {
    // Younger students get fewer turns to match their session length targets
    const turns = student.age < 9 ? 4 : student.age < 12 ? 5 : 6;
    const stages = [
      'warm_connection',
      'title',
      'introduction',
      'body',
      'conclusion',
      'cross_book',
    ];

    for (let t = 0; t < turns; t++) {
      const payload = JSON.stringify({
        experimentName: 'ai_model',
        variant: 'haiku_boost',
        event: 'turn_complete',
        metadata: {
          turnNumber: t + 1,
          stage: stages[t % stages.length],
          responseLength: Math.floor(Math.random() * 200) + 50,
        },
        studentId: student.id,
        timestamp: new Date().toISOString(),
      });

      const res = http.post(`${BASE_URL}/api/experiments/track`, payload, { headers });
      sessionFlowLatency.add(res.timings.duration);

      const passed = check(res, {
        [`turn ${t + 1}: tracked`]: (r) => r.status === 201,
      });

      if (!passed) sessionFlowErrors.add(1);
      else sessionFlowErrors.add(0);

      sleep(0.1);
    }
  });

  sleep(0.3);

  // Step 6: Track session completion with outcome metrics
  group('Step 6: Complete Session', () => {
    const payload = JSON.stringify({
      experimentName: 'ai_model',
      variant: 'haiku_boost',
      event: 'session_complete',
      metadata: {
        bookId: book.id,
        grammarScore: Math.floor(Math.random() * 30) + 65,
        wordsLearned: Math.floor(Math.random() * 8) + 3,
        duration: Math.floor(Math.random() * 600) + 300,
      },
      studentId: student.id,
      timestamp: new Date().toISOString(),
    });

    const res = http.post(`${BASE_URL}/api/experiments/track`, payload, { headers });
    sessionFlowLatency.add(res.timings.duration);

    const passed = check(res, {
      'session complete: tracked': (r) => r.status === 201,
      'session complete: response < 800ms': (r) => r.timings.duration < 800,
    });

    if (!passed) sessionFlowErrors.add(1);
    else sessionFlowErrors.add(0);
  });

  sleep(0.5);
}
