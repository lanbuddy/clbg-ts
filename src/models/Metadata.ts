import { PathLike, createReadStream } from "fs";
import { Header } from "./Header";

const METADATA_DEFAULTS = {
  ZERO: 0,
};

interface MetadataOptions {
  igdbId: number;
  name: string;
  description?: string;
  rating?: number;
  developer?: string;
  publisher?: string;
  releaseDate?: string;
  genres?: string[];
  themes?: string[];
  keywords?: string[];
  server?: boolean;
}

/**
 * Represents metadata for a game.
 */
export class Metadata {
  igdbId: number;
  name: string;
  description: string;
  rating: number;
  developer: string;
  publisher: string;
  releaseDate: string;
  genres: string[];
  themes: string[];
  keywords: string[];
  server: boolean;

  /**
   * Constructs a new Metadata instance.
   * @param options - The options to initialize the Metadata instance.
   */
  constructor(options: MetadataOptions) {
    this.igdbId = options.igdbId;
    this.name = options.name;
    this.description = options.description || "";
    this.rating = options.rating || METADATA_DEFAULTS.ZERO;
    this.developer = options.developer || "";
    this.publisher = options.publisher || "";
    this.releaseDate = options.releaseDate || "";
    this.genres = options.genres || [];
    this.themes = options.themes || [];
    this.keywords = options.keywords || [];
    this.server = options.server || false;
  }

  /**
   * Converts the Metadata instance to a JSON string.
   * @returns The JSON string representation of the Metadata instance.
   */
  /* eslint-disable camelcase */
  toJSON(): string {
    return JSON.stringify({
      description: this.description,
      developer: this.developer,
      genres: this.genres,
      igdb_id: this.igdbId,
      keywords: this.keywords,
      name: this.name,
      publisher: this.publisher,
      rating: this.rating,
      release_date: this.releaseDate,
      server: this.server,
      themes: this.themes,
    });
  }

  /**
   * Converts the Metadata instance to a Buffer.
   * @returns The Buffer representation of the Metadata instance.
   */
  toBytes(): Buffer {
    return Buffer.from(this.toJSON(), "utf-8");
  }

  /**
   * Creates a Metadata instance from a file.
   * @param targetPath - The path to the file.
   * @param header - The header information.
   * @returns The Metadata instance created from the file.
   */
  static async fromFile(
    targetPath: PathLike,
    header: Header
  ): Promise<Metadata> {
    const readStream = createReadStream(targetPath, {
      start: header.metadataOffset,
    });

    const metadataBuffer = Buffer.alloc(header.metadataLength);
    let bytesRead = 0;
    for await (const chunk of readStream) {
      chunk.copy(metadataBuffer, bytesRead);
      bytesRead += chunk.length;
    }

    return Metadata.fromBytes(metadataBuffer);
  }

  /**
   * Creates a Metadata instance from a Buffer.
   * @param data - The Buffer containing the Metadata data.
   * @returns The Metadata instance created from the Buffer.
   */
  static fromBytes(data: Buffer): Metadata {
    const jsonData = JSON.parse(data.toString("utf-8"));
    jsonData.releaseDate = jsonData.release_date;
    jsonData.igdbId = jsonData.igdb_id;

    delete jsonData.release_date;
    delete jsonData.igdb_id;

    return new Metadata(jsonData);
  }
}
