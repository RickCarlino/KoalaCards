import { File, Storage } from "@google-cloud/storage";
import { createHash } from "crypto";
import fetch from "node-fetch";
import { errorReport } from "./error-report";

const creds = JSON.parse(process.env.GCP_JSON_CREDS || "false");
const bucketName = process.env.GCS_BUCKET_NAME || "";

if (!bucketName) {
  errorReport("Missing ENV Var: GCS_BUCKET_NAME");
}

if (!creds) {
  errorReport("Missing GCP_JSON_CREDS");
}

const storage = new Storage({
  projectId: creds.project_id,
  credentials: creds,
});

export const bucket = storage.bucket(bucketName);

export async function expiringUrl(blob: File) {
  const [url] = await blob.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 3600 * 1000, // URL expires in 1 hour
  });
  return url;
}

/**
 * Uploads a file from a URL to Google Cloud Storage.
 * @param url The URL of the file to download.
 * @param destination The destination path in the bucket.
 */
export async function storeURLGoogleCloud(
  url: string,
  destination: string,
): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok)
      return errorReport(`Failed to fetch ${url}: ${response.statusText}`);

    const blob = bucket.file(destination);
    blob.cloudStorageURI;
    const blobStream = blob.createWriteStream();

    response.body.pipe(blobStream);

    return new Promise((resolve, reject) => {
      blobStream.on("finish", async () => {
        console.log("File uploaded successfully");
        resolve(await expiringUrl(blob));
      });
      blobStream.on("error", (error) => {
        console.error("Upload failed:", error);
        reject(error);
      });
    });
  } catch (error) {
    console.error("Failed to upload file:", error);
    throw error;
  }
}

/** Creates a hex MD5 checksum with file extension
 * Example: cards/0b1d578f7d3b0e8d7e9e6d5f3e0f4f3a.jpg
 */
export const createBlobID = (kind: string, content: string, ext: string) => {
  const hash = createHash("md5").update(content).digest("base64url");
  return `${kind}/${hash}.${ext}`;
};
