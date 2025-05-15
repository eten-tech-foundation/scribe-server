import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { createNodeWebSocket } from "@hono/node-ws";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";
import type { ChildProcess } from "child_process";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import { PythonService } from "./modules/python.js";

const FFMPEG_PATH = ffmpegInstaller.path;
const FFPROBE_PATH = ffprobeInstaller.path;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "..", "uploads");
const publicDir = path.join(__dirname, "..", "public");

// Create directories if they don't exist
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const app = new Hono();

// Create WebSocket handler
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

// Serve static files
app.use("/public/*", serveStatic({ root: "./" }));
app.use("/uploads/*", serveStatic({ root: "./" }));

// Serve the HTML client page
app.get("/", (c) => {
  return c.redirect("/public/index.html");
});

// Endpoint to list all audio files in the uploads directory
app.get("/api/list-recordings", (c) => {
  try {
    const files = fs.readdirSync(uploadsDir);
    const audioFiles = files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return [".webm", ".mp3", ".wav", ".ogg"].includes(ext);
    });

    const recordings = audioFiles.map((file) => {
      const stats = fs.statSync(path.join(uploadsDir, file));
      return {
        filename: file,
        url: `/uploads/${file}`,
        size: stats.size,
        createdAt: stats.birthtime,
      };
    });

    return c.json({
      status: "success",
      recordings,
    });
  } catch (error) {
    console.error("Error listing recordings:", error);
    return c.json({ error: "Failed to list recordings" }, 500);
  }
});

// Endpoint to divide audio in half and swap parts
app.get("/api/swap-halves/:filename", async (c) => {
  const filename = c.req.param("filename");
  const inputPath = path.join(uploadsDir, filename);
  const outputFilename = `swapped_${filename}`;
  const outputPath = path.join(uploadsDir, outputFilename);

  // Temporary files for the two halves
  const firstHalfPath = path.join(uploadsDir, `temp_first_half_${filename}`);
  const secondHalfPath = path.join(uploadsDir, `temp_second_half_${filename}`);

  if (!fs.existsSync(inputPath)) {
    return c.json({ error: "File not found" }, 404);
  }

  try {
    // Step 1: Get the duration of the audio file
    const duration = await new Promise<number>((resolve, reject) => {
      const ffprobeProcess = spawn(FFPROBE_PATH, [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        inputPath,
      ]);

      let output = "";
      ffprobeProcess.stdout?.on("data", (data) => {
        output += data.toString();
      });

      ffprobeProcess.on("close", (code) => {
        if (code === 0) {
          resolve(parseFloat(output.trim()));
        } else {
          reject(new Error(`ffprobe process exited with code ${code}`));
        }
      });
    });

    const halfDuration = duration / 2;

    // Step 2: Extract first half
    await new Promise<void>((resolve, reject) => {
      const ffmpegProcess = spawn(FFMPEG_PATH, [
        "-i",
        inputPath,
        "-ss",
        "0",
        "-to",
        halfDuration.toString(),
        "-c",
        "copy",
        firstHalfPath,
      ]);

      ffmpegProcess.stderr?.on("data", (data) => {
        console.log(`ffmpeg (first half): ${data.toString()}`);
      });

      ffmpegProcess.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(`ffmpeg process (first half) exited with code ${code}`)
          );
        }
      });
    });

    // Step 3: Extract second half
    await new Promise<void>((resolve, reject) => {
      const ffmpegProcess = spawn(FFMPEG_PATH, [
        "-i",
        inputPath,
        "-ss",
        halfDuration.toString(),
        "-c",
        "copy",
        secondHalfPath,
      ]);

      ffmpegProcess.stderr?.on("data", (data) => {
        console.log(`ffmpeg (second half): ${data.toString()}`);
      });

      ffmpegProcess.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(`ffmpeg process (second half) exited with code ${code}`)
          );
        }
      });
    });

    // Step 4: Concatenate the halves in reverse order (second half first)
    await new Promise<void>((resolve, reject) => {
      // Create a temporary concat file
      const concatFilePath = path.join(uploadsDir, "concat_list.txt");
      fs.writeFileSync(
        concatFilePath,
        `file '${secondHalfPath.replace(/'/g, "'\\''")}'
file '${firstHalfPath.replace(/'/g, "'\\''")}'`
      );

      const ffmpegProcess = spawn(FFMPEG_PATH, [
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatFilePath,
        "-c",
        "copy",
        outputPath,
      ]);

      ffmpegProcess.stderr?.on("data", (data) => {
        console.log(`ffmpeg (concat): ${data.toString()}`);
      });

      ffmpegProcess.on("close", (code) => {
        // Clean up temporary files
        try {
          fs.unlinkSync(firstHalfPath);
          fs.unlinkSync(secondHalfPath);
          fs.unlinkSync(concatFilePath);
        } catch (err) {
          console.error("Error cleaning up temp files:", err);
        }

        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ffmpeg process (concat) exited with code ${code}`));
        }
      });
    });

    return c.json({
      status: "success",
      inputFile: filename,
      outputFile: outputFilename,
      url: `/uploads/${outputFilename}`,
    });
  } catch (error) {
    console.error("Error processing audio:", error);

    // Clean up any temporary files that might have been created
    try {
      if (fs.existsSync(firstHalfPath)) fs.unlinkSync(firstHalfPath);
      if (fs.existsSync(secondHalfPath)) fs.unlinkSync(secondHalfPath);
    } catch (err) {
      console.error("Error cleaning up temp files:", err);
    }

    return c.json({ error: "Failed to process audio" }, 500);
  }
});

// Endpoint to convert webm to mp3
app.get("/api/convert-to-mp3/:filename", async (c) => {
  const filename = c.req.param("filename");
  const inputPath = path.join(uploadsDir, filename);
  const outputFilename = filename.replace(/\.[^/.]+$/, "") + ".mp3";
  const outputPath = path.join(uploadsDir, outputFilename);

  if (!fs.existsSync(inputPath)) {
    return c.json({ error: "File not found" }, 404);
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const ffmpegProcess = spawn(FFMPEG_PATH, [
        "-i",
        inputPath,
        "-c:a",
        "libmp3lame",
        "-q:a",
        "2",
        outputPath,
      ]);

      ffmpegProcess.stderr?.on("data", (data) => {
        console.log(`ffmpeg: ${data.toString()}`);
      });

      ffmpegProcess.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ffmpeg process exited with code ${code}`));
        }
      });
    });

    return c.json({
      status: "success",
      inputFile: filename,
      outputFile: outputFilename,
      url: `/uploads/${outputFilename}`,
    });
  } catch (error) {
    console.error("Error converting audio:", error);
    return c.json({ error: "Failed to convert audio" }, 500);
  }
});

// WebSocket endpoint for audio streaming
app.get(
  "/ws",
  upgradeWebSocket((c) => {
    const filename = `recording_${Date.now()}.webm`;
    const filePath = path.join(uploadsDir, filename);

    let ffmpegProcess: ChildProcess | null = null;

    return {
      // This is called when WebSocket is connected
      onMessage(event, ws) {
        const message = event.data;
        try {
          // Check if the message is a string (end of recording signal)
          if (typeof message === "string") {
            try {
              const data = JSON.parse(message);
              if (data.action === "end") {
                console.log("End of recording received");

                if (ffmpegProcess?.stdin) {
                  ffmpegProcess.stdin.end();

                  // Send success message
                  ws.send(
                    JSON.stringify({
                      status: "success",
                      filename: filename,
                    })
                  );
                }
              }
            } catch (e) {
              console.error("Failed to parse JSON message:", e);
            }
          }
          // Handle binary audio data
          else if (message instanceof ArrayBuffer || Buffer.isBuffer(message)) {
            // Ensure ffmpeg is started the first time we receive audio data
            if (!ffmpegProcess) {
              console.log("Starting ffmpeg process for", filename);
              ffmpegProcess = spawn(FFMPEG_PATH, [
                "-i",
                "pipe:0", // Read from stdin
                "-c:a",
                "copy", // Copy audio codec without re-encoding
                filePath, // Output file
              ]);

              ffmpegProcess.stderr?.on("data", (data) => {
                console.log(`ffmpeg: ${data.toString()}`);
              });

              ffmpegProcess.on("close", (code) => {
                console.log(`ffmpeg process exited with code ${code}`);
              });
            }

            const buffer = Buffer.isBuffer(message)
              ? message
              : Buffer.from(message);
            if (ffmpegProcess?.stdin && !ffmpegProcess.stdin.destroyed) {
              ffmpegProcess.stdin.write(buffer);
            }
          }
        } catch (error) {
          console.error("Error processing message:", error);
        }
      },

      // This is called when WebSocket is closed
      onClose() {
        if (ffmpegProcess?.stdin) {
          ffmpegProcess.stdin.end();
        }
      },
    };
  })
);

// Python Service Endpoints
const pythonService = new PythonService();

// Initialize the Python service
app.get("/python/init", async (c) => {
  try {
    await pythonService.init();
    return c.json({
      status: "success",
      message: "Python service initialized successfully",
    });
  } catch (error) {
    console.error("Error initializing Python service:", error);
    return c.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

// Setup Python environment
app.get("/python/setup", async (c) => {
  try {
    await pythonService.setupEnvironment();
    return c.json({
      status: "success",
      message: "Python environment setup completed successfully",
    });
  } catch (error) {
    console.error("Error setting up Python environment:", error);
    return c.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

// Install Wildebeest NLP package
app.get("/python/install-wildebeest", async (c) => {
  try {
    await pythonService.setupWildebeest();
    return c.json({
      status: "success",
      message: "Wildebeest NLP package installed successfully",
    });
  } catch (error) {
    console.error("Error installing Wildebeest:", error);
    return c.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

// Analyze text with Wildebeest
app.post("/python/analyze-text", async (c) => {
  try {
    const { text } = await c.req.json();

    if (!text || typeof text !== "string") {
      return c.json(
        {
          status: "error",
          error: "Text is required and must be a string",
        },
        400
      );
    }

    const result = await pythonService.executeWildebeest(text);
    return c.json({
      status: "success",
      analysis: JSON.parse(result),
    });
  } catch (error) {
    console.error("Error analyzing text with Wildebeest:", error);
    return c.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

// Check installation status
app.get("/python/status", async (c) => {
  try {
    await pythonService.init();

    const scribeDir = pythonService.getScribeDir();
    const pythonDir = pythonService.getPythonDir();
    const venvDir = pythonService.getVenvDir();

    const scribeDirExists = await fs.promises
      .stat(scribeDir)
      .then(() => true)
      .catch(() => false);
    const pythonDirExists = await fs.promises
      .stat(pythonDir)
      .then(() => true)
      .catch(() => false);
    const venvDirExists = await fs.promises
      .stat(venvDir)
      .then(() => true)
      .catch(() => false);

    return c.json({
      status: "success",
      installation: {
        scribeDir: {
          path: scribeDir,
          exists: scribeDirExists,
        },
        pythonDir: {
          path: pythonDir,
          exists: pythonDirExists,
        },
        venvDir: {
          path: venvDir,
          exists: venvDirExists,
        },
      },
    });
  } catch (error) {
    console.error("Error checking Python installation status:", error);
    return c.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

const server = serve(
  {
    fetch: app.fetch,
    port: 9000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);

// Inject WebSocket handler into server
injectWebSocket(server);
