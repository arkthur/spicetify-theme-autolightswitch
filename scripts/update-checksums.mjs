// Rewrites watcher/SHA256SUMS and the checksum table in README.md. Run after editing anything in watcher/.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const FILES = [
  "install.bat",
  "uninstall.bat",
  "SystemThemeWatcher.cs",
  "install.sh",
  "system-theme-watcher.sh"
];
const START = "<!-- checksums:start -->";
const END = "<!-- checksums:end -->";

const sums = FILES.map((name) => {
  const content = readFileSync(new URL(`../watcher/${name}`, import.meta.url));
  return { name, hash: createHash("sha256").update(content).digest("hex") };
});

writeFileSync(
  new URL("../watcher/SHA256SUMS", import.meta.url),
  sums.map(({ name, hash }) => `${hash}  ${name}\n`).join("")
);

const table = [
  "| File | SHA-256 | VirusTotal |",
  "| --- | --- | --- |",
  ...sums.map(
    ({ name, hash }) =>
      `| \`watcher/${name}\` | \`${hash}\` | [report](https://www.virustotal.com/gui/file/${hash}) |`
  )
].join("\n");

const readmeUrl = new URL("../README.md", import.meta.url);
const readme = readFileSync(readmeUrl, "utf8");
const start = readme.indexOf(START);
const end = readme.indexOf(END);
if (start === -1 || end === -1)
  throw new Error("Checksum markers not found in README.md");
writeFileSync(
  readmeUrl,
  `${readme.slice(0, start + START.length)}\n${table}\n${readme.slice(end)}`
);
