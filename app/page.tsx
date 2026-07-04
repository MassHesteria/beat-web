"use client";

import { useRef, useState } from "react";
import { createBpsPatch } from "@/lib/bps";

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

function patchName(original: File, modified: File) {
  const originalBase = original.name.replace(/\.[^.]*$/, "") || "original";
  const modifiedBase = modified.name.replace(/\.[^.]*$/, "") || "modified";
  return `${originalBase}_to_${modifiedBase}.bps`;
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
  const [overwriteOriginal, setOverwriteOriginal] = useState(false);
  const [status, setStatus] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const createOriginal = selectedFiles.createOriginal;
  const createModified = selectedFiles.createModified;
  const canCreatePatch = Boolean(createOriginal && createModified && !isCreating);

  function displayName(key: FileKey) {
    return selectedFiles[key]?.name;
  }

  function rememberFile(key: FileKey, file: File) {
    setSelectedFiles((current) => ({ ...current, [key]: file }));
    setStatus("");
  }

  async function createPatch() {
    if (!createOriginal || !createModified) return;

    setIsCreating(true);
    setStatus("Creating patch...");

    try {
      const originalData = new Uint8Array(await createOriginal.arrayBuffer());
      const modifiedData = new Uint8Array(await createModified.arrayBuffer());
      const patchData = createBpsPatch(originalData, modifiedData);

      downloadBytes(patchData, patchName(createOriginal, createModified));
      setStatus("patch created successfully");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create patch");
    } finally {
      setIsCreating(false);
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
          {status ? <p className="status-message">{status}</p> : null}
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
          <label className="overwrite-option">
            <input
              type="checkbox"
              checked={overwriteOriginal}
              onChange={(event) => setOverwriteOriginal(event.currentTarget.checked)}
            />
            <span>Overwrite the original file (irreversible)</span>
          </label>
          <div className="field-step apply-action">
            <p>Step 3: apply the patch:</p>
            <button className="action-button" type="button" disabled>
              Apply
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}
