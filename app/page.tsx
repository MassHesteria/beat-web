"use client";

import { useRef, useState } from "react";
import { createBpsPatch } from "@/lib/bps";

type FileKey =
  | "createPatch"
  | "createOriginal"
  | "createModified"
  | "applyPatch"
  | "applyOriginal"
  | "applyOutput";

type SaveFilePickerOptions = {
  suggestedName?: string;
  types?: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
};

type WritableFile = {
  write: (data: BufferSource | Blob) => Promise<void>;
  close: () => Promise<void>;
};

type SaveFileHandle = {
  name: string;
  createWritable: () => Promise<WritableFile>;
};

type SaveTarget = {
  name: string;
  handle?: SaveFileHandle;
};

declare global {
  interface Window {
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<SaveFileHandle>;
  }
}

const createRows = [
  {
    key: "createPatch" as const,
    label: "Step 1: choose a location to save the patch file to:",
    mode: "save" as const,
    suggestedName: "patch.bps",
  },
  {
    key: "createOriginal" as const,
    label: "Step 2: choose the original file to create a patch from:",
    mode: "open" as const,
  },
  {
    key: "createModified" as const,
    label: "Step 3: choose the modified file to create a patch to:",
    mode: "open" as const,
  },
];

const applyRows = [
  {
    key: "applyPatch" as const,
    label: "Step 1: choose the patch file to apply:",
    mode: "open" as const,
  },
  {
    key: "applyOriginal" as const,
    label: "Step 2: choose the original file to apply the patch to:",
    mode: "open" as const,
  },
  {
    key: "applyOutput" as const,
    label: "Step 3: choose where to write the modified file to:",
    mode: "save" as const,
    suggestedName: "modified.bin",
  },
];

function selectedLabel(name?: string) {
  return name || "(no file selected)";
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
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
  mode,
  suggestedName,
  value,
  onFileSelected,
  onSaveSelected,
}: {
  fileKey: FileKey;
  label: string;
  mode: "open" | "save";
  suggestedName?: string;
  value?: string;
  onFileSelected: (key: FileKey, file: File) => void;
  onSaveSelected: (key: FileKey, suggestedName: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function chooseFile() {
    if (mode === "save") {
      onSaveSelected(fileKey, suggestedName ?? "output.bin");
      return;
    }

    inputRef.current?.click();
  }

  return (
    <div className="field-step">
      <p>{label}</p>
      <div className="file-control">
        <button type="button" onClick={chooseFile}>
          Select
        </button>
        <strong className="file-name" title={selectedLabel(value)}>
          {selectedLabel(value)}
        </strong>
        {mode === "open" ? (
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
        ) : null}
      </div>
    </div>
  );
}

export default function Home() {
  const [selectedFiles, setSelectedFiles] = useState<Partial<Record<FileKey, File>>>({});
  const [saveTargets, setSaveTargets] = useState<Partial<Record<FileKey, SaveTarget>>>({});
  const [overwriteOriginal, setOverwriteOriginal] = useState(false);
  const [status, setStatus] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const createPatchTarget = saveTargets.createPatch;
  const createOriginal = selectedFiles.createOriginal;
  const createModified = selectedFiles.createModified;
  const canCreatePatch = Boolean(createPatchTarget && createOriginal && createModified && !isCreating);

  function displayName(key: FileKey) {
    return selectedFiles[key]?.name ?? saveTargets[key]?.name;
  }

  function rememberFile(key: FileKey, file: File) {
    setSelectedFiles((current) => ({ ...current, [key]: file }));
    setStatus("");
  }

  async function rememberSaveLocation(key: FileKey, suggestedName: string) {
    if (typeof window.showSaveFilePicker === "function") {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName,
          types: [
            {
              description: "BPS patch files",
              accept: { "application/octet-stream": [".bps", ".bin", ".sfc", ".smc"] },
            },
          ],
        });

        setSaveTargets((current) => ({ ...current, [key]: { name: handle.name, handle } }));
        setStatus("");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    const fileName = window.prompt("Save as:", suggestedName)?.trim();

    if (fileName) {
      setSaveTargets((current) => ({ ...current, [key]: { name: fileName } }));
      setStatus("");
    }
  }

  async function createPatch() {
    if (!createPatchTarget || !createOriginal || !createModified) return;

    setIsCreating(true);
    setStatus("Creating patch...");

    try {
      const originalData = new Uint8Array(await createOriginal.arrayBuffer());
      const modifiedData = new Uint8Array(await createModified.arrayBuffer());
      const patchData = createBpsPatch(originalData, modifiedData);

      if (createPatchTarget.handle) {
        const writable = await createPatchTarget.handle.createWritable();
        await writable.write(toArrayBuffer(patchData));
        await writable.close();
      } else {
        downloadBytes(patchData, createPatchTarget.name);
      }

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
              mode={row.mode}
              suggestedName={row.suggestedName}
              value={displayName(row.key)}
              onFileSelected={rememberFile}
              onSaveSelected={rememberSaveLocation}
            />
          ))}
          <div className="field-step">
            <p>Step 4: create the patch:</p>
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
              mode={row.mode}
              suggestedName={row.suggestedName}
              value={displayName(row.key)}
              onFileSelected={rememberFile}
              onSaveSelected={rememberSaveLocation}
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
            <p>Step 4: apply the patch:</p>
            <button className="action-button" type="button" disabled>
              Apply
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}
