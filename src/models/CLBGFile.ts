import * as compressing from "compressing";
import { HEADER_CONSTANTS, Header } from "./Header";
import {
  PathLike,
  createReadStream,
  createWriteStream,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "fs";
import { ProgressReport, ProgressReporter } from "../utils/progressReporter";
import { Metadata } from "./Metadata";
import { checkPathExists } from "../utils/checkPath";
import { createHash } from "crypto";
import { generateHash } from "../utils/hashGenerator";
import { join } from "path";
import { open } from "fs/promises";
import { pipeline } from "stream/promises";

const EMPTY_BUFFER_LENGTH = 0;
const EMPTY_DIR_LENGTH = 0;

interface CreateOptions {
  sourceDirectory: PathLike;
  coverFile: PathLike | Buffer;
  metadata: Metadata;
  targetFile: PathLike;
  overwrite?: boolean;
}

interface CLBGFileConstructorOptions {
  filePath: PathLike;
  header: Header;
  metadata: Metadata;
  cover: string;
}

/**
 * Represents a CLBG file.
 */
export class CLBGFile {
  filePath: PathLike;
  header: Header;
  metadata: Metadata;
  cover: string;

  /**
   * Creates a new instance of CLBGFile.
   * @param filePath The path of the CLBG file.
   * @param header The header of the CLBG file.
   * @param metadata The metadata of the CLBG file.
   */
  constructor(options: CLBGFileConstructorOptions) {
    this.filePath = options.filePath;
    this.header = options.header;
    this.metadata = options.metadata;
    this.cover = options.cover;
  }

  /**
   * Gets the cover image from a CLBG file.
   * @param targetPath The path of the CLBG file.
   * @param header The header of the CLBG file. If not provided, it will be read from the file.
   * @returns A Promise that resolves to the cover image as a base64 string.
   */
  static async getCoverFromFile(
    targetPath: PathLike,
    header?: Header
  ): Promise<string> {
    const usableHeader = header || (await Header.fromFile(targetPath));
    const fileHandle = await open(targetPath, "r");
    const coverBuffer = Buffer.alloc(usableHeader.coverLength);
    await fileHandle.read(
      coverBuffer,
      0,
      usableHeader.coverLength,
      usableHeader.coverOffset
    );
    await fileHandle.close();
    return coverBuffer.toString("base64");
  }

  /**
   * Creates a CLBGFile instance from a file.
   * @param targetPath The path of the CLBG file.
   * @returns A Promise that resolves to a CLBGFile instance.
   */
  static async fromFile(targetPath: PathLike): Promise<CLBGFile> {
    checkPathExists(targetPath, "file");
    const header = await Header.fromFile(targetPath);
    const metadata = await Metadata.fromFile(targetPath, header);
    const cover = await CLBGFile.getCoverFromFile(targetPath, header);
    return new CLBGFile({ cover, filePath: targetPath, header, metadata });
  }

  /**
   * Validates the archive hash of the CLBG file.
   * @returns A Promise that resolves to a boolean indicating whether the archive hash is valid.
   */
  private async validateArchiveHash(
    progressReporter?: ProgressReporter
  ): Promise<boolean> {
    const fileStream = createReadStream(this.filePath, {
      start: this.header.archiveOffset,
    });

    await new Promise((resolve) => {
      fileStream.on("ready", resolve);
    });

    const archiveHash = await generateHash(fileStream, progressReporter);

    return archiveHash.equals(this.header.archiveHash);
  }

  private async extractArchiveToDirectory(
    targetDirectory: PathLike,
    progressReporter: ProgressReporter
  ): Promise<void> {
    progressReporter.advance("decompressing");
    progressReporter.setTotalData(statSync(this.filePath).size);

    const fileStream = createReadStream(this.filePath, {
      start: this.header.archiveOffset,
    });

    fileStream.on("data", (chunk) => {
      progressReporter.updateData(chunk.length);
    });
    fileStream.on("end", () => {
      fileStream.close();
    });

    await compressing.tgz.uncompress(fileStream, targetDirectory.toString());
  }

  /**
   * Extracts the game files from the CLBG file to a target directory.
   * @param targetDirectory The target directory to extract the game files to.
   * @returns A Promise that resolves when the extraction is complete.
   */
  async extractGame(
    targetDirectory: PathLike,
    onProgress?: (progressReport: ProgressReport) => void
  ): Promise<void> {
    const progressReporter = new ProgressReporter({
      callback: onProgress,
      totalSteps: 2,
    });

    checkPathExists(targetDirectory, "directory");

    if (readdirSync(targetDirectory).length > EMPTY_DIR_LENGTH) {
      throw new Error(`Target directory is not empty: ${targetDirectory}`);
    }
    if (!(await this.validateArchiveHash(progressReporter))) {
      throw new Error("Archive hash does not match the one in the header.");
    }

    await this.extractArchiveToDirectory(targetDirectory, progressReporter);

    progressReporter.complete();
  }

  /**
   * Saves the cover image from the CLBG file to a target file.
   * @param targetFile The target file to save the cover image to.
   */
  saveCover(targetFile: PathLike): void {
    const coverBuffer = Buffer.from(this.cover, "base64");
    writeFileSync(targetFile, coverBuffer);
  }

  /**
   * Save metadata to a target file.
   * @param targetFile The target file to save the metadata to.
   */
  saveMetadata(targetFile: PathLike): void {
    writeFileSync(targetFile, this.metadata.toJSON());
  }

  /**
   * Gets the total number of files in a directory.
   * @param directoryPath The path of the directory.
   * @returns The total number of files in the directory.
   */
  static getTotalFiles(directoryPath: PathLike): number {
    const incrementor = 1;
    let totalFiles = 0;
    const files = readdirSync(directoryPath);
    for (const file of files) {
      const filePath = join(directoryPath.toString(), file);
      const stats = statSync(filePath);
      if (stats.isDirectory()) {
        totalFiles += this.getTotalFiles(filePath);
      } else {
        totalFiles += incrementor;
      }
    }
    return totalFiles;
  }

  /**
   * Gets the total size of a directory.
   * @param directoryPath The path of the directory.
   * @returns The total size of the directory.
   */
  static getTotalSize(directoryPath: PathLike): number {
    let totalSize = 0;

    const calculateSize = (directory: PathLike) => {
      const files = readdirSync(directory, { withFileTypes: true });

      files.forEach((file) => {
        const filePath = join(directory.toString(), file.name);
        if (file.isDirectory()) {
          calculateSize(filePath);
        } else {
          const stats = statSync(filePath);
          totalSize += stats.size;
        }
      });
    };

    calculateSize(directoryPath);
    return totalSize;
  }

  /* eslint-disable max-statements */

  /**
   * Writes the CLBG file to a target file.
   * @param options The options for writing the CLBG file.
   * @param onProgress The callback for progress reporting.
   * @returns A Promise that resolves to a CLBGFile instance.
   */
  static async create(
    options: CreateOptions,
    onProgress?: (progressReport: ProgressReport) => void
  ): Promise<CLBGFile> {
    if (existsSync(options.targetFile) && !options.overwrite) {
      throw new Error(`Target path already exists: ${options.targetFile}`);
    }

    const progressReporter = new ProgressReporter({
      callback: onProgress,
      totalSteps: 1,
    });

    progressReporter.advance("packing");

    checkPathExists(options.sourceDirectory, "directory");

    let coverBytes: Buffer = Buffer.alloc(EMPTY_BUFFER_LENGTH);
    if (Buffer.isBuffer(options.coverFile)) {
      coverBytes = options.coverFile;
    } else if (typeof options.coverFile === "string") {
      checkPathExists(options.coverFile, "file");
      coverBytes = readFileSync(options.coverFile);
    }

    const header = Header.fromData(
      options.metadata.toBytes(),
      coverBytes,
      Buffer.alloc(HEADER_CONSTANTS.DEFAULT_ZERO)
    );

    const targetStream = createWriteStream(options.targetFile);
    targetStream.write(header.toBytes());
    targetStream.write(options.metadata.toBytes());
    targetStream.write(coverBytes);

    const totalByteSize = this.getTotalSize(options.sourceDirectory);
    progressReporter.setTotalData(totalByteSize);

    const tarGzStream = new compressing.tgz.Stream();
    tarGzStream.addEntry(options.sourceDirectory.toString(), {
      ignoreBase: true,
    });
    const hash = createHash("sha512-256");

    tarGzStream.on("data", (chunk) => {
      hash.update(chunk);
      progressReporter.updateData(chunk.length);
    });

    await pipeline(tarGzStream, targetStream);

    targetStream.close();

    const targetFile = await open(options.targetFile, "r+");

    const archiveHash = hash.digest();
    header.archiveHash = archiveHash;

    await targetFile.write(
      header.toBytes(),
      HEADER_CONSTANTS.HEADER_START,
      HEADER_CONSTANTS.HEADER_SIZE,
      HEADER_CONSTANTS.HEADER_START
    );

    progressReporter.complete();

    return new CLBGFile({
      cover: coverBytes.toString("base64"),
      filePath: options.targetFile,
      header,
      metadata: options.metadata,
    });
  }
}
