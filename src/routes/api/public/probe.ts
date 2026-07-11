import { createFileRoute } from "@tanstack/react-router";

// TEMPORARY diagnostic. Delete after use.
export const Route = createFileRoute("/api/public/probe")({
  server: {
    handlers: {
      GET: async () => {
        const key = process.env.INDIAN_STOCK_API_KEY ?? "";
        return Response.json({
          keyPresent: key.length > 0,
          keyLength: key.length,
          keyPrefix: key.slice(0, 3),
          keySuffix: key.slice(-2),
          hasWhitespace: /\s/.test(key),
        });
      },
    },
  },
});
