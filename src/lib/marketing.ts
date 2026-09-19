export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  company: string;
}

/**
 * Customer proof. Add real, verifiable testimonials here before launch.
 * Do not invent names, companies, or results — fake social proof is deceptive
 * and a legal risk. The page handles an empty list gracefully.
 */
export const TESTIMONIALS: Testimonial[] = [];

/** Logos of real customers/partners, once you have permission to display them. */
export const CUSTOMER_LOGOS: { name: string; src: string }[] = [];
