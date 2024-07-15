import { Readable } from "stream";
import { createHash } from "crypto";

const generateHash = (reader: Readable): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const hash = createHash("blake2s256");
    reader.pause();
    reader.on("data", (chunk) => hash.update(chunk));
    reader.on("end", () => resolve(hash.digest()));
    reader.on("error", reject);
    reader.resume();
  });

export { generateHash };
