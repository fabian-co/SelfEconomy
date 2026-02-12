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

function getPythonPath() {
  const isWindows = os.platform() === 'win32';
  const venvPath = path.resolve(process.cwd(), VENV_DIR);

  if (isWindows) {
    return path.join(venvPath, 'Scripts', 'python.exe');
  } else {
    return path.join(venvPath, 'bin', 'python');
  }
}

function getPipPath() {
  const isWindows = os.platform() === 'win32';
  const venvPath = path.resolve(process.cwd(), VENV_DIR);

  if (isWindows) {
    return path.join(venvPath, 'Scripts', 'pip.exe');
  } else {
    return path.join(venvPath, 'bin', 'pip');
  }
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

async function main() {
  try {
    if (!checkVenvExists()) {
      await createVenv();
    }

    // Ensure venv is used
    process.env.VIRTUAL_ENV = path.resolve(process.cwd(), VENV_DIR);
    const binDir = os.platform() === 'win32' ? 'Scripts' : 'bin';
    process.env.PATH = path.join(process.env.VIRTUAL_ENV, binDir) + path.delimiter + process.env.PATH;

    await installDependencies();
    startNextDev();
  } catch (error) {
    log(`Error: ${error.message}`, colors.red);
    process.exit(1);
  }
}

main();
