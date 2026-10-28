import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

// Local receiver for real app journeys. Never forwards fixtures to PostHog.
// Stores only pseudonyms and selected non-sensitive properties; no keys, cookies,
// email addresses, URLs, auth tokens, raw distinct IDs or raw insertion IDs.
const output = resolve(process.argv[2] ?? "test-results/activation-capture.json");
const port = Number(process.env.ACTIVATION_CAPTURE_PORT ?? 3118);
const events = [];
const identities = new Map();
let persist = Promise.resolve();
const pseudonym = (value) => createHash("sha256").update(String(value)).digest("hex").slice(0, 20);
function identity(value) {
  if (typeof value !== "string" || !value) return null;
  if (!identities.has(value)) identities.set(value, `local-user-${identities.size + 1}`);
  return identities.get(value);
}

const server = createServer(async (request, response) => {
  const path = new URL(request.url ?? "/", "http://localhost").pathname;
  if (request.method === "GET" && path === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ boundary: "loopback receiver acceptance", count: events.length }));
    return;
  }
  if (request.method === "GET" && path === "/events") {
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify(events));
    return;
  }
  if (request.method !== "POST" || !["/capture/", "/e/", "/batch/"].includes(path)) {
    response.writeHead(404).end();
    return;
  }
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 2_000_000) throw new Error("Fixture body exceeds receiver limit");
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const decoded = request.headers["content-encoding"] === "gzip" ? gunzipSync(buffer) : buffer;
    const body = JSON.parse(decoded.toString());
    const captures = Array.isArray(body) ? body : Array.isArray(body.batch) ? body.batch : [body];
    if (!captures.length || captures.some((capture) =>
      (capture.api_key ?? capture.properties?.token ?? body.api_key) !== "phc_local_runtime_evidence"
      || typeof capture.event !== "string"
      || typeof (capture.distinct_id ?? capture.properties?.distinct_id) !== "string")) {
      response.writeHead(401).end();
      return;
    }
    for (const capture of captures) {
      const properties = capture.properties ?? {};
      const insertId = capture.uuid ?? properties.$insert_id;
      events.push({
        received_at: new Date().toISOString(),
        boundary: "receiver_accepted",
        transport: path === "/capture/" ? "server_capture" : "sdk_capture",
        event: capture.event,
        identity: identity(capture.distinct_id ?? properties.distinct_id),
        anonymous_identity: identity(properties.$anon_distinct_id),
        // Equality is retained without exposing account IDs embedded in IDs.
        insert_id: typeof insertId === "string" ? pseudonym(insertId) : null,
        property_names: Object.keys(properties).sort(),
        surface: properties.surface ?? null,
        activation_state: properties.activation_state ?? null,
        has_analytics_consent: properties.has_analytics_consent ?? null,
      });
    }
    persist = persist.then(async () => {
      await mkdir(dirname(output), { recursive: true });
      await writeFile(output, `${JSON.stringify(events, null, 2)}\n`, { mode: 0o600 });
    });
    await persist;
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end('{"status":1}');
    console.log(`${captures.length} analytics event(s): receiver accepted`);
  } catch {
    response.writeHead(400).end();
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Local activation receiver: http://127.0.0.1:${port}; evidence: ${output}`);
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close());
