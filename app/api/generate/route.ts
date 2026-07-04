import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TEXT_MODEL = "gemini-2.5-pro";
const IMAGE_MODEL = "imagen-3.0-generate-001";
const STEP_TIMEOUT_MS = 45_000;
const VERTEX_PROJECT = "kyneta";
const VERTEX_LOCATION = "us-central1";

type PuzzleGeneration = {
  problem_text: string;
  correct_answer: string;
  visual_diagram_prompt: string;
};

type GenerateRequestBody = {
  hiddenConcept?: string;
};

const puzzleSchema = {
  type: "object",
  properties: {
    problem_text: {
      type: "string",
      description:
        "A domain-agnostic logic puzzle with no subject labels, textbook framing, or named disciplines.",
    },
    correct_answer: {
      type: "string",
      description: "The exact short answer that should be accepted as correct.",
    },
    visual_diagram_prompt: {
      type: "string",
      description:
        "A highly detailed prompt for an abstract, minimalist, dark-mode diagram that supports the puzzle and explicitly forbids text, labels, and numbers in the image.",
    },
  },
  required: ["problem_text", "correct_answer", "visual_diagram_prompt"],
} as const;

function getGenAIClient() {
  return new GoogleGenAI({
    vertexai: true,
    project: VERTEX_PROJECT,
    location: VERTEX_LOCATION,
  });
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

function isPuzzleGeneration(value: unknown): value is PuzzleGeneration {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.problem_text === "string" &&
    typeof candidate.correct_answer === "string" &&
    typeof candidate.visual_diagram_prompt === "string"
  );
}

function extractImageBase64(response: unknown) {
  if (!response || typeof response !== "object") {
    return null;
  }

  const generatedImages = (response as { generatedImages?: unknown[] })
    .generatedImages;

  if (!Array.isArray(generatedImages) || generatedImages.length === 0) {
    return null;
  }

  const imageBytes = (
    generatedImages[0] as {
      image?: { imageBytes?: string | null };
    }
  )?.image?.imageBytes;

  return typeof imageBytes === "string" && imageBytes.length > 0
    ? imageBytes
    : null;
}

function buildSystemInstruction(hiddenConcept: string) {
  return [
    "You generate domain-agnostic logic puzzles for an adaptive cognition app.",
    "The user will provide a hidden concept. Use it only as latent inspiration.",
    "Do not mention the concept directly.",
    "Do not reveal the original domain, chapter, subject, or academic framing.",
    "Write a concise puzzle that tests transferable reasoning rather than recall.",
    "The puzzle should be solvable from the text alone.",
    "The answer must be short and exact.",
    "The visual_diagram_prompt must describe an abstract, minimalist, dark-mode diagram that clarifies relationships in the puzzle.",
    "The visual_diagram_prompt must explicitly forbid all text, labels, letters, numerals, measurement marks, legends, captions, or UI chrome in the image.",
    `Hidden concept for inspiration only: ${hiddenConcept}`,
  ].join(" ");
}

function getErrorMessage(error: unknown) {
  const fallback =
    "Unable to complete the generation request due to an upstream model or infrastructure error.";

  if (!(error instanceof Error)) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(error.message) as {
      error?: {
        status?: string;
        message?: string;
        details?: Array<{
          reason?: string;
          metadata?: {
            activationUrl?: string;
            containerInfo?: string;
          };
        }>;
      };
    };

    const apiError = parsed.error;
    const detail = apiError?.details?.find(Boolean);

    if (detail?.reason === "SERVICE_DISABLED") {
      const activationUrl = detail.metadata?.activationUrl?.trim();
      const project = detail.metadata?.containerInfo?.trim();

      return [
        `Vertex AI is disabled for project ${project ?? "the configured project"}.`,
        "Enable `aiplatform.googleapis.com`, wait a few minutes for propagation, then retry.",
        activationUrl ? `Activation URL: ${activationUrl}` : null,
      ]
        .filter(Boolean)
        .join(" ");
    }

    if (apiError?.status === "NOT_FOUND") {
      return `The configured Google model \`${TEXT_MODEL}\` is not available in Vertex region \`${VERTEX_LOCATION}\` for project \`${VERTEX_PROJECT}\`, or your project does not have access to it.`;
    }

    if (apiError?.message) {
      return apiError.message;
    }
  } catch {
    return error.message || fallback;
  }

  return error.message || fallback;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateRequestBody;
    const hiddenConcept = body.hiddenConcept?.trim();

    if (!hiddenConcept) {
      return NextResponse.json(
        { error: "Missing required field: hiddenConcept." },
        { status: 400 },
      );
    }

    const ai = getGenAIClient();

    let puzzle: PuzzleGeneration;

    try {
      const textResponse = await withTimeout(
        ai.models.generateContent({
          model: TEXT_MODEL,
          contents:
            "Generate one logic puzzle package from the hidden concept.",
          config: {
            systemInstruction: buildSystemInstruction(hiddenConcept),
            responseMimeType: "application/json",
            responseJsonSchema: puzzleSchema,
          },
        }),
        `Text generation (${TEXT_MODEL})`,
      );

      const parsed = JSON.parse(textResponse.text ?? "") as unknown;

      if (!isPuzzleGeneration(parsed)) {
        throw new Error("Model returned an invalid puzzle payload.");
      }

      puzzle = parsed;
    } catch (error) {
      console.error("Puzzle generation failed:", error);

      return NextResponse.json(
        {
          error: getErrorMessage(error),
        },
        { status: 502 },
      );
    }

    try {
      const imageResponse = await withTimeout(
        ai.models.generateImages({
          model: IMAGE_MODEL,
          prompt: puzzle.visual_diagram_prompt,
          config: {
            aspectRatio: "1:1",
            numberOfImages: 1,
          },
        }),
        "Image generation",
      );

      const image_base64 = extractImageBase64(imageResponse);

      if (!image_base64) {
        throw new Error("Image model returned no image bytes.");
      }

      return NextResponse.json({
        problem_text: puzzle.problem_text,
        correct_answer: puzzle.correct_answer,
        image_base64,
      });
    } catch (error) {
      console.error("Diagram generation failed:", error);

      return NextResponse.json(
        {
          error: getErrorMessage(error),
          problem_text: puzzle.problem_text,
          correct_answer: puzzle.correct_answer,
        },
        { status: 502 },
      );
    }
  } catch (error) {
    console.error("Generation route failed:", error);

    return NextResponse.json(
      {
        error: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
