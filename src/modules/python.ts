import axios from "axios";
import { platform, machine } from "os";
import * as tar from "tar";
import { spawn } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs/promises";

export class PythonService {
  private static readonly SCRIBE_DIR_NAME = "scribe-server";
  private static readonly PYTHON_DIR_NAME = "python";
  private static readonly APP_VENV_DIR_NAME = "app-venv";
  private static readonly EXEC_DIR_NAME = platform() === "win32" ? "Scripts" : "bin";

  private static scribeDir: string;
  private static pythonDir: string;
  private static venvDir: string;
  private static venvPythonPath: string;

  async init(): Promise<void> {
    const homeDir = process.env.HOME || process.env.USERPROFILE || "";
    if (!homeDir) {
      throw new Error("Could not determine home directory");
    }

    PythonService.scribeDir = path.join(homeDir, PythonService.SCRIBE_DIR_NAME);
    PythonService.pythonDir = path.join(PythonService.scribeDir, PythonService.PYTHON_DIR_NAME);
    PythonService.venvDir = path.join(PythonService.scribeDir, PythonService.APP_VENV_DIR_NAME);
    PythonService.venvPythonPath = path.join(
      PythonService.venvDir,
      PythonService.EXEC_DIR_NAME,
      platform() === "win32" ? "python.exe" : "python"
    );
  }

  getScribeDir(): string {
    if (!PythonService.scribeDir) {
      throw new Error("PythonService not initialized. Call init() first.");
    }
    return PythonService.scribeDir;
  }

  getPythonDir(): string {
    if (!PythonService.pythonDir) {
      throw new Error("PythonService not initialized. Call init() first.");
    }
    return PythonService.pythonDir;
  }

  getVenvDir(): string {
    if (!PythonService.venvDir) {
      throw new Error("PythonService not initialized. Call init() first.");
    }
    return PythonService.venvDir;
  }

  async setupEnvironment(): Promise<void> {
    await this.init();
    await this.ensureScribeDir();
    await this.ensurePython();
    await this.ensureVirtualEnv();
  }

  private async ensureScribeDir(): Promise<void> {
    try {
      await fs.mkdir(PythonService.scribeDir, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
  }

  private async ensurePython(): Promise<void> {
    const existingPython = await this.findExistingPython();
    if (existingPython) {
      if (await this.isPython313(existingPython)) {
        return;
      }
    }

    await this.downloadAndExtractPython();
  }

  private async findExistingPython(): Promise<string | null> {
    const pythonExe = platform() === "win32" ? "python.exe" : "python";
    const locations = [
      path.join(PythonService.pythonDir, PythonService.EXEC_DIR_NAME, pythonExe),
      path.join(PythonService.pythonDir, "bin", pythonExe),
      path.join(PythonService.pythonDir, pythonExe)
    ];
    
    for (const location of locations) {
      if (await this.fileExists(location)) {
        return location;
      }
    }
    
    return null;
  }

  private findPythonExecutable(): string {
    const pythonExe = platform() === "win32" ? "python.exe" : "python";
    const locations = [
      path.join(PythonService.pythonDir, PythonService.EXEC_DIR_NAME, pythonExe),
      path.join(PythonService.pythonDir, "bin", pythonExe),
      path.join(PythonService.pythonDir, pythonExe)
    ];
    
    return locations[0];
  }

  private async isPython313(pythonPath: string): Promise<boolean> {
    try {
      const result = await this.runCommand(pythonPath, ["--version"]);
      return result.includes("Python 3.13");
    } catch {
      return false;
    }
  }

  private async downloadAndExtractPython(): Promise<void> {
    const downloadUrl = this.getPythonDownloadUrl();
    const fileName = downloadUrl.split("/").pop()!;
    const downloadPath = path.join(PythonService.scribeDir, fileName);

    const response = await axios({
      url: downloadUrl,
      method: "GET",
      responseType: "arraybuffer",
    });

    await fs.writeFile(downloadPath, Buffer.from(response.data));

    await tar.x({
      cwd: PythonService.scribeDir,
      file: downloadPath,
      gzip: true,
    });

    await fs.unlink(downloadPath);
    await this.findExtractedPython();
  }

  private async findExtractedPython(): Promise<void> {
    const items = await fs.readdir(PythonService.scribeDir);
    const pythonExe = platform() === "win32" ? "python.exe" : "python";

    for (const item of items) {
      const itemPath = path.join(PythonService.scribeDir, item);
      const stats = await fs.stat(itemPath);
      
      if (stats.isDirectory() && item.includes("python")) {
        const possiblePaths = [
          path.join(itemPath, PythonService.EXEC_DIR_NAME, pythonExe),
          path.join(itemPath, "bin", pythonExe),
          path.join(itemPath, pythonExe)
        ];

        for (const possiblePath of possiblePaths) {
          if (await this.fileExists(possiblePath)) {
            PythonService.pythonDir = itemPath;
            return;
          }
        }
      }
    }

    throw new Error("Could not find Python executable after extraction");
  }

  private getPythonDownloadUrl(): string {
    const arch = machine() === "x86_64" ? "x64" : "arm64";
    const key = `${platform()}-${arch}` as keyof typeof PYTHON_DOWNLOADS;
    const url = PYTHON_DOWNLOADS[key];

    if (!url) {
      throw new Error(`Unsupported platform: ${key}`);
    }

    return url;
  }

  private async ensureVirtualEnv(): Promise<void> {
    if (await this.fileExists(PythonService.venvPythonPath)) {
      return;
    }

    await fs.rm(PythonService.venvDir, { recursive: true, force: true });
    await fs.mkdir(PythonService.venvDir, { recursive: true });

    const pythonExe = await this.findExistingPython();
    if (!pythonExe || !(await this.fileExists(pythonExe))) {
      throw new Error(`Python executable not found. Please ensure Python is installed or run setup first.`);
    }

    await this.runCommand(pythonExe, ["-m", "venv", PythonService.venvDir]);
  }

  async setupWildebeest(): Promise<void> {
    await this.setupEnvironment();

    if (!(await this.fileExists(PythonService.venvPythonPath))) {
      throw new Error(`Virtual environment Python not found at: ${PythonService.venvPythonPath}`);
    }

    const env: Record<string, string | undefined> = {
      ...process.env,
      PYTHONHTTPSVERIFY: "1",
      PYTHONIOENCODING: "utf-8",
    };

    delete env.PGSSLCERT;
    delete env.PGSSLKEY;
    delete env.PGSSLROOTCERT;
    delete env.PGSSLCRL;
    delete env.PGSSLMODE;
    delete env.SSL_CERT_FILE;
    delete env.SSL_CERT_DIR;

    const filteredEnv: Record<string, string> = Object.fromEntries(
      Object.entries(env).filter(([_, value]) => value !== undefined)
    ) as Record<string, string>;

    await this.runCommand(
      PythonService.venvPythonPath,
      [
        "-m", "pip", "install",
        "--trusted-host", "pypi.org",
        "--trusted-host", "pypi.python.org",
        "--trusted-host", "files.pythonhosted.org",
        "wildebeest-nlp"
      ],
      { env: filteredEnv }
    );
  }

  private cleanUnicodeText(text: string): string {
    try {
      let cleanedText = typeof text === 'string' ? text : String(text);
      
      cleanedText = cleanedText.replace(/[\uD800-\uDFFF]/g, '');
      
      cleanedText = cleanedText.replace(/[\uFFFE\uFFFF\uFEFF]/g, '');
      
      cleanedText = cleanedText.replace(/[\uFFFD]/g, '');
      
      cleanedText = cleanedText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
      
      cleanedText = cleanedText.normalize('NFC');
      
      const buffer = Buffer.from(cleanedText, 'utf8');
      cleanedText = buffer.toString('utf8');
      
      cleanedText = cleanedText.replace(/[^\u0020-\u007E\u00A0-\uD7FF\uE000-\uFFFD]/g, ' ');
      
      cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
      
      return cleanedText;
    } catch (error) {
      return text.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  async executeWildebeest(text: string): Promise<string> {
    await this.init();
    
    const inputFile = path.join(PythonService.venvDir, "input.txt");
    const outputFile = path.join(PythonService.venvDir, "output.json");

    try {
      const cleanedText = this.cleanUnicodeText(text);
      
      try {
        Buffer.from(cleanedText, 'utf8');
      } catch (encodingError) {
        throw new Error(`Text contains invalid UTF-8 characters: ${encodingError instanceof Error ? encodingError.message : String(encodingError)}`);
      }

      await fs.writeFile(inputFile, cleanedText, { 
        encoding: 'utf8',
        flag: 'w' 
      });

      const wbAnalyzer = path.join(
        PythonService.venvDir,
        PythonService.EXEC_DIR_NAME,
        platform() === "win32" ? "wb-ana.exe" : "wb-ana"
      );

      const env = {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONLEGACYWINDOWSFSENCODING: '0',
        PYTHONLEGACYWINDOWSSTDIO: '0',
        PYTHONUTF8: '1',
        ...(platform() === "win32" ? {
          PYTHONCOERCECLOCALE: '1',
          LC_ALL: 'en_US.UTF-8',
          LANG: 'en_US.UTF-8',
        } : {
          LC_ALL: 'C.UTF-8',
          LANG: 'C.UTF-8',
        })
      };

      await this.runCommand(
        wbAnalyzer,
        ["-i", inputFile, "-j", outputFile, "--verbose"],
        { env }
      );

      const result = await fs.readFile(outputFile, { encoding: 'utf8' });
      return result;
    } finally {
      await Promise.all([
        fs.unlink(inputFile).catch(() => {}),
        fs.unlink(outputFile).catch(() => {})
      ]);
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.stat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async runCommand(
    command: string,
    args: string[],
    options: { env?: Record<string, string> } = {}
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, { env: options.env });
      let stdout = "";
      let stderr = "";

      process.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      process.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      process.on("close", (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      process.on("error", (err) => {
        reject(new Error(`Failed to execute command: ${err.message}`));
      });
    });
  }
}

const PYTHON_DOWNLOADS = {
  "win32-x64": "https://github.com/astral-sh/python-build-standalone/releases/download/20250212/cpython-3.13.2+20250212-x86_64-pc-windows-msvc-install_only.tar.gz",
  "darwin-x64": "https://github.com/astral-sh/python-build-standalone/releases/download/20250212/cpython-3.13.2+20250212-x86_64-apple-darwin-install_only.tar.gz",
  "darwin-arm64": "https://github.com/astral-sh/python-build-standalone/releases/download/20250212/cpython-3.13.2+20250212-aarch64-apple-darwin-install_only.tar.gz",
  "linux-x64": "https://github.com/astral-sh/python-build-standalone/releases/download/20250212/cpython-3.13.2+20250212-x86_64-unknown-linux-gnu-install_only.tar.gz",
  "linux-arm64": "https://github.com/astral-sh/python-build-standalone/releases/download/20250212/cpython-3.13.2+20250212-aarch64-unknown-linux-gnu-install_only.tar.gz",
} as const;