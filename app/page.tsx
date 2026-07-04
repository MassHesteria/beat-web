"use client";

import { useRef, useState } from "react";
import { applyBpsPatch, createBpsPatch } from "@/lib/bps";

type FileKey = "createOriginal" | "createModified" | "applyPatch" | "applyOriginal";

const createRows = [
  {
    key: "createOriginal" as const,
    label: "Step 1: choose the original file to create a patch from:",
  },
  {
    key: "createModified" as const,
    label: "Step 2: choose the modified file to create a patch to:",
  },
];

const applyRows = [
  {
    key: "applyPatch" as const,
    label: "Step 1: choose the patch file to apply:",
  },
  {
    key: "applyOriginal" as const,
    label: "Step 2: choose the original file to apply the patch to:",
  },
];

function selectedLabel(name?: string) {
  return name || "(no file selected)";
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^.]*$/, "");
}

function createPatchName(original: File, modified: File) {
  const originalBase = stripExtension(original.name) || "original";
  const modifiedBase = stripExtension(modified.name) || "modified";
  return `${originalBase}_to_${modifiedBase}.bps`;
}

function applyPatchName(original: File) {
  const dot = original.name.lastIndexOf(".");

  if (dot <= 0) {
    return `${original.name || "modified"}_patched`;
  }

  return `${original.name.slice(0, dot)}_patched${original.name.slice(dot)}`;
}

function downloadBytes(data: Uint8Array, fileName: string) {
  const url = URL.createObjectURL(new Blob([toArrayBuffer(data)], { type: "application/octet-stream" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function FileChoice({
  fileKey,
  label,
  value,
  onFileSelected,
}: {
  fileKey: FileKey;
  label: string;
  value?: string;
  onFileSelected: (key: FileKey, file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="field-step">
      <p>{label}</p>
      <div className="file-control">
        <button type="button" onClick={() => inputRef.current?.click()}>
          Select
        </button>
        <strong className="file-name" title={selectedLabel(value)}>
          {selectedLabel(value)}
        </strong>
        <input
          ref={inputRef}
          className="hidden-file-input"
          type="file"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];

            if (file) {
              onFileSelected(fileKey, file);
            }
          }}
        />
      </div>
    </div>
  );
}

export default function Home() {
  const [selectedFiles, setSelectedFiles] = useState<Partial<Record<FileKey, File>>>({});
  const [createStatus, setCreateStatus] = useState("");
  const [applyStatus, setApplyStatus] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const createOriginal = selectedFiles.createOriginal;
  const createModified = selectedFiles.createModified;
  const applyPatch = selectedFiles.applyPatch;
  const applyOriginal = selectedFiles.applyOriginal;

  const canCreatePatch = Boolean(createOriginal && createModified && !isCreating);
  const canApplyPatch = Boolean(applyPatch && applyOriginal && !isApplying);

  function displayName(key: FileKey) {
    return selectedFiles[key]?.name;
  }

  function rememberFile(key: FileKey, file: File) {
    setSelectedFiles((current) => ({ ...current, [key]: file }));

    if (key === "createOriginal" || key === "createModified") {
      setCreateStatus("");
    } else {
      setApplyStatus("");
    }
  }

  async function createPatch() {
    if (!createOriginal || !createModified) return;

    setIsCreating(true);
    setCreateStatus("Creating patch...");

    try {
      const originalData = new Uint8Array(await createOriginal.arrayBuffer());
      const modifiedData = new Uint8Array(await createModified.arrayBuffer());
      const patchData = createBpsPatch(originalData, modifiedData);

      downloadBytes(patchData, createPatchName(createOriginal, createModified));
      setCreateStatus("patch created successfully");
    } catch (error) {
      setCreateStatus(error instanceof Error ? error.message : "Failed to create patch");
    } finally {
      setIsCreating(false);
    }
  }

  async function applyPatchToFile() {
    if (!applyPatch || !applyOriginal) return;

    setIsApplying(true);
    setApplyStatus("Applying patch...");

    try {
      const patchData = new Uint8Array(await applyPatch.arrayBuffer());
      const originalData = new Uint8Array(await applyOriginal.arrayBuffer());
      const { target, result } = applyBpsPatch(originalData, patchData);

      if (result || !target) {
        setApplyStatus(result || "Failed to apply patch");
        return;
      }

      downloadBytes(target, applyPatchName(applyOriginal));
      setApplyStatus("patch applied successfully");
    } catch (error) {
      setApplyStatus(error instanceof Error ? error.message : "Failed to apply patch");
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <main className="beat-page">
      <header className="hero-card" aria-labelledby="app-title">
        <h1 id="app-title">beat</h1>
        <p>A binary patching tool using the beat file format</p>
        <dl>
          <div>
            <dt>Version:</dt>
            <dd>v2</dd>
          </div>
          <div>
            <dt>License:</dt>
            <dd>
              <a href="https://opensource.org/license/isc" target="_blank" rel="noreferrer">
                ISC
              </a>
            </dd>
          </div>
        </dl>
      </header>

      <section className="patch-panel" aria-label="BPS patch tools">
        <section className="tool-column" aria-labelledby="create-title">
          <h2 id="create-title">Create BPS Patch</h2>
          {createRows.map((row) => (
            <FileChoice
              key={row.key}
              fileKey={row.key}
              label={row.label}
              value={displayName(row.key)}
              onFileSelected={rememberFile}
            />
          ))}
          <div className="field-step">
            <p>Step 3: create the patch:</p>
            <button className="action-button" type="button" disabled={!canCreatePatch} onClick={createPatch}>
              Create
            </button>
          </div>
          {createStatus ? <p className="status-message">{createStatus}</p> : null}
        </section>

        <section className="tool-column" aria-labelledby="apply-title">
          <h2 id="apply-title">Apply BPS Patch</h2>
          {applyRows.map((row) => (
            <FileChoice
              key={row.key}
              fileKey={row.key}
              label={row.label}
              value={displayName(row.key)}
              onFileSelected={rememberFile}
            />
          ))}
          <div className="field-step apply-action">
            <p>Step 3: apply the patch:</p>
            <button className="action-button" type="button" disabled={!canApplyPatch} onClick={applyPatchToFile}>
              Apply
            </button>
          </div>
          {applyStatus ? <p className="status-message">{applyStatus}</p> : null}
        </section>
      </section>
    </main>
  );
}
