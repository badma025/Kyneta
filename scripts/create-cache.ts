import * as path from "node:path";

import { loadEnvConfig } from "@next/env";
import { GoogleAIFileManager } from "@google/generative-ai/server";

const PDF_MIME_TYPE = "application/pdf";
const BRIGHT_GREEN = "\x1b[92;1m";
const BRIGHT_RED = "\x1b[91;1m";
const BRIGHT_CYAN = "\x1b[96;1m";
const RESET_COLOR = "\x1b[0m";

import { GCSE_SUBJECT_CONFIG, SUPPORTED_GCSE_SUBJECTS } from "../lib/gcse-subjects";

async function main() {
  loadEnvConfig(process.cwd());

  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY.");
  }

  const fileManager = new GoogleAIFileManager(apiKey);
  const outputLines: string[] = [];

  for (const subject of SUPPORTED_GCSE_SUBJECTS) {
    const subjectConfig = GCSE_SUBJECT_CONFIG[subject];
    const pdfPath = path.resolve(
      process.cwd(),
      "documents",
      subjectConfig.localFileName,
    );

    const upload = await fileManager.uploadFile(pdfPath, {
      displayName: path.basename(pdfPath),
      mimeType: PDF_MIME_TYPE,
    });

    outputLines.push(
      `${subjectConfig.fileUriEnvVar}=${upload.file.uri}`,
    );
  }

  console.log(
    `${BRIGHT_CYAN}Add these lines to .env.local after the upload completes:${RESET_COLOR}`,
  );

  for (const line of outputLines) {
    console.log(`${BRIGHT_GREEN}${line}${RESET_COLOR}`);
  }
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown cache creation failure.";

  console.error(
    `${BRIGHT_RED}Failed to upload GCSE specification PDFs: ${message}${RESET_COLOR}`,
  );

  process.exitCode = 1;
});
