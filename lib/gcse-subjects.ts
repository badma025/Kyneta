export const SUPPORTED_GCSE_SUBJECTS = [
  "maths",
  "biology",
  "chemistry",
  "physics",
] as const;

export type GCSESubject = (typeof SUPPORTED_GCSE_SUBJECTS)[number];

type GCSESubjectConfig = {
  label: string;
  localFileName: string;
  fileUriEnvVar: string;
  hiddenConcepts: string[];
};

export const DEFAULT_GCSE_SUBJECT: GCSESubject = "maths";

export const GCSE_SUBJECT_CONFIG: Record<GCSESubject, GCSESubjectConfig> = {
  maths: {
    label: "GCSE Maths",
    localFileName: "maths.pdf",
    fileUriEnvVar: "GCSE_MATHS_FILE_URI",
    hiddenConcepts: [
      "proportional reasoning under constraints",
      "graph gradient and intercept interpretation",
      "simultaneous equation balance states",
      "geometric angle dependencies",
      "probability through dependent events",
      "algebraic rearrangement invariants",
    ],
  },
  biology: {
    label: "GCSE Biology",
    localFileName: "biology.PDF",
    fileUriEnvVar: "GCSE_BIOLOGY_FILE_URI",
    hiddenConcepts: [
      "diffusion across concentration gradients",
      "enzyme activity under changing conditions",
      "inheritance through dominant and recessive traits",
      "cell specialization and transport demands",
      "ecosystem feedback through food webs",
      "homeostasis with negative feedback loops",
    ],
  },
  chemistry: {
    label: "GCSE Chemistry",
    localFileName: "chemistry.PDF",
    fileUriEnvVar: "GCSE_CHEMISTRY_FILE_URI",
    hiddenConcepts: [
      "particle collision frequency and rate",
      "ionic transfer and electrostatic attraction",
      "equilibrium shifts under system change",
      "energy profiles during reactions",
      "acid-base neutralization states",
      "bonding structure and physical properties",
    ],
  },
  physics: {
    label: "GCSE Physics",
    localFileName: "physics.PDF",
    fileUriEnvVar: "GCSE_PHYSICS_FILE_URI",
    hiddenConcepts: [
      "resultant force and acceleration response",
      "circuit current and potential distribution",
      "wave behavior through media changes",
      "energy transfer through mechanical systems",
      "moment balance around pivots",
      "pressure variation across confined systems",
    ],
  },
};

export function isGCSESubject(value: string): value is GCSESubject {
  return SUPPORTED_GCSE_SUBJECTS.includes(value as GCSESubject);
}

export function normalizeGCSESubject(value?: string | null): GCSESubject {
  if (!value) {
    return DEFAULT_GCSE_SUBJECT;
  }

  const normalized = value.trim().toLowerCase();

  return isGCSESubject(normalized) ? normalized : DEFAULT_GCSE_SUBJECT;
}

export function getGCSESubjectConfig(subject: GCSESubject) {
  return GCSE_SUBJECT_CONFIG[subject];
}

export function getDefaultHiddenConcept(subject: GCSESubject) {
  return GCSE_SUBJECT_CONFIG[subject].hiddenConcepts[0];
}
