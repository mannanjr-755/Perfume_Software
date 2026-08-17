import { execSync } from 'child_process';

const ports = [5000, 5173];

for (const port of ports) {
  try {
    if (process.platform === 'win32') {
      const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      const lines = result.trim().split('\n').filter((l) => l.includes('LISTENING'));
      const pids = new Set();
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0') pids.add(pid);
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
          console.log(`[ports] Freed port ${port} (PID ${pid})`);
        } catch {
          /* ignore */
        }
      }
    } else {
      execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' });
      console.log(`[ports] Freed port ${port}`);
    }
  } catch {
    /* port not in use */
  }
}
