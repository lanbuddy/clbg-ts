import { ReadStream, statSync } from "fs";
import { ProgressReporter } from "./progressReporter";
import { Readable } from "stream";
import { createHash } from "crypto";

const generateHash = (
  reader: Readable,
  progressReporter?: ProgressReporter
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    if (progressReporter) {
      if (reader instanceof ReadStream) {
        progressReporter.advance("hashing");
        progressReporter.setTotalData(statSync(reader.path).size);
      } else {
        throw new Error(
          "If you want to use a ProgressReporter, the reader must be a ReadStream."
        );
      }
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
