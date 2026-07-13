import { execSync } from 'child_process';

export function detectPortsByPID(pid) {
  try {
    const output = execSync('ss -tlnp 2>/dev/null', { timeout: 3000 });
    const lines = output.toString().split('\n');
    const ports = new Set();
    for (const line of lines) {
      const pidMatch = line.match(new RegExp(`pid=${pid}(?:,|\\s|\\))`));
      if (pidMatch) {
        const portMatch = line.match(/:(\d+)\s/);
        if (portMatch) ports.add(parseInt(portMatch[1], 10));
      }
    }
    return [...ports];
  } catch (err) { console.log('[portDetector] Error al detectar puertos:', err.message); return []; }
}

export async function waitForPortsByPID(pid, timeout = 15000, interval = 500) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const ports = detectPortsByPID(pid);
    if (ports.length > 0) return ports[0];
    await new Promise(r => setTimeout(r, interval));
  }
  return null;
}
