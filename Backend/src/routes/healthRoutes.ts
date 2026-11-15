import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { pool } from '../config/database';

const router = Router();

// Process start time for uptime calculation
const START_TIME = Date.now();

// Read package.json version once at startup
let APP_VERSION = 'unknown';
try {
  const pkg = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')
  );
  APP_VERSION = pkg.version ?? 'unknown';
} catch {
  // Non-fatal — version is informational only
}

// ============================================================================
// GET /health/live
// Lightweight liveness probe — just confirms the Node.js process is alive.
// Use this for container restart decisions (Kubernetes liveness probe).
// ============================================================================
router.get('/live', (_req: Request, res: Response) => {
  const uptimeSeconds = Math.floor((Date.now() - START_TIME) / 1000);
  res.status(200).json({
    status: 'ok',
    api: 'EduFlow Backend',
    version: APP_VERSION,
    uptime: `${uptimeSeconds}s`,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// GET /health/ready
// Deep readiness probe — checks all critical dependencies are reachable.
// Returns 503 if any dependency is unavailable.
// Use this for load-balancer traffic routing decisions.
// ============================================================================
router.get('/ready', async (_req: Request, res: Response) => {
  const checks: Record<string, { status: 'ok' | 'error'; detail?: string }> = {};
  let isReady = true;

  // --- Check 1: Database connectivity ---
  try {
    const conn = await pool.getConnection();
    await conn.query('SELECT 1');
    conn.release();
    checks.database = { status: 'ok' };
  } catch (err: any) {
    checks.database = { status: 'error', detail: 'Database unreachable' };
    isReady = false;
  }

  // --- Check 2: Uploads directory accessible ---
  const uploadsDir = path.resolve(__dirname, '../../uploads');
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    fs.accessSync(uploadsDir, fs.constants.R_OK | fs.constants.W_OK);
    checks.storage = { status: 'ok' };
  } catch {
    checks.storage = { status: 'error', detail: 'Uploads directory is not accessible' };
    isReady = false;
  }

  // --- Check 3: Backup directory writable ---
  const backupDir = path.resolve(__dirname, '../../backups');
  try {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    fs.accessSync(backupDir, fs.constants.R_OK | fs.constants.W_OK);
    checks.backups = { status: 'ok' };
  } catch {
    checks.backups = { status: 'error', detail: 'Backup directory is not accessible' };
    isReady = false;
  }

  const httpStatus = isReady ? 200 : 503;
  res.status(httpStatus).json({
    status: isReady ? 'ready' : 'not ready',
    checks,
    timestamp: new Date().toISOString(),
  });
});

export default router;
