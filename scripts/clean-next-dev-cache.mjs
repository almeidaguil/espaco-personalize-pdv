import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const nextTypeCachePaths = [
  resolve(".next", "types"),
  resolve(".next", "dev", "types"),
];

await Promise.all(
  nextTypeCachePaths.map((cachePath) =>
    rm(cachePath, {
      force: true,
      recursive: true,
    }),
  ),
);
