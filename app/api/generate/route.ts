import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

import {
  getDefaultHiddenConcept,
  normalizeGCSESubject,
} from "@/lib/gcse-subjects";
import {
  generateProblem,
  getProblemGenerationErrorMessage,
} from "@/lib/problem-generator";

export const runtime = "nodejs";

type GenerateRequestBody = {
  hiddenConcept?: string;
  subject?: string;
};

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing GEMINI_API_KEY." },
        { status: 500 },
      );
    }

    const body = (await request.json()) as GenerateRequestBody;
    const subject = normalizeGCSESubject(body.subject);
    const hiddenConcept =
      body.hiddenConcept?.trim() || getDefaultHiddenConcept(subject);

    const ai = new GoogleGenerativeAI(apiKey);
    const problem = await generateProblem(hiddenConcept, { ai, subject });

    return NextResponse.json({
      subject,
      problem_text: problem.problemText,
      correct_answer: problem.correctAnswer,
      answer_choices: problem.answerChoices,
      image_base64: problem.imageBase64,
    });
  } catch (error) {
    console.error("Generation route failed:", error);

    return NextResponse.json(
      {
        error: getProblemGenerationErrorMessage(error),
      },
      { status: 502 },
    );
  }
}
