import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";

import {
  DEFAULT_GCSE_SUBJECT,
  normalizeGCSESubject,
  SUPPORTED_GCSE_SUBJECTS,
} from "@/lib/gcse-subjects";
import {
  generateProblem,
  getProblemGenerationErrorMessage,
} from "@/lib/problem-generator";
import {
  findProblemByQueueId,
  formatQueueId,
  getFirstProblemForSprint,
  hasProblemOrReservation,
  INITIAL_QUEUE_ORDINAL,
  releaseProblemReservation,
  reserveNextProblem,
  storeProblem,
} from "@/lib/problem-queue-store";

export const runtime = "nodejs";

type ProblemRequestBody = {
  sprintId?: string;
  nextQueueId?: string;
  subject?: string;
};

type WarmupRequestBody = {
  subjects?: string[];
  depth?: number;
};

type ReservedProblem = ReturnType<typeof reserveNextProblem>;
const ACTIVE_QUEUE_DEPTH = 5;
const HOME_WARMUP_DEPTH = 2;

function incrementQueueId(queueId: string) {
  const match = queueId.match(/^K-(\d+)$/);

  if (!match) {
    return queueId;
  }

  const nextValue = Number.parseInt(match[1], 10) + 1;

  return `K-${String(nextValue).padStart(match[1].length, "0")}`;
}

async function generateAndStoreNextProblem(reservation: ReservedProblem) {
  try {
    const generatedProblem = await generateProblem(reservation.hiddenConcept, {
      subject: reservation.subject,
    });

    storeProblem(reservation, generatedProblem);

    console.log(
      `Pre-generated queue item ${reservation.queueId} for sprint ${reservation.sprintId}.`,
    );
  } catch (error) {
    releaseProblemReservation(reservation.sprintId, reservation.queueId);
    console.error(
      `Background generation failed for queue ${reservation.queueId}:`,
      error,
    );
  }
}

function buildProblemResponse(
  problem: NonNullable<ReturnType<typeof findProblemByQueueId>>,
) {
  return {
    sprintId: problem.sprintId,
    queueId: problem.queueId,
    subject: problem.subject,
    hiddenConcept: problem.hiddenConcept,
    problemText: problem.problemText,
    correctAnswer: problem.correctAnswer,
    answerChoices: problem.answerChoices,
    imageBase64: problem.imageBase64,
  };
}

function getManagedQueueIds(sprintId: string) {
  const queueIds: string[] = [];
  const nextStatefulProblem = getFirstProblemForSprint(sprintId);

  if (!nextStatefulProblem) {
    return queueIds;
  }

  let currentQueueId = nextStatefulProblem.queueId;

  while (hasProblemOrReservation(sprintId, currentQueueId)) {
    queueIds.push(currentQueueId);
    currentQueueId = incrementQueueId(currentQueueId);
  }

  return queueIds;
}

function countSequentialQueueCoverage(sprintId: string, startQueueId: string) {
  let queueCoverage = 0;
  let currentQueueId = startQueueId;

  while (hasProblemOrReservation(sprintId, currentQueueId)) {
    queueCoverage += 1;
    currentQueueId = incrementQueueId(currentQueueId);
  }

  return queueCoverage;
}

function reserveProblemsToDepth(
  sprintId: string,
  subject: ReturnType<typeof normalizeGCSESubject>,
  desiredDepth: number,
  startQueueId = formatQueueId(INITIAL_QUEUE_ORDINAL),
) {
  const reservations: ReservedProblem[] = [];
  const existingCoverage = countSequentialQueueCoverage(sprintId, startQueueId);
  const missingCount = Math.max(desiredDepth - existingCoverage, 0);

  for (let index = 0; index < missingCount; index += 1) {
    reservations.push(reserveNextProblem(sprintId, subject));
  }

  return reservations;
}

function scheduleReservations(reservations: ReservedProblem[]) {
  for (const reservation of reservations) {
    waitUntil(generateAndStoreNextProblem(reservation));
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ProblemRequestBody;
    const sprintId = body.sprintId?.trim();
    const requestedQueueId = body.nextQueueId?.trim();
    const subject = normalizeGCSESubject(body.subject);

    if (!sprintId) {
      return NextResponse.json(
        { error: "Missing required field: sprintId." },
        { status: 400 },
      );
    }

    let currentProblem = requestedQueueId
      ? findProblemByQueueId(sprintId, requestedQueueId)
      : getFirstProblemForSprint(sprintId);

    // First request for a brand-new sprint cannot use the fast path yet, so seed it once.
    if (
      !currentProblem &&
      (!requestedQueueId ||
        (!getFirstProblemForSprint(sprintId) &&
          !hasProblemOrReservation(sprintId, requestedQueueId)))
    ) {
      const seedReservation = reserveNextProblem(sprintId, subject);

      if (requestedQueueId && seedReservation.queueId !== requestedQueueId) {
        releaseProblemReservation(seedReservation.sprintId, seedReservation.queueId);

        return NextResponse.json(
          {
            error: `Queue ${requestedQueueId} is not the next available problem for this sprint.`,
          },
          { status: 409 },
        );
      }

      try {
        const seededProblem = await generateProblem(seedReservation.hiddenConcept, {
          subject: seedReservation.subject,
        });
        currentProblem = storeProblem(seedReservation, seededProblem);
      } catch (error) {
        releaseProblemReservation(seedReservation.sprintId, seedReservation.queueId);

        return NextResponse.json(
          { error: getProblemGenerationErrorMessage(error) },
          { status: 502 },
        );
      }
    }

    if (!currentProblem) {
      if (requestedQueueId && hasProblemOrReservation(sprintId, requestedQueueId)) {
        scheduleReservations(
          reserveProblemsToDepth(
            sprintId,
            subject,
            ACTIVE_QUEUE_DEPTH,
            requestedQueueId,
          ),
        );

        return NextResponse.json(
          {
            status: "pending",
            nextQueueId: requestedQueueId,
          },
          { status: 202 },
        );
      }

      return NextResponse.json(
        {
          error: "Problem not found in queue.",
          nextQueueId: requestedQueueId,
        },
        { status: 404 },
      );
    }

    const nextQueueId = incrementQueueId(currentProblem.queueId);
    scheduleReservations(
      reserveProblemsToDepth(sprintId, subject, ACTIVE_QUEUE_DEPTH, nextQueueId),
    );

    return NextResponse.json({
      problem: buildProblemResponse(currentProblem),
      nextQueueId,
    });
  } catch (error) {
    console.error("Failed to fetch problem:", error);

    return NextResponse.json(
      { error: getProblemGenerationErrorMessage(error) },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as WarmupRequestBody;
    const requestedSubjects =
      body.subjects?.length
        ? body.subjects.map((subject) => normalizeGCSESubject(subject))
        : [DEFAULT_GCSE_SUBJECT];
    const uniqueSubjects = [...new Set(requestedSubjects)];
    const depth = Math.max(
      1,
      Math.min(body.depth ?? HOME_WARMUP_DEPTH, ACTIVE_QUEUE_DEPTH),
    );

    const warmed: Array<{ subject: string; sprintId: string; depth: number }> = [];

    for (const subject of uniqueSubjects) {
      if (!SUPPORTED_GCSE_SUBJECTS.includes(subject)) {
        continue;
      }

      const sprintId = `dev-session:${subject}`;
      const reservations = reserveProblemsToDepth(sprintId, subject, depth);
      scheduleReservations(reservations);

      warmed.push({
        subject,
        sprintId,
        depth: getManagedQueueIds(sprintId).length,
      });
    }

    return NextResponse.json({
      status: "warming",
      warmed,
    });
  } catch (error) {
    console.error("Failed to warm problem queues:", error);

    return NextResponse.json(
      { error: getProblemGenerationErrorMessage(error) },
      { status: 500 },
    );
  }
}
