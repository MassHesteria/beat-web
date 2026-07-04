"use client";

import { useRef, useState } from "react";

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

type FileSystemFileHandle = {
  name: string;
};

declare global {
  interface Window {
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
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
  const [selectedFiles, setSelectedFiles] = useState<Partial<Record<FileKey, string>>>({});
  const [overwriteOriginal, setOverwriteOriginal] = useState(false);

  function rememberFile(key: FileKey, file: File) {
    setSelectedFiles((current) => ({ ...current, [key]: file.name }));
  }

  async function rememberSaveLocation(key: FileKey, suggestedName: string) {
    if (typeof window.showSaveFilePicker === "function") {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName,
          types: [
            {
              description: "All files",
              accept: { "application/octet-stream": [".bps", ".bin", ".sfc", ".smc"] },
            },
          ],
        });

        setSelectedFiles((current) => ({ ...current, [key]: handle.name }));
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    const fileName = window.prompt("Save as:", suggestedName)?.trim();

    if (fileName) {
      setSelectedFiles((current) => ({ ...current, [key]: fileName }));
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
              value={selectedFiles[row.key]}
              onFileSelected={rememberFile}
              onSaveSelected={rememberSaveLocation}
            />
          ))}
          <div className="field-step">
            <p>Step 4: create the patch:</p>
            <button className="action-button" type="button" disabled>
              Create
            </button>
          </div>
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
              value={selectedFiles[row.key]}
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
