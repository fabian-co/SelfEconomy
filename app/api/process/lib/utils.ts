import path from 'path';

export const normalizeText = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

export const getSourcePath = (filePath: string) => {
  return path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), 'app', 'api', 'extracto', filePath);
};

export const getPythonPath = () => path.join(process.cwd(), 'venv', 'Scripts', 'python.exe');
export const getScriptPath = (name: string) => path.join(process.cwd(), 'app', 'api', 'py', name);
export const getRootDirTemp = () => path.join(process.cwd(), 'temp');
export const getRootDirTempTxt = () => path.join(getRootDirTemp(), 'txt');
export const getRootDirTempTemplates = () => path.join(getRootDirTemp(), 'templates');
export const getRootDirTempProcessed = () => path.join(getRootDirTemp(), 'processed');

export const getTemplatesDir = () => path.join(process.cwd(), 'custom-data', 'templates');
export const getTempTemplatesDir = () => getRootDirTempTemplates();
export const getProcessedDir = () => path.join(process.cwd(), 'app', 'api', 'extracto', 'processed');
export const getTempProcessedDir = () => getRootDirTempProcessed();
export const getTempPreprocessedDir = () => path.join(getRootDirTemp(), 'preprocessed');
export const getTempDir = () => getRootDirTempTxt();
