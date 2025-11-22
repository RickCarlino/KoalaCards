import { File, Storage } from "@google-cloud/storage";
import { createHash } from "crypto";
import { errorReport } from "./error-report";

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
    const creds = JSON.parse(process.env.GCP_JSON_CREDS || "false");
    this.bucketName = process.env.GCS_BUCKET_NAME || "";

    if (!this.bucketName) {
      errorReport("Missing ENV Var: GCS_BUCKET_NAME");
    }

    if (!creds) {
      errorReport("Missing GCP_JSON_CREDS");
    }

    this.storage = new Storage({
      projectId: creds.project_id,
      credentials: creds,
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
