export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const fs = await import('fs');
    const path = await import('path');

    const processedDir = path.join(process.cwd(), 'app', 'api', 'extracto', 'processed');

    try {
      // Check if directory exists
      await fs.promises.access(processedDir);
    } catch (error) {
      // Directory doesn't exist, create it
      try {
        await fs.promises.mkdir(processedDir, { recursive: true });
        console.log(`[Instrumentation] Created directory: ${processedDir}`);
      } catch (mkdirError) {
        console.error(`[Instrumentation] Failed to create directory: ${processedDir}`, mkdirError);
      }
    }
  }
}

