// One-time, explicit recovery. Normal site builds never fetch from Lovable.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
const root = process.cwd();
const manifest = JSON.parse(await readFile(resolve(root, "scripts/catalog-data/legacy-photo-manifest.json"), "utf8"));
const origin = "https://id-preview--23873149-1357-4ff5-be84-ddd24ee8a99c.lovable.app";
if (manifest.sourceOrigin !== origin || !Array.isArray(manifest.assets) || manifest.assets.length > 2000) throw Error("Invalid recovery manifest");
const pattern = /^\/__l5e\/assets-v1\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[A-Za-z0-9_.-]{1,200}\.(?:jpg|png|webp)$/;
const paths = new Set();
for (const asset of manifest.assets) {
  if (!pattern.test(asset.path) || paths.has(asset.path)) throw Error("Invalid or duplicate asset path");
  paths.add(asset.path);
}
function verify(data, asset) {
  if (data.length < 16 || data.length > 20 * 1024 * 1024 || (asset.size && data.length !== asset.size)) throw Error("Unexpected image size");
  const png = data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpg = data[0] === 255 && data[1] === 216 && data[2] === 255;
  const webp = data.toString("ascii",0,4) === "RIFF" && data.toString("ascii",8,12) === "WEBP";
  if (!(asset.path.endsWith(".png") ? png : asset.path.endsWith(".jpg") ? jpg : webp)) throw Error("Image signature does not match extension");
}
async function recover(asset) {
  const file = resolve(root, "public", asset.path.slice(1));
  try { const data = await readFile(file); verify(data,asset); return {path:asset.path,bytes:data.length,sha256:createHash("sha256").update(data).digest("hex")}; } catch {}
  let last;
  for (let attempt=0;attempt<3;attempt++) {
    try {
      const response = await fetch(origin + asset.path, { signal: AbortSignal.timeout(30000), redirect:"error" });
      if (!response.ok || !/^image\/(?:jpeg|png|webp)(?:;|$)/i.test(response.headers.get("content-type") ?? "")) throw Error(`HTTP ${response.status}: not an image`);
      const chunks=[];let size=0;
      for await (const chunk of response.body) { size+=chunk.length; if(size>20*1024*1024) throw Error("Image too large"); chunks.push(chunk); }
      const data=Buffer.concat(chunks); verify(data,asset);
      await mkdir(dirname(file),{recursive:true});await writeFile(file,data);
      return {path:asset.path,bytes:data.length,sha256:createHash("sha256").update(data).digest("hex")};
    } catch(error) { last=error; if(attempt<2) await new Promise(r=>setTimeout(r,500*(attempt+1))); }
  }
  throw new Error(`${asset.path}: ${last?.message ?? "Download failed"}`);
}
const files=[], failures=[];
let cursor=0,done=0;
await Promise.all(Array.from({length:8},async()=>{
  while(cursor<manifest.assets.length) {
    const asset=manifest.assets[cursor++];
    try { files.push(await recover(asset)); } catch(error) { failures.push({path:asset.path,error:error.message}); }
    done++;if(done%50===0 || done===manifest.assets.length) console.log(`${done}/${manifest.assets.length} checked; failures=${failures.length}`);
  }
}));
files.sort((a,b)=>a.path.localeCompare(b.path));
const report={sourceOrigin:origin,completedAt:new Date().toISOString(),expected:manifest.assets.length,recovered:files.length,totalBytes:files.reduce((n,f)=>n+f.bytes,0),failures,files};
await writeFile(resolve(root,"docs/legacy-photo-recovery.json"),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({expected:report.expected,recovered:report.recovered,totalBytes:report.totalBytes,failures:report.failures.length}));
if(failures.length) throw Error("Recovery incomplete; assets will not be committed");
