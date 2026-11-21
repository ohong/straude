import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import sharp from "sharp";
import assert from "node:assert/strict";

const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
assert(["localhost", "127.0.0.1"].includes(url.hostname));
const db = createClient(url.href, process.env.SUPABASE_SECRET_KEY, {auth:{persistSession:false}});
const bucket = db.storage.from("team-favicons");
const png = await sharp({create:{width:128,height:64,channels:4,background:"#DF561F"}}).png().toBuffer();
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 64" width="128" height="64"><rect width="128" height="64" fill="#DF561F"/></svg>');
for (const strategy of ["per-case", "shared"]) {
  let failed = 0, attempts = 0;
  async function worker(){
    for (let i=0;i<40;i++) {
      const paths=[];
      try {
        for (const [ext,bytes,type] of [["svg",svg,"image/svg+xml"],["png",png,"image/png"]]){
          const path = "probe-"+randomUUID()+".example."+ext;
          attempts++;
          const {error} = await bucket.upload(path,bytes,{contentType:type});
          if(error){
            failed++; console.log(strategy,ext,error.name,error.statusCode,error.message); continue;
          }
          paths.push(path);
          const {data,error:readError}=await bucket.download(path);
          if (readError || !Buffer.from(await data.arrayBuffer()).equals(bytes)) {failed++;console.log(strategy,ext,"readback failed",readError?.message);}
          if(strategy==="per-case"){assert.equal((await bucket.remove(paths)).error,null);paths.length=0;}
          await delay(15);
        }
      } finally {if(paths.length)assert.equal((await bucket.remove(paths)).error,null);}
    }
  }
  await Promise.all([worker(),worker()]);
  console.log(JSON.stringify({strategy,attempts,failed}));
  if(strategy==="shared")assert.equal(failed,0);
}
