import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const isWin = process.platform === 'win32';
const venvPyWin = path.join(process.cwd(), 'backend', 'venv', 'Scripts', 'python.exe');
const venvPyUnix = path.join(process.cwd(), 'backend', 'venv', 'bin', 'python');

let pyExec = 'python';
if (isWin && fs.existsSync(venvPyWin)) {
  pyExec = venvPyWin;
} else if (!isWin && fs.existsSync(venvPyUnix)) {
  pyExec = venvPyUnix;
}

const args = ['-m', 'uvicorn', 'backend.app.main:app', '--host', '0.0.0.0', '--port', '8000', '--reload'];

const child = spawn(pyExec, args, { stdio: 'inherit', shell: false, cwd: process.cwd() });

child.on('exit', (code) => {
  process.exit(code || 0);
});

process.on('SIGINT', () => {
  child.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  child.kill('SIGTERM');
  process.exit(0);
});
