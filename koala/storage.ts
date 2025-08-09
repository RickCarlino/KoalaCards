import { File, Storage } from "@google-cloud/storage";
import { createHash } from "crypto";
import fetch from "node-fetch";
import { errorReport } from "./error-report";

// Storage interface for future implementations
export interface StorageProvider {
  /**
   * Uploads a file from a URL to storage.
   * @param url The URL of the file to download.
   * @param destination The destination path in storage.
   * @returns Promise resolving to the expiring URL of the uploaded file.
   */
  uploadFromURL(url: string, destination: string): Promise<string>;

  /**
   * Generates an expiring URL for accessing a stored file.
   * @param destination The path to the file in storage.
   * @returns Promise resolving to the signed URL.
   */
  getExpiringURL(destination: string): Promise<string>;

  /**
   * Creates a blob ID with MD5 hash and extension.
   * @param kind The category/folder for the blob.
   * @param content The content to hash.
   * @param ext The file extension.
   * @returns The blob ID string.
   */
  createBlobID(kind: string, content: string, ext: string): string;

  /**
   * Gets a file object for direct operations (GCS-specific for now).
   * @param destination The path to the file in storage.
   * @returns The file object.
   */
  getFile(destination: string): File;

  /**
   * Saves buffer data to storage.
   * @param destination The path to save the file.
   * @param buffer The buffer data to save.
   * @param options Save options like metadata.
   * @returns Promise that resolves when save is complete.
   */
  saveBuffer(
    destination: string,
    buffer: Buffer,
    options?: { metadata?: { contentType: string } },
  ): Promise<void>;

  /**
   * Checks if a file exists in storage.
   * @param destination The path to check.
   * @returns Promise resolving to [exists] tuple.
   */
  fileExists(destination: string): Promise<[boolean]>;
}

// Google Cloud Storage implementation
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
      expires: Date.now() + 3600 * 1000, // URL expires in 1 hour
    });
    return url;
  }

  async uploadFromURL(url: string, destination: string): Promise<string> {
    // SUSPECT.
    console.log(`Downloading from ${url} to ${destination}`);
    const response = await fetch(url);
    if (!response.ok) {
      return errorReport(`Failed to fetch ${url}: ${response.statusText}`);
    }

    const blob = this.bucket.file(destination);
    const blobStream = blob.createWriteStream();

    response.body.pipe(blobStream);

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

// Create the storage provider instance. We can default to the existing GCS implementation.
const storageProvider = new GCSStorageProvider();

// Export the new provider-agnostic interface
export { storageProvider };
