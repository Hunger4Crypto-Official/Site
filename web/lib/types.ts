export type Section = {
  heading?: string;
  body?: string;
  bodyMarkdown?: string;
};

export type Article = {
  slug: string;
  title: string;
  description?: string;
  coverImage?: string | null;
  updatedAt?: string | null;
  sections?: Section[];  // keep optional for resilience
};
