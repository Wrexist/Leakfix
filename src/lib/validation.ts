import { z } from "zod";

export const createScanSchema = z.object({
  url: z.string().trim().min(1, "Enter a website address to scan.").max(2048),
});

export type CreateScanInput = z.infer<typeof createScanSchema>;
