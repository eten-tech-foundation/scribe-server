import axios from "axios";
import { platform, machine } from "os";
import * as tar from "tar";
import { spawn } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs/promises";

export class PythonService {
  private static readonly SCRIBE_DIR_NAME = ".scribe-ffmpeg-server";
  private static readonly PYTHON_DIR_NAME = "python";
  private static readonly APP_VENV_DIR_NAME = "app-venv";
  private static readonly PYTHON_BIN_NAME = "python3.13";
  private static readonly PYTHON_GENERIC_BIN_NAME = "python";

  private static readonly EXEC_DIR_NAME =
    platform() === "win32" ? "Scripts" : "bin";

  private static scribeDir: string;
  private static pythonDir: string;
  private static pythonBinPath: string;
  private static pythonGenericBinPath: string;
  private static venvDir: string;

  constructor() {}

  async init(): Promise<void> {
    await this.initializeStaticPaths();
  }

  // Getter methods for path access
  getScribeDir(): string {
    return PythonService.scribeDir;
  }

  getPythonDir(): string {
    return PythonService.pythonDir;
  }

  getVenvDir(): string {
    return PythonService.venvDir;
  }

  private async initializeStaticPaths(): Promise<void> {
    const homeDir = process.env.HOME || process.env.USERPROFILE || "";
    if (!homeDir) {
      throw new Error("Could not determine home directory");
    }

    PythonService.scribeDir = path.join(homeDir, PythonService.SCRIBE_DIR_NAME);

    PythonService.pythonDir = path.join(
      PythonService.scribeDir,
      PythonService.PYTHON_DIR_NAME
    );

    PythonService.venvDir = path.join(
      PythonService.scribeDir,
      PythonService.APP_VENV_DIR_NAME
    );

    const venvExists = await fs
      .stat(PythonService.venvDir)
      .then(() => true)
      .catch(() => false);

    if (venvExists) {
      PythonService.pythonBinPath = path.join(
        PythonService.venvDir,
        PythonService.EXEC_DIR_NAME,
        PythonService.PYTHON_BIN_NAME
      );

      PythonService.pythonGenericBinPath = path.join(
        PythonService.venvDir,
        PythonService.EXEC_DIR_NAME,
        PythonService.PYTHON_GENERIC_BIN_NAME
      );
    } else {
      PythonService.pythonBinPath = path.join(
        PythonService.pythonDir,
        PythonService.EXEC_DIR_NAME,
        PythonService.PYTHON_BIN_NAME
      );

      PythonService.pythonGenericBinPath = path.join(
        PythonService.pythonDir,
        PythonService.EXEC_DIR_NAME,
        PythonService.PYTHON_GENERIC_BIN_NAME
      );
    }
  }

  async setupEnvironment(): Promise<void> {
    const scribeDir = await this.getAppDir();
    const pythonDir = await this.downloadPython(scribeDir);
    await this.createVirtualEnv(scribeDir, pythonDir);
  }

  private async getAppDir(): Promise<string> {
    const exists = await fs
      .stat(PythonService.scribeDir)
      .then(() => true)
      .catch(() => false);

    if (!exists) {
      await fs.mkdir(PythonService.scribeDir, { recursive: true });
    }
    return PythonService.scribeDir;
  }

  private async downloadPython(targetDir: string): Promise<string> {
    const pythonExists = await fs
      .readdir(PythonService.pythonDir)
      .then(() => true)
      .catch(() => false);

    if (pythonExists) {
      try {
        const versionProcess = spawn(PythonService.pythonBinPath, [
          "--version",
        ]);

        const versionPromise = new Promise<string>((resolve, reject) => {
          let output = "";

          versionProcess.stdout.on("data", (data) => {
            output += data.toString();
          });

          versionProcess.on("close", (code) => {
            if (code === 0) {
              resolve(output.trim());
            } else {
              reject(
                new Error(`Python version check failed with code ${code}`)
              );
            }
          });

          versionProcess.on("error", (err) => {
            reject(err);
          });
        });

        const version = await versionPromise;
        if (version.includes("Python 3.13")) {
          console.log("Found existing Python 3.13 installation");
          return PythonService.pythonDir;
        }
      } catch (err) {
        console.log(
          "Failed to verify Python version, will download fresh copy:",
          err
        );
      }
    }

    console.log("Starting Python download...");
    const pythonDownloadUrl = this.getPythonDownloadUrl();

    const fileName = pythonDownloadUrl.split("/").pop();
    if (!fileName) {
      throw new Error("Failed to determine file name");
    }

    const downloadPath = path.join(targetDir, fileName);

    const response = await axios({
      url: pythonDownloadUrl,
      method: "GET",
      responseType: "arraybuffer",
    });

    await fs.writeFile(downloadPath, Buffer.from(response.data));

    await tar.x({
      cwd: targetDir,
      file: downloadPath,
      gzip: true,
    });

    // List contents for debugging
    const targetContents = await fs.readdir(targetDir);
    console.log("Contents of targetDir:", targetContents);

    const pythonContents = await fs.readdir(PythonService.pythonDir);
    console.log("Contents of pythonDir:", pythonContents);

    // delete the download file
    await fs.unlink(downloadPath);
    console.log("Python setup completed successfully");

    return PythonService.pythonDir;
  }

  private getPythonDownloadUrl(): string {
    const architecture = machine();
    const currentPlatform = platform();
    console.log(
      `Detected platform: ${currentPlatform}, architecture: ${architecture}`
    );

    const key = `${currentPlatform}-${
      architecture === "x86_64" ? "x64" : "arm64"
    }` as keyof typeof PYTHON_DOWNLOADS;
    const url = PYTHON_DOWNLOADS[key];

    if (!url) {
      throw new Error(`Unsupported platform/architecture combination: ${key}`);
    }

    return url;
  }

  private async createVirtualEnv(
    scribeDir: string,
    pythonDir: string
  ): Promise<void> {
    // Check if venv already exists
    const venvExists = await fs
      .stat(PythonService.venvDir)
      .then(() => true)
      .catch(() => false);

    if (venvExists) {
      console.log("Virtual environment already exists, updating Python paths");
      // Update Python paths to use venv binaries
      PythonService.pythonBinPath = path.join(
        PythonService.venvDir,
        PythonService.EXEC_DIR_NAME,
        PythonService.PYTHON_BIN_NAME
      );

      PythonService.pythonGenericBinPath = path.join(
        PythonService.venvDir,
        PythonService.EXEC_DIR_NAME,
        PythonService.PYTHON_GENERIC_BIN_NAME
      );
      return;
    }

    await fs.mkdir(PythonService.venvDir, { recursive: true });

    const venvProcess = spawn(PythonService.pythonGenericBinPath, [
      "-m",
      "venv",
      PythonService.venvDir,
    ]);

    await new Promise<void>((resolve, reject) => {
      venvProcess.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Failed to create virtual environment: ${code}`));
        } else {
          // Update Python paths to use venv binaries after successful creation
          PythonService.pythonBinPath = path.join(
            PythonService.venvDir,
            PythonService.EXEC_DIR_NAME,
            PythonService.PYTHON_BIN_NAME
          );

          PythonService.pythonGenericBinPath = path.join(
            PythonService.venvDir,
            PythonService.EXEC_DIR_NAME,
            PythonService.PYTHON_GENERIC_BIN_NAME
          );
          resolve();
        }
      });

      venvProcess.on("error", (err) => {
        reject(new Error(`Failed to create virtual environment: ${err}`));
      });
    });
  }

  async setupWildebeest(): Promise<void> {
    let stdout = "";
    let stderr = "";

    try {
      const pipProcess = spawn(PythonService.pythonGenericBinPath, [
        "-m",
        "pip",
        "install",
        "wildebeest-nlp",
      ]);

      // Create a promise to handle the process events
      await new Promise<void>((resolve, reject) => {
        pipProcess.stdout.on("data", (data) => {
          stdout += data.toString();
        });

        pipProcess.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        pipProcess.on("close", (code) => {
          if (code !== 0) {
            reject(
              new Error(`Failed to install wildebeest-nlp (${code}): ${stderr}`)
            );
          } else {
            resolve();
          }
        });

        pipProcess.on("error", (err) => {
          reject(new Error(`Failed to install wildebeest-nlp: ${err}`));
        });
      });

      console.log("OUTPUT OF THE SPAWN", stdout);
    } catch (error) {
      throw error;
    }
  }

  async executeWildebeest(text: string): Promise<string> {
    const pythonBinPath = path.join(
      PythonService.venvDir,
      PythonService.EXEC_DIR_NAME
    );

    // Create temporary input and output files
    const inputFile = path.join(PythonService.venvDir, "input.txt");
    const outputFile = path.join(PythonService.venvDir, "output.json");

    try {
      console.log("Writing input text to file:", inputFile);
      // Write the input text to a file
      await fs.writeFile(inputFile, text, "utf-8");

      console.log("Executing wb-ana command...");
      // Execute wb-ana with input and json output files
      await new Promise<void>((resolve, reject) => {
        const wildebeestProcess = spawn(
          "wb-ana",
          ["-i", inputFile, "-j", outputFile, "--verbose"],
          {
            env: { ...process.env, PYTHONIOENCODING: "utf-8" },
            cwd: pythonBinPath,
          }
        );

        wildebeestProcess.stdout.setEncoding("utf-8");
        wildebeestProcess.stderr.setEncoding("utf-8");

        wildebeestProcess.stdout.on("data", (data) => {
          console.log("wb-ana stdout:", data);
        });

        wildebeestProcess.stderr.on("data", (data) => {
          console.log("wb-ana stderr:", data);
        });

        wildebeestProcess.on("close", (code) => {
          if (code !== 0) {
            reject(new Error(`Wildebeest analysis failed with code ${code}`));
          } else {
            resolve();
          }
        });

        wildebeestProcess.on("error", (err) => {
          reject(new Error(`Failed to execute Wildebeest: ${err}`));
        });
      });

      console.log("Reading output file:", outputFile);
      // Read the output file
      const outputContent = await fs.readFile(outputFile, "utf-8");
      console.log("Wildebeest analysis result:", outputContent);

      // Clean up temporary files
      await Promise.all([fs.unlink(inputFile), fs.unlink(outputFile)]);

      return outputContent;
    } catch (error) {
      console.error("Error in executeWildebeest:", error);
      // Clean up files in case of error
      try {
        await Promise.all([
          fs.unlink(inputFile).catch(() => {}),
          fs.unlink(outputFile).catch(() => {}),
        ]);
      } catch (cleanupError) {
        console.error("Error cleaning up temporary files:", cleanupError);
      }
      throw error;
    }
  }
}

const PYTHON_DOWNLOADS = {
  "win32-x64":
    "https://github.com/astral-sh/python-build-standalone/releases/download/20250212/cpython-3.13.2+20250212-x86_64-pc-windows-msvc-install_only.tar.gz",
  "darwin-x64":
    "https://github.com/astral-sh/python-build-standalone/releases/download/20250212/cpython-3.13.2+20250212-x86_64-apple-darwin-install_only.tar.gz",
  "darwin-arm64":
    "https://github.com/astral-sh/python-build-standalone/releases/download/20250212/cpython-3.13.2+20250212-aarch64-apple-darwin-install_only.tar.gz",
  "linux-x64":
    "https://github.com/astral-sh/python-build-standalone/releases/download/20250212/cpython-3.13.2+20250212-x86_64-unknown-linux-gnu-install_only.tar.gz",
  "linux-arm64":
    "https://github.com/astral-sh/python-build-standalone/releases/download/20250212/cpython-3.13.2+20250212-aarch64-unknown-linux-gnu-install_only.tar.gz",
} as const;
