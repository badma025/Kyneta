import { type GCSESubject, getGCSESubjectConfig } from "@/lib/gcse-subjects";

type SprintState = {
  nextOrdinal: number;
  nextConceptIndex: number;
};

export const INITIAL_QUEUE_ORDINAL = 20;

export type StoredProblem = {
  sprintId: string;
  queueId: string;
  subject: GCSESubject;
  hiddenConcept: string;
  problemText: string;
  correctAnswer: string;
  answerChoices: string[];
  imageBase64: string;
  createdAt: string;
};

type ReservedProblem = {
  sprintId: string;
  queueId: string;
  subject: GCSESubject;
  hiddenConcept: string;
};

type ProblemQueueStore = {
  problems: Map<string, StoredProblem>;
  sprintQueueIds: Map<string, string[]>;
  sprintState: Map<string, SprintState>;
  inFlightQueueIds: Set<string>;
};

declare global {
  var __kynetaProblemQueueStore: ProblemQueueStore | undefined;
}

function getStore(): ProblemQueueStore {
  if (!globalThis.__kynetaProblemQueueStore) {
    globalThis.__kynetaProblemQueueStore = {
      problems: new Map(),
      sprintQueueIds: new Map(),
      sprintState: new Map(),
      inFlightQueueIds: new Set(),
    };
  }

  return globalThis.__kynetaProblemQueueStore;
}

function getSprintState(sprintId: string) {
  const store = getStore();
  const existing = store.sprintState.get(sprintId);

  if (existing) {
    return existing;
  }

  const created: SprintState = {
    nextOrdinal: INITIAL_QUEUE_ORDINAL,
    nextConceptIndex: 0,
  };

  store.sprintState.set(sprintId, created);

  return created;
}

export function formatQueueId(ordinal: number) {
  return `K-${String(ordinal).padStart(3, "0")}`;
}

function getQueueOrdinal(queueId: string) {
  const match = queueId.match(/^K-(\d+)$/);

  if (!match) {
    return Number.POSITIVE_INFINITY;
  }

  return Number.parseInt(match[1], 10);
}

function getProblemKey(sprintId: string, queueId: string) {
  return `${sprintId}:${queueId}`;
}

export function findProblemByQueueId(sprintId: string, queueId: string) {
  return getStore().problems.get(getProblemKey(sprintId, queueId)) ?? null;
}

export function getFirstProblemForSprint(sprintId: string) {
  const queueIds = getStore().sprintQueueIds.get(sprintId);

  if (!queueIds?.length) {
    return null;
  }

  return findProblemByQueueId(sprintId, queueIds[0]);
}

export function reserveNextProblem(
  sprintId: string,
  subject: GCSESubject,
): ReservedProblem {
  const store = getStore();
  const state = getSprintState(sprintId);
  const subjectConfig = getGCSESubjectConfig(subject);
  const reservation = {
    sprintId,
    queueId: formatQueueId(state.nextOrdinal),
    subject,
    hiddenConcept:
      subjectConfig.hiddenConcepts[
        state.nextConceptIndex % subjectConfig.hiddenConcepts.length
      ],
  };

  state.nextOrdinal += 1;
  state.nextConceptIndex += 1;
  store.inFlightQueueIds.add(getProblemKey(sprintId, reservation.queueId));

  return reservation;
}

export function storeProblem(
  reservation: ReservedProblem,
  payload: Omit<
    StoredProblem,
    "sprintId" | "queueId" | "subject" | "hiddenConcept" | "createdAt"
  >,
) {
  const store = getStore();
  const existingQueueIds = store.sprintQueueIds.get(reservation.sprintId) ?? [];
  const storedProblem: StoredProblem = {
    sprintId: reservation.sprintId,
    queueId: reservation.queueId,
    subject: reservation.subject,
    hiddenConcept: reservation.hiddenConcept,
    problemText: payload.problemText,
    correctAnswer: payload.correctAnswer,
    answerChoices: payload.answerChoices,
    imageBase64: payload.imageBase64,
    createdAt: new Date().toISOString(),
  };

  store.problems.set(
    getProblemKey(storedProblem.sprintId, storedProblem.queueId),
    storedProblem,
  );

  if (!existingQueueIds.includes(storedProblem.queueId)) {
    existingQueueIds.push(storedProblem.queueId);
    existingQueueIds.sort(
      (leftQueueId, rightQueueId) =>
        getQueueOrdinal(leftQueueId) - getQueueOrdinal(rightQueueId),
    );
    store.sprintQueueIds.set(reservation.sprintId, existingQueueIds);
  }

  store.inFlightQueueIds.delete(
    getProblemKey(storedProblem.sprintId, storedProblem.queueId),
  );

  return storedProblem;
}

export function releaseProblemReservation(sprintId: string, queueId: string) {
  getStore().inFlightQueueIds.delete(getProblemKey(sprintId, queueId));
}

export function hasProblemOrReservation(sprintId: string, queueId: string) {
  const store = getStore();
  const problemKey = getProblemKey(sprintId, queueId);

  return store.problems.has(problemKey) || store.inFlightQueueIds.has(problemKey);
}
