import { File, Storage } from "@google-cloud/storage";
import { createHash } from "crypto";
import { errorReport } from "./error-report";
import { requireEnv, parseJsonEnv } from "./utils/env";
import { isGcpCreds } from "./types/gcp-creds";

export interface StorageProvider {
  uploadFromBase64(url: string, destination: string): Promise<string>;

  getExpiringURL(destination: string): Promise<string>;

  createBlobID(kind: string, content: string, ext: string): string;

  getFile(destination: string): File;

  saveBuffer(
    destination: string,
    buffer: Buffer,
    options?: { metadata?: { contentType: string } },
  ): Promise<void>;

  fileExists(destination: string): Promise<[boolean]>;
}

class GCSStorageProvider implements StorageProvider {
  private storage: Storage;
  private bucketName: string;

  constructor() {
    this.bucketName = requireEnv("GCS_BUCKET_NAME", errorReport);
    const rawCreds = parseJsonEnv("GCP_JSON_CREDS", errorReport);
    if (!isGcpCreds(rawCreds)) {
      errorReport("Invalid GCP_JSON_CREDS");
      throw new Error("Invalid GCP_JSON_CREDS");
    }

    this.storage = new Storage({
      projectId: rawCreds.project_id,
      credentials: rawCreds,
    });
  }

  private get bucket() {
    return this.storage.bucket(this.bucketName);
  }

  getFile(destination: string): File {
    return this.bucket.file(destination);
  }

  async fileExists(destination: string): Promise<[boolean]> {
    return await this.bucket.file(destination).exists();
  }

  async saveBuffer(
    destination: string,
    buffer: Buffer,
    options?: { metadata?: { contentType: string } },
  ): Promise<void> {
    await this.bucket.file(destination).save(buffer, options);
  }

  async getExpiringURL(destination: string): Promise<string> {
    const blob = this.bucket.file(destination);
    const [url] = await blob.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 3600 * 1000,
    });
    return url;
  }

  async uploadFromBase64(
    base64: string,
    destination: string,
  ): Promise<string> {
    const blob = this.bucket.file(destination);
    const blobStream = blob.createWriteStream();
    const buffer = Buffer.from(base64, "base64");
    blobStream.end(buffer);
    return new Promise((resolve, reject) => {
      blobStream.on("finish", async () => {
        resolve(await this.getExpiringURL(destination));
      });
      blobStream.on("error", (error) => {
        reject(error);
      });
    });
  }

  createBlobID(kind: string, content: string, ext: string): string {
    const hash = createHash("md5").update(content).digest("base64url");
    return `${kind}/${hash}.${ext}`;
  }
}

const storageProvider = new GCSStorageProvider();

export { storageProvider };
