export type Section = {
  heading?: string;
  /** HTML string produced from bodyMarkdown; optional for resilience */
  body?: string;
  /** Source Markdown (optional in data files; not exposed to UI) */
  bodyMarkdown?: string;
};

export type Article = {
  slug: string;
  title: string;
  description?: string;
  coverImage?: string;
  updatedAt?: string;
  sections: Section[];
};
