// Run with: npm run test:r2
// Uploads a tiny text object to Cloudflare R2 and verifies its public URL.
// This script logs the object key, public URL, and public fetch result only.

import "dotenv/config";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

const accountId = requiredEnv("CLOUDFLARE_R2_ACCOUNT_ID");
const accessKeyId = requiredEnv("CLOUDFLARE_R2_ACCESS_KEY_ID");
const secretAccessKey = requiredEnv("CLOUDFLARE_R2_SECRET_ACCESS_KEY");
const bucketName = requiredEnv("CLOUDFLARE_R2_BUCKET_NAME");
const publicUrlBase = requiredEnv("CLOUDFLARE_R2_PUBLIC_URL").replace(
  /\/+$/,
  ""
);
const key = `test/r2-test-${Date.now()}.txt`;
const body = `r2 upload test ${new Date().toISOString()}\n`;
const publicUrl = `${publicUrlBase}/${key}`;

const client = new S3Client({
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  region: "auto",
});

await client.send(
  new PutObjectCommand({
    Body: body,
    Bucket: bucketName,
    ContentType: "text/plain; charset=utf-8",
    Key: key,
  })
);

const response = await fetch(publicUrl, { cache: "no-store" });
const responseText = response.ok ? await response.text() : "";
const contentMatches = responseText === body;

console.log(`uploaded object key: ${key}`);
console.log(`public URL: ${publicUrl}`);
console.log(`public fetch status: ${response.status}`);
console.log(`public fetch ok: ${response.ok}`);
console.log(`content matches: ${contentMatches}`);

if (!response.ok || !contentMatches) {
  process.exitCode = 1;
}
