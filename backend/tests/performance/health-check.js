// k6 health endpoint performance tests for Hi Alice backend
// Tests /health and /health/db endpoints under smoke load conditions.

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { BASE_URL, THRESHOLDS, SCENARIOS } from './config.js';

const healthLatency = new Trend('health_latency');
const healthDbLatency = new Trend('health_db_latency');
const healthFailRate = new Rate('health_fail_rate');

export const options = {
  scenarios: {
    smoke: SCENARIOS.smoke,
  },
  thresholds: {
    ...THRESHOLDS,
    health_latency: ['p(95)<100'],
    health_db_latency: ['p(95)<300'],
    health_fail_rate: ['rate<0.01'],
  },
};

export default function () {
  group('Health Check - Basic', () => {
    const res = http.get(`${BASE_URL}/health`);
    healthLatency.add(res.timings.duration);

    const passed = check(res, {
      'status is 200': (r) => r.status === 200,
      'response has ok status': (r) => {
        try {
          const body = r.json();
          return body && body.status === 'ok';
        } catch {
          return false;
        }
      },
      'response has service name': (r) => {
        try {
          const body = r.json();
          return body && body.service === 'hialice-backend';
        } catch {
          return false;
        }
      },
      'response time < 100ms': (r) => r.timings.duration < 100,
    });

    if (!passed) healthFailRate.add(1);
    else healthFailRate.add(0);
  });

  group('Health Check - Database', () => {
    const res = http.get(`${BASE_URL}/health/db`);
    healthDbLatency.add(res.timings.duration);

    check(res, {
      'status is 200 or 503': (r) => r.status === 200 || r.status === 503,
      'response has database field': (r) => {
        try {
          const body = r.json();
          return body && 'database' in body;
        } catch {
          return false;
        }
      },
      'response time < 300ms': (r) => r.timings.duration < 300,
    });
  });

  sleep(0.5);
}
