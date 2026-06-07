"use client";

import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ARCHIVE_ALLOWED_IMAGE_TYPES,
  ARCHIVE_IMAGE_MAX_SIZE_BYTES,
} from "@/lib/archive";

import { createArchivePostAction } from "./actions";

type SelectedImage = {
  date: Date;
  file: File;
  id: string;
  previewUrl: string;
  source: "exif" | "file" | "today";
};

const initialMessage = {
  ok: false,
  text: null as string | null,
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateTimeLocal(date: Date) {
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

function parseExifDate(value: string) {
  const match = value.match(
    /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/
  );

  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

function getAsciiValue(view: DataView, offset: number, count: number) {
  let value = "";

  for (let index = 0; index < count; index += 1) {
    const code = view.getUint8(offset + index);

    if (code === 0) {
      break;
    }

    value += String.fromCharCode(code);
  }

  return value;
}

function readIfdEntries(
  view: DataView,
  tiffStart: number,
  ifdOffset: number,
  littleEndian: boolean
) {
  const entries: { count: number; tag: number; type: number; value: number }[] =
    [];
  const directoryStart = tiffStart + ifdOffset;
  const entryCount = view.getUint16(directoryStart, littleEndian);

  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = directoryStart + 2 + index * 12;

    entries.push({
      count: view.getUint32(entryOffset + 4, littleEndian),
      tag: view.getUint16(entryOffset, littleEndian),
      type: view.getUint16(entryOffset + 2, littleEndian),
      value: view.getUint32(entryOffset + 8, littleEndian),
    });
  }

  return entries;
}

async function readExifDateTimeOriginal(file: File) {
  if (file.type !== "image/jpeg") {
    return null;
  }

  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);

  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) {
    return null;
  }

  let offset = 2;

  while (offset + 4 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      return null;
    }

    const marker = view.getUint8(offset + 1);
    const segmentLength = view.getUint16(offset + 2);

    if (marker === 0xe1) {
      const exifStart = offset + 4;
      const exifHeader = getAsciiValue(view, exifStart, 6);

      if (exifHeader !== "Exif") {
        return null;
      }

      const tiffStart = exifStart + 6;
      const byteOrder = getAsciiValue(view, tiffStart, 2);
      const littleEndian = byteOrder === "II";

      if (!littleEndian && byteOrder !== "MM") {
        return null;
      }

      const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
      const ifdEntries = readIfdEntries(
        view,
        tiffStart,
        firstIfdOffset,
        littleEndian
      );
      const exifPointer = ifdEntries.find((entry) => entry.tag === 0x8769);

      if (!exifPointer) {
        return null;
      }

      const exifEntries = readIfdEntries(
        view,
        tiffStart,
        exifPointer.value,
        littleEndian
      );
      const dateEntry = exifEntries.find((entry) => entry.tag === 0x9003);

      if (!dateEntry || dateEntry.type !== 2) {
        return null;
      }

      const dateOffset =
        dateEntry.count <= 4 ? offset + 12 : tiffStart + dateEntry.value;

      return parseExifDate(getAsciiValue(view, dateOffset, dateEntry.count));
    }

    offset += 2 + segmentLength;
  }

  return null;
}

async function createSelectedImage(file: File): Promise<SelectedImage> {
  const exifDate = await readExifDateTimeOriginal(file);
  const fallbackDate =
    file.lastModified > 0 ? new Date(file.lastModified) : new Date();

  return {
    date: exifDate ?? fallbackDate,
    file,
    id: crypto.randomUUID(),
    previewUrl: URL.createObjectURL(file),
    source: exifDate ? "exif" : file.lastModified > 0 ? "file" : "today",
  };
}

function moveItem(items: SelectedImage[], fromIndex: number, toIndex: number) {
  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, item);

  return nextItems;
}

function validateSelectedFile(file: File) {
  if (
    !ARCHIVE_ALLOWED_IMAGE_TYPES.includes(
      file.type as (typeof ARCHIVE_ALLOWED_IMAGE_TYPES)[number]
    )
  ) {
    return `${file.name}: usa imagenes JPG, PNG, WebP o GIF.`;
  }

  if (file.size > ARCHIVE_IMAGE_MAX_SIZE_BYTES) {
    return `${file.name}: cada imagen debe pesar menos de 5 MB.`;
  }

  return null;
}

export default function ArchiveComposer({
  onCreated,
}: {
  onCreated?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedImagesRef = useRef<SelectedImage[]>([]);
  const [description, setDescription] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [takenAt, setTakenAt] = useState(formatDateTimeLocal(new Date()));
  const canSubmit = selectedImages.length > 0 && !isSubmitting;
  const oldestImage = useMemo(
    () =>
      selectedImages.reduce<SelectedImage | null>((oldest, image) => {
        if (!oldest || image.date < oldest.date) {
          return image;
        }

        return oldest;
      }, null),
    [selectedImages]
  );

  useEffect(() => {
    if (oldestImage) {
      setTakenAt(formatDateTimeLocal(oldestImage.date));
    }
  }, [oldestImage]);

  useEffect(() => {
    selectedImagesRef.current = selectedImages;
  }, [selectedImages]);

  useEffect(() => {
    return () => {
      selectedImagesRef.current.forEach((image) =>
        URL.revokeObjectURL(image.previewUrl)
      );
    };
  }, []);

  // Success messages auto-dismiss after 5s; errors stay until the next action.
  useEffect(() => {
    if (!message.ok || !message.text) {
      return;
    }

    const timer = setTimeout(() => setMessage(initialMessage), 5000);

    return () => clearTimeout(timer);
  }, [message]);

  async function addFiles(files: File[]) {
    setMessage(initialMessage);

    const failedFileMessage = files
      .map(validateSelectedFile)
      .find((message): message is string => Boolean(message));

    if (failedFileMessage) {
      setMessage({ ok: false, text: failedFileMessage });
      return;
    }

    if (files.length === 0) {
      return;
    }

    const nextImages = await Promise.all(files.map(createSelectedImage));

    setSelectedImages((current) => [...current, ...nextImages]);
  }

  function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    void addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    void addFiles(Array.from(event.dataTransfer.files));
  }

  function removeImage(imageId: string) {
    setSelectedImages((current) => {
      const image = current.find((item) => item.id === imageId);

      if (image) {
        URL.revokeObjectURL(image.previewUrl);
      }

      return current.filter((item) => item.id !== imageId);
    });
  }

  function moveImage(fromIndex: number, toIndex: number) {
    setSelectedImages((current) => moveItem(current, fromIndex, toIndex));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selectedImages.length === 0) {
      setMessage({ ok: false, text: "Selecciona al menos una imagen." });
      return;
    }

    setIsSubmitting(true);
    setMessage(initialMessage);

    const formData = new FormData();
    formData.set("description", description);
    formData.set("takenAt", takenAt);
    selectedImages.forEach((image) => formData.append("images", image.file));

    try {
      const result = await createArchivePostAction(
        { ok: false, message: null },
        formData
      );

      if (!result.ok) {
        setMessage({ ok: false, text: result.message });
        return;
      }

      selectedImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      setDescription("");
      setSelectedImages([]);
      setTakenAt(formatDateTimeLocal(new Date()));
      setMessage({ ok: true, text: result.message });
      onCreated?.();
    } catch {
      setMessage({ ok: false, text: "No se pudo guardar el archivo." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="border-b border-neutral-800 px-4 py-4" onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div
          className={
            isDragging
              ? "rounded-2xl border border-[#ff003c] bg-[#ff003c]/10 p-4"
              : "rounded-2xl border border-neutral-800 bg-black p-4"
          }
          onDragLeave={() => setIsDragging(false)}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDrop={handleDrop}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-neutral-300">imagenes</p>
              <p className="mt-1 text-xs leading-5 text-neutral-500">
                puedes subir varias imagenes
              </p>
            </div>
            <input
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              multiple
              name="images"
              onChange={handleFilesChange}
              ref={inputRef}
              type="file"
            />
            <button
              className="rounded-full px-4 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10"
              onClick={() => inputRef.current?.click()}
              type="button"
            >
              elegir
            </button>
          </div>
        </div>

        {selectedImages.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {selectedImages.map((image, index) => (
              <div
                className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950"
                key={image.id}
              >
                <div className="aspect-square">
                  <img
                    alt={image.file.name}
                    className="h-full w-full object-cover"
                    src={image.previewUrl}
                  />
                </div>
                <div className="space-y-2 p-2">
                  <p className="truncate text-xs text-neutral-500">
                    {index + 1}. {image.file.name}
                  </p>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      className="rounded-full px-2 py-2 text-xs text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:text-neutral-700 disabled:hover:bg-transparent"
                      disabled={index === 0}
                      onClick={() => moveImage(index, index - 1)}
                      type="button"
                    >
                      &lt;
                    </button>
                    <button
                      className="rounded-full px-2 py-2 text-xs text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:text-neutral-700 disabled:hover:bg-transparent"
                      disabled={index === selectedImages.length - 1}
                      onClick={() => moveImage(index, index + 1)}
                      type="button"
                    >
                      &gt;
                    </button>
                    <button
                      className="rounded-full px-2 py-2 text-xs text-[#ff003c] transition hover:bg-[#ff003c]/10"
                      onClick={() => removeImage(image.id)}
                      type="button"
                    >
                      quitar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <label className="block">
          <span className="mb-2 block text-sm text-neutral-400">
            fecha del archivo
          </span>
          <input
            className="w-full rounded-2xl border border-neutral-800 bg-black px-4 py-3 text-base text-white outline-none transition placeholder:text-neutral-600 focus:border-[#ff003c] focus:ring-1 focus:ring-[#ff003c]"
            name="takenAt"
            onChange={(event) => setTakenAt(event.target.value)}
            required
            type="datetime-local"
            value={takenAt}
          />
          <span className="mt-2 block text-xs leading-5 text-neutral-500">
            se usa la fecha mas antigua detectada; puedes cambiarla
          </span>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm text-neutral-400">
            descripcion
          </span>
          <textarea
            className="min-h-24 w-full resize-y rounded-2xl border border-transparent bg-black px-1 text-md leading-7 text-white outline-none transition placeholder:text-neutral-500"
            name="description"
            onChange={(event) => setDescription(event.target.value)}
            placeholder="descripcion"
            value={description}
          />
        </label>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-neutral-900 pt-3">
          {message.text ? (
            <p
              className={
                message.ok ? "text-sm text-green-400" : "text-sm text-red-400"
              }
            >
              {message.text}
            </p>
          ) : null}
          <button
            className="rounded-full px-5 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:cursor-not-allowed disabled:text-neutral-500 disabled:hover:bg-transparent"
            disabled={!canSubmit}
            type="submit"
          >
            {isSubmitting ? "guardando" : "guardar"}
          </button>
        </div>
      </div>
    </form>
  );
}
