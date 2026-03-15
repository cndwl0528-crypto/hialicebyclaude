/**
 * monitoring.js
 * HiAlice — Monitoring API Routes
 *
 * Exposes operational telemetry for the admin monitoring dashboard:
 *   GET /api/monitoring/stats   — cost + usage statistics + system health
 *   GET /api/monitoring/health  — lightweight liveness/readiness check
 *
 * These endpoints are intentionally unauthenticated for internal/ops tooling.
 * If this backend is ever exposed to the public internet, protect them with
 * authMiddleware or an IP allowlist before shipping.
 */

import express from 'express';
import { getUsageStats } from '../services/costTracker.js';

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/monitoring/stats
// Returns aggregated Claude API cost and token stats plus system health info.
// ---------------------------------------------------------------------------
router.get('/stats', (req, res) => {
  const stats = getUsageStats();

  const memUsage = process.memoryUsage();
  const health = {
    uptime:      process.uptime(),
    memoryMB: {
      rss:       Math.round(memUsage.rss        / 1024 / 1024),
      heapUsed:  Math.round(memUsage.heapUsed   / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal  / 1024 / 1024),
      external:  Math.round(memUsage.external   / 1024 / 1024),
    },
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    pid:         process.pid,
  };

  return res.json({ ...stats, health });
});

// ---------------------------------------------------------------------------
// GET /api/monitoring/health
// Lightweight liveness check — responds quickly for load-balancer probes.
// ---------------------------------------------------------------------------
router.get('/health', (req, res) => {
  return res.json({
    status:   'healthy',
    uptime:   Math.floor(process.uptime()),
    memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    timestamp: new Date().toISOString(),
  });
});

export default router;
