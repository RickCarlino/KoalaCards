import { httpLink } from "@trpc/client";
import { createTRPCNext } from "@trpc/next";
import type { AppRouter } from "./trpc-routes/main";
import superjson from "superjson";

function getBaseUrl() {
  if (typeof window !== "undefined") {
    // browser should use relative path
    return "";
  }

  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }

  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export const trpc = createTRPCNext<AppRouter>({
  config(_) {
    return {
      transformer: superjson,
      links: [
        httpLink({
          url: `${getBaseUrl()}/api/trpc`,
          async headers() {
            return {};
          },
        }),
      ],
    };
  },
  /** @link https://trpc.io/docs/ssr **/
  ssr: false,
});
