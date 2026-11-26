"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { OnlineError } from "./api";

/**
 * What the pages read from the server and keep fresh goes through TanStack
 * Query: the rankings, which are asked again every half minute while the page
 * is in view, and the profile page's account. It gives every screen that
 * shows the same data one copy of it, and one place that decides when to ask
 * again.
 *
 * A challenge room is the exception. It has its own loop (use-room.ts),
 * because it measures time against the server's clock and changes its pace
 * with the state of the race.
 */
function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        // An answer from the server is final: no database, no such room. Only a failed connection or a server error is worth another try.
        retry: (failures, error) => failures < 2 && (!(error instanceof OnlineError) || error.status === 0 || error.status >= 500) && !(error instanceof OnlineError && error.code === "unavailable"),
        retryDelay: (attempt) => Math.min(800 * 2 ** attempt, 5_000),
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  // One client per page load, made on the first render. It never crosses requests on the server.
  const [client] = useState(makeClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
