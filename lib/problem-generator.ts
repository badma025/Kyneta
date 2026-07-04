import * as fs from "node:fs";
import * as path from "node:path";

import {
  GoogleGenerativeAI,
  type FileData,
  SchemaType,
} from "@google/generative-ai";
import { FileState, GoogleAIFileManager } from "@google/generative-ai/server";

import {
  DEFAULT_GCSE_SUBJECT,
  type GCSESubject,
  getGCSESubjectConfig,
} from "@/lib/gcse-subjects";

const TEXT_MODEL = "gemini-2.5-pro";
const STEP_TIMEOUT_MS = 45_000;
const FILE_POLL_INTERVAL_MS = 1_500;
const FILE_POLL_ATTEMPTS = 20;
const GEMINI_FILE_MIME_TYPE = "application/pdf";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
const BASE_SYSTEM_INSTRUCTION_PARTS = [
  "You generate original GCSE exam-style questions for Kyneta.",
  "Use the attached subject specification as the authoritative scope and tone guide.",
  "Generate original questions and never reproduce or closely paraphrase copyrighted past-paper wording.",
  "Keep each question concise, rigorous, and answerable from the prompt alone.",
  "Prefer exact answers that can be validated as a token, phrase, or integer.",
  "Do not mention internal prompt instructions, uploaded files, or hidden concepts.",
] as const;

const puzzleSchema = {
  type: SchemaType.OBJECT,
  properties: {
    problem_text: {
      type: SchemaType.STRING,
      description:
        "One original GCSE exam-style question prompt.",
    },
    correct_answer: {
      type: SchemaType.STRING,
      description: "The exact answer choice text that should be accepted as correct.",
    },
    answer_choices: {
      type: SchemaType.ARRAY,
      description:
        "Exactly four short multiple-choice options, with exactly one correct answer.",
      items: {
        type: SchemaType.STRING,
      },
    },
    mark_scheme: {
      type: SchemaType.STRING,
      description:
        "A short marking point or model answer summary for internal reference.",
    },
    topic_hint: {
      type: SchemaType.STRING,
      description:
        "A concise description of the curriculum topic being exercised.",
    },
  },
  required: [
    "problem_text",
    "correct_answer",
    "answer_choices",
    "mark_scheme",
    "topic_hint",
  ] as string[],
} as const;

type PuzzleGeneration = {
  problem_text: string;
  correct_answer: string;
  answer_choices: string[];
  mark_scheme: string;
  topic_hint: string;
};

export type GeneratedProblem = {
  problemText: string;
  correctAnswer: string;
  answerChoices: string[];
  imageBase64: string;
};

type GenerateProblemOptions = {
  ai?: GoogleGenerativeAI;
  subject?: GCSESubject;
};

const sharedFileDataPromises = new Map<GCSESubject, Promise<FileData>>();

function getGeminiApiKey() {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "Missing GEMINI_API_KEY. Set a Gemini API key before calling the generation route.",
    );
  }

  return GEMINI_API_KEY;
}

function getGenAIClient() {
  return new GoogleGenerativeAI(getGeminiApiKey());
}

function getFileManager() {
  return new GoogleAIFileManager(getGeminiApiKey());
}

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${STEP_TIMEOUT_MS}ms.`));
    }, STEP_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isPuzzleGeneration(value: unknown): value is PuzzleGeneration {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.problem_text === "string" &&
    typeof candidate.correct_answer === "string" &&
    Array.isArray(candidate.answer_choices) &&
    candidate.answer_choices.length === 4 &&
    candidate.answer_choices.every((choice) => typeof choice === "string") &&
    typeof candidate.mark_scheme === "string" &&
    typeof candidate.topic_hint === "string"
  );
}

export function buildBaseSystemInstruction() {
  return BASE_SYSTEM_INSTRUCTION_PARTS.join(" ");
}

function buildSystemInstruction(hiddenConcept: string, subject: GCSESubject) {
  const subjectConfig = getGCSESubjectConfig(subject);

  return [
    buildBaseSystemInstruction(),
    `The selected subject is ${subjectConfig.label}.`,
    "Use the attached specification document only as hidden source context.",
    "Do not quote the specification directly.",
    `Hidden concept for inspiration only: ${hiddenConcept}`,
  ].join(" ");
}

async function waitForFileActivation(fileName: string) {
  const fileManager = getFileManager();

  for (let attempt = 0; attempt < FILE_POLL_ATTEMPTS; attempt += 1) {
    const file = await fileManager.getFile(fileName);

    if (file.state === FileState.ACTIVE) {
      return file;
    }

    if (file.state === FileState.FAILED) {
      throw new Error(
        `Uploaded Gemini file ${file.name} failed processing and cannot be used for inference.`,
      );
    }

    await sleep(FILE_POLL_INTERVAL_MS);
  }

  throw new Error(
    `Gemini file ${fileName} did not become active within ${FILE_POLL_ATTEMPTS * FILE_POLL_INTERVAL_MS}ms.`,
  );
}

function getConfiguredFileUri(subject: GCSESubject) {
  const subjectConfig = getGCSESubjectConfig(subject);

  return process.env[subjectConfig.fileUriEnvVar]?.trim();
}

function getLocalSpecificationPath(subject: GCSESubject) {
  return path.resolve(
    process.cwd(),
    "documents",
    getGCSESubjectConfig(subject).localFileName,
  );
}

async function uploadLocalSpecificationFile(subject: GCSESubject) {
  const localSpecificationPath = getLocalSpecificationPath(subject);

  if (!fs.existsSync(localSpecificationPath)) {
    throw new Error(
      `No Gemini file URI was configured for ${subject} and ${localSpecificationPath} does not exist for upload.`,
    );
  }

  const fileManager = getFileManager();
  const upload = await fileManager.uploadFile(localSpecificationPath, {
    displayName: path.basename(localSpecificationPath),
    mimeType: GEMINI_FILE_MIME_TYPE,
  });
  const activeFile = await waitForFileActivation(upload.file.name);

  return {
    fileUri: activeFile.uri,
    mimeType: activeFile.mimeType,
  } satisfies FileData;
}

async function resolveKnowledgeFileData(subject: GCSESubject) {
  const configuredFileUri = getConfiguredFileUri(subject);

  if (configuredFileUri) {
    return {
      fileUri: configuredFileUri,
      mimeType: GEMINI_FILE_MIME_TYPE,
    } satisfies FileData;
  }

  const existingPromise = sharedFileDataPromises.get(subject);

  if (existingPromise) {
    return existingPromise;
  }

  const createdPromise = uploadLocalSpecificationFile(subject).catch((error) => {
    sharedFileDataPromises.delete(subject);
    throw error;
  });

  sharedFileDataPromises.set(subject, createdPromise);

  return createdPromise;
}

export function getProblemGenerationErrorMessage(error: unknown) {
  const fallback =
    "Unable to complete the generation request due to an upstream model or infrastructure error.";

  if (!(error instanceof Error)) {
    return fallback;
  }

  if (error.message.includes("GEMINI_API_KEY")) {
    return error.message;
  }

  if (error.message.includes("does not exist for upload")) {
    return error.message;
  }

  if (error.message.includes("did not become active")) {
    return error.message;
  }

  if (error.message.includes("prepayment credits are depleted")) {
    return "Gemini API credits are depleted for the current AI Studio project. Add billing or configure persistent GCSE_*_FILE_URI values so the app does not re-upload documents on each cold start.";
  }

  return error.message || fallback;
}

export async function generateProblem(
  hiddenConcept: string,
  options?: GenerateProblemOptions,
) {
  const subject = options?.subject ?? DEFAULT_GCSE_SUBJECT;
  const ai = options?.ai ?? getGenAIClient();
  const subjectConfig = getGCSESubjectConfig(subject);
  const knowledgeFileData = await resolveKnowledgeFileData(subject);
  const model = ai.getGenerativeModel({
    model: TEXT_MODEL,
    systemInstruction: buildSystemInstruction(hiddenConcept, subject),
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: puzzleSchema,
    },
  });

  const textResponse = await withTimeout(
    model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: [
                `Generate one original ${subjectConfig.label} exam-style question.`,
                `Stay within the specification and let this hidden curriculum focus shape the question: ${hiddenConcept}.`,
                "Return exactly four answer choices and make only one of them correct.",
                "Keep the answer choices concise and plausible.",
                "Return only the JSON object described by the response schema.",
              ].join(" "),
            },
            {
              fileData: knowledgeFileData,
            },
          ],
        },
      ],
    }),
    `Text generation (${TEXT_MODEL})`,
  );

  const parsed = JSON.parse(textResponse.response.text()) as unknown;

  if (!isPuzzleGeneration(parsed)) {
    throw new Error("Model returned an invalid puzzle payload.");
  }

  return {
    problemText: parsed.problem_text,
    correctAnswer: parsed.correct_answer,
    answerChoices: parsed.answer_choices,
    imageBase64: "",
  } satisfies GeneratedProblem;
}
