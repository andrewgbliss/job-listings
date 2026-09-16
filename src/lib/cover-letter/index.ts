import {
  coverLetterFileName,
  coverLetterHref,
  createCoverLetterFromJobListing,
  loadMainCoverLetterTemplate,
  tailorCoverLetter,
  type CoverLetterDocument,
  type TailorCoverLetterInput,
} from "./from-job-listing";
import { getCoverLetterById } from "./documents";

export {
  coverLetterFileName,
  coverLetterHref,
  createCoverLetterFromJobListing,
  getCoverLetterById,
  loadMainCoverLetterTemplate,
  tailorCoverLetter,
};
export type { CoverLetterDocument, TailorCoverLetterInput };
