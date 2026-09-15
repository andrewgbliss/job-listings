export type WorkExperience = {
  company: string;
  location: Address;
  from: Date;
  to: Date;
  skills: Array<string>;
  /** Skills from this job that also appear in the listing. */
  matchedSkills?: Array<string>;
  bulletpoints: Array<string>;
  url?: string;
};

export type Address = {
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type Education = {
  school: string;
  from: Date;
  to: Date;
  name: string;
};

export type ResumeOptions = {
  name: string;
  email: string;
  tagline: string;
  phone: string;
  backgroundParagraphs?: Array<string>;
  address: Address;
  education: Education;
  workExperience: Array<WorkExperience>;
  links: Array<string>;
};

export type ResumeDocument = ResumeOptions & {
  id: string;
  tags?: Array<string>;
  /** Job listing this resume was tailored from. */
  sourceUrl?: string;
  /** Search/results page the listing was scraped from. */
  searchUrl?: string;
  /** ISO datetime the listing was captured or last processed. */
  processedAt?: string;
  /** Hiring company from the listing. Tables only — not shown on the resume. */
  company?: string;
  /** Listing-matched skills for the top Skills section. */
  skills?: Array<string>;
};
