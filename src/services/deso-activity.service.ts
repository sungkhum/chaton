const GRAPHQL_ENDPOINT = "https://graphql-prod.deso.com/graphql";

/**
 * Batch-fetch last on-chain activity timestamps for DeSo users via GraphQL.
 * Uses aliased queries to fetch up to 20 users per request.
 */
export async function fetchDesoActivity(
  publicKeys: string[]
): Promise<Record<string, string>> {
  if (publicKeys.length === 0) return {};

  const result: Record<string, string> = {};
  const chunks: string[][] = [];
  for (let i = 0; i < publicKeys.length; i += 20) {
    chunks.push(publicKeys.slice(i, i + 20));
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      const aliases = chunk
        .map(
          (pk, i) =>
            `user${i}: transactions(filter: { publicKey: { equalTo: "${pk}" } }, orderBy: [TIMESTAMP_DESC], first: 1) { nodes { publicKey timestamp } }`
        )
        .join("\n");

      const query = `query { ${aliases} }`;

      try {
        const res = await fetch(GRAPHQL_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });

        if (!res.ok) return;

        const json = (await res.json()) as {
          data?: Record<
            string,
            { nodes: { publicKey: string; timestamp: string }[] }
          >;
        };
        if (!json.data) return;

        for (const alias of Object.values(json.data)) {
          if (alias.nodes?.[0]) {
            result[alias.nodes[0].publicKey] = alias.nodes[0].timestamp;
          }
        }
      } catch {
        // Best-effort — don't block on GraphQL failures
      }
    })
  );

  return result;
}
