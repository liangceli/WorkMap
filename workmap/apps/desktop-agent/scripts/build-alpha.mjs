import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { URL } from "node:url";

const output = new URL("../alpha-windows/", import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(new URL("dist/", output), { recursive: true });
await mkdir(new URL("scripts/", output), { recursive: true });
await cp(new URL("../dist/", import.meta.url), new URL("dist/", output), { recursive: true });
await cp(new URL("windows-foreground.ps1", import.meta.url), new URL("scripts/windows-foreground.ps1", output));
await cp(new URL("credential-protection.ps1", import.meta.url), new URL("scripts/credential-protection.ps1", output));
await cp(new URL("install-workmap-agent.ps1", import.meta.url), new URL("install-workmap-agent.ps1", output));
await cp(new URL("uninstall-workmap-agent.ps1", import.meta.url), new URL("uninstall-workmap-agent.ps1", output));
await cp(new URL("setup-workmap-agent.ps1", import.meta.url), new URL("setup-workmap-agent.ps1", output));
await cp(new URL("setup-workmap-agent.cmd", import.meta.url), new URL("setup-workmap-agent.cmd", output));
await writeFile(
  new URL("run-workmap-agent.cmd", output),
  "@echo off\r\nset \"NODE_EXE=%~dp0runtime\\node.exe\"\r\nif not exist \"%NODE_EXE%\" set \"NODE_EXE=node\"\r\n\"%NODE_EXE%\" \"%~dp0dist\\index.js\" %*\r\n",
  "utf8",
);
await writeFile(new URL("package.json", output), JSON.stringify({ name: "workmap-desktop-agent-alpha", private: true, type: "module" }, null, 2) + "\n", "utf8");
