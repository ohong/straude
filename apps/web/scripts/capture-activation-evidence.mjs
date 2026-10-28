import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

// Local receiver for real app journeys. Never forwards fixtures to PostHog.
const output = resolve(process.argv[2] ?? "test-results/activation-capture.json");
const events = [];
const identities = new Map();
const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/events") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(events));
    return;
  }
  if (request.method !== "POST" || request.url !== "/capture/") {
    response.writeHead(404).end();
    return;
  }
  try {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    if (body.api_key !== "phc_local_runtime_evidence") {
      response.writeHead(401).end();
      return;
    }
    // Preserve identity joins without saving even disposable account identifiers.
    if (!identities.has(body.distinct_id)) identities.set(body.distinct_id, `local-user-${identities.size + 1}`);
    events.push({
      received_at: new Date().toISOString(),
      event: body.event,
      identity: identities.get(body.distinct_id),
      property_names: Object.keys(body.properties ?? {}).sort(),
      surface: body.properties?.surface ?? null,
      activation_state: body.properties?.activation_state ?? null,
    });
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(events, null, 2)}\n`, { mode: 0o600 });
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end('{"status":1}');
    console.log(`${body.event}: captured`);
  } catch {
    response.writeHead(400).end();
  }
});

server.listen(3118, "127.0.0.1", () => {
  console.log(`Local activation receiver: http://127.0.0.1:3118; evidence: ${output}`);
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close());
