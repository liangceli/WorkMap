import { cp, mkdir, rm } from "node:fs/promises";
import { URL } from "node:url";

const output = new URL("../alpha-unpacked/", import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(new URL("../dist/", import.meta.url), new URL("dist/", output), { recursive: true });
for (const file of ["manifest.json", "options.html", "options.css"]) await cp(new URL(`../${file}`, import.meta.url), new URL(file, output));
