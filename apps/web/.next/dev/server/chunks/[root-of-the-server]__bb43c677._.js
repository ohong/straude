module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/apps/web/lib/supabase/server.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createClient",
    ()=>createClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$ssr$40$0$2e$6$2e$1$2b$d599ce7249005bba$2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+ssr@0.6.1+d599ce7249005bba/node_modules/@supabase/ssr/dist/module/index.js [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$ssr$40$0$2e$6$2e$1$2b$d599ce7249005bba$2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createServerClient$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+ssr@0.6.1+d599ce7249005bba/node_modules/@supabase/ssr/dist/module/createServerClient.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f$next$40$16$2e$1$2e$6$2b$67f6792bdf102c28$2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/next@16.1.6+67f6792bdf102c28/node_modules/next/headers.js [app-route] (ecmascript)");
;
;
async function createClient() {
    const cookieStore = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f$next$40$16$2e$1$2e$6$2b$67f6792bdf102c28$2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookies"])();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$ssr$40$0$2e$6$2e$1$2b$d599ce7249005bba$2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createServerClient$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createServerClient"])(("TURBOPACK compile-time value", "https://kanfzeovbmusnhmbnhit.supabase.co"), ("TURBOPACK compile-time value", "sb_publishable_yic_cI2WqErVIxpk6v8-aQ_-5ysg7uY"), {
        cookies: {
            getAll () {
                return cookieStore.getAll();
            },
            setAll (cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options })=>cookieStore.set(name, value, options));
            }
        }
    });
}
}),
"[externals]/node:crypto [external] (node:crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:crypto", () => require("node:crypto"));

module.exports = mod;
}),
"[project]/apps/web/lib/api/cli-auth.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createCliToken",
    ()=>createCliToken,
    "verifyCliToken",
    ()=>verifyCliToken
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:crypto [external] (node:crypto, cjs)");
;
function base64urlEncode(data) {
    return Buffer.from(data, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64urlDecode(str) {
    const padded = str + "=".repeat((4 - str.length % 4) % 4);
    return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}
function sign(header, payload, secret) {
    const input = `${header}.${payload}`;
    return (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["createHmac"])("sha256", secret).update(input).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function createCliToken(userId, username) {
    const secret = process.env.CLI_JWT_SECRET;
    if (!secret) throw new Error("CLI_JWT_SECRET not configured");
    const header = base64urlEncode(JSON.stringify({
        alg: "HS256",
        typ: "JWT"
    }));
    const now = Math.floor(Date.now() / 1000);
    const payload = base64urlEncode(JSON.stringify({
        sub: userId,
        username: username ?? undefined,
        iat: now,
        exp: now + 30 * 24 * 60 * 60
    }));
    const signature = sign(header, payload, secret);
    return `${header}.${payload}.${signature}`;
}
function verifyCliToken(authHeader) {
    if (!authHeader?.startsWith("Bearer ")) return null;
    const secret = process.env.CLI_JWT_SECRET;
    if (!secret) return null;
    const token = authHeader.slice(7);
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;
    // Verify signature
    const expectedSig = sign(header, payload, secret);
    const sigBuf = Buffer.from(signature, "utf-8");
    const expectedBuf = Buffer.from(expectedSig, "utf-8");
    if (sigBuf.length !== expectedBuf.length || !(0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["timingSafeEqual"])(sigBuf, expectedBuf)) {
        return null;
    }
    // Decode and check expiry
    let decoded;
    try {
        decoded = JSON.parse(base64urlDecode(payload));
    } catch  {
        return null;
    }
    const now = Math.floor(Date.now() / 1000);
    if (!decoded.sub || !decoded.exp || decoded.exp < now) {
        return null;
    }
    return decoded.sub;
}
}),
"[project]/apps/web/app/api/usage/submit/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f$next$40$16$2e$1$2e$6$2b$67f6792bdf102c28$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/next@16.1.6+67f6792bdf102c28/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$supabase$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/supabase/server.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$supabase$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+supabase-js@2.95.3/node_modules/@supabase/supabase-js/dist/index.mjs [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$api$2f$cli$2d$auth$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/api/cli-auth.ts [app-route] (ecmascript)");
;
;
;
;
const MAX_BACKFILL_DAYS = 7;
function getServiceClient() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$supabase$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["createClient"])(("TURBOPACK compile-time value", "https://kanfzeovbmusnhmbnhit.supabase.co"), process.env.SUPABASE_SECRET_KEY);
}
function isValidDate(dateStr) {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const d = new Date(dateStr);
    return !isNaN(d.getTime());
}
function isWithinBackfillWindow(dateStr) {
    const now = new Date();
    const target = new Date(dateStr);
    const diffMs = now.getTime() - target.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays >= -1 && diffDays <= MAX_BACKFILL_DAYS;
}
function validateEntry(entry) {
    if (entry.costUSD < 0) return `Negative cost for ${entry.date}`;
    if (entry.inputTokens < 0) return `Negative input tokens for ${entry.date}`;
    if (entry.outputTokens < 0) return `Negative output tokens for ${entry.date}`;
    if (entry.totalTokens < 0) return `Negative total tokens for ${entry.date}`;
    return null;
}
async function resolveUserId(request) {
    // Try CLI JWT first
    const authHeader = request.headers.get("authorization");
    const cliUserId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$api$2f$cli$2d$auth$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["verifyCliToken"])(authHeader);
    if (cliUserId) return cliUserId;
    // Fall back to Supabase session (web)
    const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$supabase$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createClient"])();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
}
async function POST(request) {
    let body;
    try {
        body = await request.json();
    } catch  {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f$next$40$16$2e$1$2e$6$2b$67f6792bdf102c28$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "Invalid JSON"
        }, {
            status: 400
        });
    }
    if (!body.entries || !Array.isArray(body.entries) || body.entries.length === 0) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f$next$40$16$2e$1$2e$6$2b$67f6792bdf102c28$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "No entries provided"
        }, {
            status: 400
        });
    }
    if (!body.source || ![
        "cli",
        "web"
    ].includes(body.source)) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f$next$40$16$2e$1$2e$6$2b$67f6792bdf102c28$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "Invalid source"
        }, {
            status: 400
        });
    }
    const userId = await resolveUserId(request);
    if (!userId) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f$next$40$16$2e$1$2e$6$2b$67f6792bdf102c28$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "Unauthorized"
        }, {
            status: 401
        });
    }
    // Validate all entries
    for (const entry of body.entries){
        if (!isValidDate(entry.date)) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f$next$40$16$2e$1$2e$6$2b$67f6792bdf102c28$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: `Invalid date: ${entry.date}`
            }, {
                status: 400
            });
        }
        if (!isWithinBackfillWindow(entry.date)) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f$next$40$16$2e$1$2e$6$2b$67f6792bdf102c28$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: `Date ${entry.date} is outside the ${MAX_BACKFILL_DAYS}-day backfill window`
            }, {
                status: 400
            });
        }
        const validationError = validateEntry(entry.data);
        if (validationError) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f$next$40$16$2e$1$2e$6$2b$67f6792bdf102c28$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: validationError
            }, {
                status: 400
            });
        }
    }
    const db = getServiceClient();
    const isVerified = body.source === "cli";
    const appUrl = ("TURBOPACK compile-time value", "http://localhost:3000") ?? "https://straude.com";
    const results = [];
    for (const entry of body.entries){
        const { data: usage, error: usageError } = await db.from("daily_usage").upsert({
            user_id: userId,
            date: entry.date,
            cost_usd: entry.data.costUSD,
            input_tokens: entry.data.inputTokens,
            output_tokens: entry.data.outputTokens,
            cache_creation_tokens: entry.data.cacheCreationTokens,
            cache_read_tokens: entry.data.cacheReadTokens,
            total_tokens: entry.data.totalTokens,
            models: entry.data.models,
            is_verified: isVerified,
            raw_hash: body.hash ?? null,
            updated_at: new Date().toISOString()
        }, {
            onConflict: "user_id,date"
        }).select("id").single();
        if (usageError || !usage) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f$next$40$16$2e$1$2e$6$2b$67f6792bdf102c28$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: `Failed to upsert usage for ${entry.date}: ${usageError?.message}`
            }, {
                status: 500
            });
        }
        // Upsert post linked to the daily_usage record
        const { data: post, error: postError } = await db.from("posts").upsert({
            user_id: userId,
            daily_usage_id: usage.id,
            updated_at: new Date().toISOString()
        }, {
            onConflict: "daily_usage_id"
        }).select("id").single();
        if (postError || !post) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f$next$40$16$2e$1$2e$6$2b$67f6792bdf102c28$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: `Failed to create post for ${entry.date}: ${postError?.message}`
            }, {
                status: 500
            });
        }
        results.push({
            date: entry.date,
            usage_id: usage.id,
            post_id: post.id,
            post_url: `${appUrl}/post/${post.id}`
        });
    }
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f$next$40$16$2e$1$2e$6$2b$67f6792bdf102c28$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        results
    });
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__bb43c677._.js.map