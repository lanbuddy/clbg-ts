import { ReadStream, statSync } from "fs";
import { ProgressReporter } from "./progressReporter";
import { createHash } from "crypto";

const generateHash = (
  reader: ReadStream,
  progressReporter?: ProgressReporter
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    if (progressReporter) {
      progressReporter.advance("hashing");
      progressReporter.setTotalData(statSync(reader.path).size);
    }

    const hash = createHash("sha512-256");

    reader.on("data", (chunk) => {
      if (progressReporter) {
        progressReporter.updateData(chunk.length);
      }
      hash.update(chunk);
    });

    reader.on("end", () => {
      resolve(hash.digest());
    });

    reader.on("error", reject);
  });

export { generateHash };
