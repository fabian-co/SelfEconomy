const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Configuration
const VENV_DIR = 'venv';
const REQUIREMENTS_FILE = 'requirements.txt';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}


function getVenvBinDir() {
  const venvPath = path.resolve(process.cwd(), VENV_DIR);
  // Standard virtualenv structure:
  // Windows: venv/Scripts
  // Unix/MacOS: venv/bin
  const scriptsPath = path.join(venvPath, 'Scripts');
  const binPath = path.join(venvPath, 'bin');

  // Check what actually exists
  if (fs.existsSync(scriptsPath)) {
    // If Scripts exists, it's likely a Windows-created venv
    return scriptsPath;
  } else if (fs.existsSync(binPath)) {
    // If bin exists, it's likely a Unix-created venv
    return binPath;
  }

  // If neither exists yet (not created), rely on OS to guess what *will* be created
  return os.platform() === 'win32' ? scriptsPath : binPath;
}

function getPythonPath() {
  const binDir = getVenvBinDir();
  const isWindows = os.platform() === 'win32';
  return path.join(binDir, isWindows ? 'python.exe' : 'python');
}

function getPipPath() {
  const binDir = getVenvBinDir();
  const isWindows = os.platform() === 'win32';
  return path.join(binDir, isWindows ? 'pip.exe' : 'pip');
}

function checkVenvExists() {
  const venvPath = path.resolve(process.cwd(), VENV_DIR);
  return fs.existsSync(venvPath);
}

function createVenv() {
  return new Promise((resolve, reject) => {
    log('Creating Python virtual environment...', colors.cyan);
    const pythonCommand = os.platform() === 'win32' ? 'python' : 'python3';

    const childProcess = spawn(pythonCommand, ['-m', 'venv', VENV_DIR], { stdio: 'inherit' });

    childProcess.on('close', (code) => {
      if (code === 0) {
        log('Virtual environment created successfully.', colors.green);
        resolve();
      } else {
        reject(new Error(`Failed to create virtual environment. Exit code: ${code}`));
      }
    });
  });
}

function installDependencies() {
  return new Promise((resolve, reject) => {
    const pipPath = getPipPath();
    const requirementsPath = path.resolve(process.cwd(), REQUIREMENTS_FILE);

    if (!fs.existsSync(requirementsPath)) {
      log('No requirements.txt found. Skipping dependency installation.', colors.yellow);
      resolve();
      return;
    }

    log('Checking and installing Python dependencies...', colors.cyan);

    const childProcess = spawn(pipPath, ['install', '-r', requirementsPath], { stdio: 'inherit' });

    childProcess.on('close', (code) => {
      if (code === 0) {
        log('Python dependencies are up to date.', colors.green);
        resolve();
      } else {
        reject(new Error(`Failed to install dependencies. Exit code: ${code}`));
      }
    });
  });
}

function startNextDev() {
  log('Starting Next.js development server...', colors.cyan);

  const nextCmd = os.platform() === 'win32' ? 'npx.cmd' : 'npx';
  const nextArgs = ['next', 'dev'];

  const childProcess = spawn(nextCmd, nextArgs, { stdio: 'inherit', shell: true });

  childProcess.on('close', (code) => {
    log(`Next.js server exited with code ${code}`, code === 0 ? colors.green : colors.red);
    process.exit(code);
  });
}

const net = require('net');
const readline = require('readline');

// ... existing code ...

function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true); // Port is in use
      } else {
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(false); // Port is free
    });
    server.listen(port);
  });
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function killProcessOnPort(port) {
  return new Promise((resolve, reject) => {
    log(`Attempting to kill process on port ${port}...`, colors.yellow);

    const isWindows = os.platform() === 'win32';

    if (isWindows) {
      // Find PID and kill
      const findCmd = `netstat -ano | findstr :${port}`;
      // This is complex to parse in one go reliably across localized windows versions without a robust library.
      // Simplified approach: use npx kill-port if available? No external deps if possible.
      // Let's use a robust powershell command or just try to find the PID.
      // Actually, for a dev script, we can ask user or just fail.
      // BUT, user asked for it. 
      // Let's try a cross-platform command 'npx kill-port 3000' usage?
      // No, we should avoid extra deps.

      // Let's use a simpler approach: Just tell the user or try a known command.

      // Or better: use 'taskkill' if we knew the PID.
      // To get PID:
      const exec = require('child_process').exec;
      exec(`netstat -ano | findstr :${port}`, (err, stdout) => {
        if (err || !stdout) {
          // Maybe no process found or error?
          resolve(false);
          return;
        }

        // Parse the connection lines, look for LISTENING
        const lines = stdout.trim().split('\n');
        const listeningLine = lines.find(line => line.includes('LISTENING'));

        if (!listeningLine) {
          resolve(false);
          return;
        }

        // Extract PID (last token)
        const parts = listeningLine.trim().split(/\s+/);
        const pid = parts[parts.length - 1];

        if (pid && /^\d+$/.test(pid)) {
          exec(`taskkill /F /PID ${pid}`, (killErr) => {
            if (killErr) {
              log(`Failed to kill process ${pid}: ${killErr.message}`, colors.red);
              resolve(false);
            } else {
              log(`Successfully killed process ${pid} on port ${port}.`, colors.green);
              // Wait a moment for OS to release resources
              setTimeout(() => resolve(true), 1000);
            }
          });
        } else {
          resolve(false);
        }
      });

    } else {
      // Unix (lsof -i :3000 -t | xargs kill -9)
      const cmd = `lsof -i :${port} -t | xargs kill -9`;
      const exec = require('child_process').exec;
      exec(cmd, (err) => {
        if (err) {
          log(`Failed to kill process on port ${port}: ${err.message}`, colors.red);
          resolve(false);
        } else {
          log(`Successfully killed process on port ${port}.`, colors.green);
          setTimeout(() => resolve(true), 1000);
        }
      });
    }
  });
}

async function main() {
  try {
    const isPortInUse = await checkPort(3000);

    if (isPortInUse) {
      log('Port 3000 is currently in use.', colors.yellow);
      const answer = await askQuestion('Do you want to kill the process running on port 3000 to free the lock? (y/N): ');

      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        const killed = await killProcessOnPort(3000);
        if (!killed) {
          log('Could not kill process. Next.js might fail or use a different port.', colors.red);
        }
      } else {
        log('Proceeding without killing process. Next.js will likely try port 3001 but might fail on lock.', colors.yellow);
      }
    }

    if (!checkVenvExists()) {
      await createVenv();
    }

    // Ensure venv is used
    process.env.VIRTUAL_ENV = path.resolve(process.cwd(), VENV_DIR);
    const binDir = getVenvBinDir();
    process.env.PATH = binDir + path.delimiter + process.env.PATH;

    await installDependencies();
    startNextDev();
  } catch (error) {
    log(`Error: ${error.message}`, colors.red);
    process.exit(1);
  }
}

main();
