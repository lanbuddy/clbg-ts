import { PathLike, existsSync, statSync } from "fs";

const checkPathExists = (
  path: PathLike,
  expectedType: "directory" | "file"
) => {
  if (!existsSync(path)) {
    throw new Error(
      `Target path does not exist: ${path}, expected ${expectedType}`
    );
  }

  const stats = statSync(path);
  if (expectedType === "file" && !stats.isFile()) {
    throw new Error(`Path is not a file: ${path}`);
  }

  if (expectedType === "directory" && !stats.isDirectory()) {
    throw new Error(`Path is not a directory: ${path}`);
  }
};

export { checkPathExists };
