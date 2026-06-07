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
  ARCHIVE_ALBUM_KIND,
  ARCHIVE_ALBUM_THRESHOLD,
  ARCHIVE_IMAGE_ACCEPT,
  ARCHIVE_POST_KIND,
  getArchiveImageUploadType,
} from "@/lib/archive";

import { prepareArchiveImageFiles } from "./archive-image-processing";
import SortableImageGrid from "./sortable-image-grid";
import {
  createArchivePostMetadataAction,
  deleteArchivePostAction,
  updateArchiveCoverImageAction,
  uploadSingleArchiveImageAction,
} from "./actions";

type DateMode = "oldest" | "newest";

type UploadStatus = "pending" | "uploading" | "uploaded" | "failed";

type SelectedImage = {
  archiveImageId?: string;
  date: Date;
  error?: string;
  file: File;
  id: string;
  previewUrl: string;
  source: "exif" | "file" | "today";
  status: UploadStatus;
};

const initialMessage = {
  ok: false,
  text: null as string | null,
};
const ALBUM_PREVIEW_LIMIT = 72;

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
  const uploadType = getArchiveImageUploadType(file);

  if (!uploadType.ok || uploadType.extension !== "jpg") {
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

async function createSelectedImage(
  file: File,
  originalFile = file
): Promise<SelectedImage> {
  const exifDate = await readExifDateTimeOriginal(originalFile);
  const fallbackDate =
    originalFile.lastModified > 0
      ? new Date(originalFile.lastModified)
      : new Date();

  return {
    date: exifDate ?? fallbackDate,
    file,
    id: crypto.randomUUID(),
    previewUrl: URL.createObjectURL(file),
    source: exifDate ? "exif" : originalFile.lastModified > 0 ? "file" : "today",
    status: "pending",
  };
}

function moveItem(items: SelectedImage[], fromIndex: number, toIndex: number) {
  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, item);

  return nextItems;
}

function formatFailureSummary(messages: string[], limit = 8) {
  const visibleMessages = messages.slice(0, limit);
  const hiddenCount = messages.length - visibleMessages.length;

  return [
    ...visibleMessages,
    hiddenCount > 0 ? `...y ${hiddenCount} mas.` : null,
  ]
    .filter((message): message is string => Boolean(message))
    .join("\n");
}

export default function ArchiveComposer({
  onCreated,
}: {
  onCreated?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedImagesRef = useRef<SelectedImage[]>([]);
  const [albumTitle, setAlbumTitle] = useState("");
  const [coverImageId, setCoverImageId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [showAllAlbumPreviews, setShowAllAlbumPreviews] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [metadataPostId, setMetadataPostId] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [takenAt, setTakenAt] = useState(formatDateTimeLocal(new Date()));
  const [dateMode, setDateMode] = useState<DateMode>("oldest");
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const isAlbumMode = selectedImages.length > ARCHIVE_ALBUM_THRESHOLD;
  const remainingUploadCount = selectedImages.filter(
    (image) => image.status !== "uploaded"
  ).length;
  const uploadStatusCounts = useMemo(
    () =>
      selectedImages.reduce(
        (counts, image) => ({
          ...counts,
          [image.status]: counts[image.status] + 1,
        }),
        { failed: 0, pending: 0, uploaded: 0, uploading: 0 } as Record<
          UploadStatus,
          number
        >
      ),
    [selectedImages]
  );
  const albumPreviewImages = useMemo(() => {
    if (
      !isAlbumMode ||
      showAllAlbumPreviews ||
      selectedImages.length <= ALBUM_PREVIEW_LIMIT
    ) {
      return selectedImages;
    }

    const previewImages = selectedImages.slice(0, ALBUM_PREVIEW_LIMIT);
    const coverImage = selectedImages.find((image) => image.id === coverImageId);

    if (
      coverImage &&
      !previewImages.some((image) => image.id === coverImage.id)
    ) {
      return [...previewImages.slice(0, ALBUM_PREVIEW_LIMIT - 1), coverImage];
    }

    return previewImages;
  }, [coverImageId, isAlbumMode, selectedImages, showAllAlbumPreviews]);
  const hiddenAlbumPreviewCount =
    isAlbumMode && !showAllAlbumPreviews
      ? Math.max(0, selectedImages.length - albumPreviewImages.length)
      : 0;
  const canSubmit =
    remainingUploadCount > 0 &&
    !isProcessingImages &&
    !isSubmitting &&
    (!isAlbumMode || albumTitle.trim().length > 0);
  // Track the oldest/newest photo timestamps as numbers (not object references)
  // so the auto-fill effect only reacts to an actual change in the detected
  // date. Reordering images or rewriting an image's upload status produces a new
  // array but the same min/max timestamp, so a manual date edit is preserved.
  const oldestTime = useMemo(
    () =>
      selectedImages.reduce(
        (oldest, image) => Math.min(oldest, image.date.getTime()),
        Number.POSITIVE_INFINITY
      ),
    [selectedImages]
  );
  const newestTime = useMemo(
    () =>
      selectedImages.reduce(
        (newest, image) => Math.max(newest, image.date.getTime()),
        Number.NEGATIVE_INFINITY
      ),
    [selectedImages]
  );

  // Auto-fill the date from the chosen photo (oldest/newest). This only runs
  // when the detected date or the date mode change, so a manual edit to the
  // field survives reorders and upload-status churn until the selected photos or
  // the mode actually change.
  useEffect(() => {
    const detectedTime = dateMode === "newest" ? newestTime : oldestTime;

    if (Number.isFinite(detectedTime)) {
      setTakenAt(formatDateTimeLocal(new Date(detectedTime)));
    }
  }, [dateMode, newestTime, oldestTime]);

  useEffect(() => {
    selectedImagesRef.current = selectedImages;
  }, [selectedImages]);

  useEffect(() => {
    if (!isAlbumMode) {
      setCoverImageId(null);
      setShowAllAlbumPreviews(false);
      return;
    }

    if (
      selectedImages.length > 0 &&
      (!coverImageId || !selectedImages.some((image) => image.id === coverImageId))
    ) {
      setCoverImageId(selectedImages[0].id);
    }
  }, [coverImageId, isAlbumMode, selectedImages]);

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

    if (files.length === 0) {
      return;
    }

    setIsProcessingImages(true);

    try {
      const result = await prepareArchiveImageFiles(files, "create-select");

      if (result.errors.length > 0) {
        setMessage({ ok: false, text: result.errors.join("\n") });
      }

      const nextImages: SelectedImage[] = [];

      for (const prepared of result.files) {
        nextImages.push(
          await createSelectedImage(prepared.file, prepared.originalFile)
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      if (nextImages.length > 0) {
        setSelectedImages((current) => [...current, ...nextImages]);
      }
    } finally {
      setIsProcessingImages(false);
    }
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
        if (image.status === "uploaded") {
          return current;
        }

        URL.revokeObjectURL(image.previewUrl);
      }

      return current.filter((item) => item.id !== imageId);
    });
  }

  function moveImage(fromIndex: number, toIndex: number) {
    if (metadataPostId || isSubmitting) {
      return;
    }

    setSelectedImages((current) => moveItem(current, fromIndex, toIndex));
  }

  function updateImageStatus(
    imageId: string,
    status: UploadStatus,
    error?: string,
    archiveImageId?: string
  ) {
    setSelectedImages((current) =>
      current.map((image) =>
        image.id === imageId
          ? {
              ...image,
              archiveImageId: archiveImageId ?? image.archiveImageId,
              error,
              status,
            }
          : image
      )
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const uploadCandidates = selectedImages.filter(
      (image) => image.status !== "uploaded"
    );

    if (selectedImages.length === 0 || uploadCandidates.length === 0) {
      setMessage({ ok: false, text: "Selecciona al menos una imagen." });
      return;
    }

    if (isProcessingImages) {
      setMessage({ ok: false, text: "Espera a que terminen de procesarse." });
      return;
    }

    if (isAlbumMode && !albumTitle.trim()) {
      setMessage({ ok: false, text: "Ponle titulo al album." });
      return;
    }

    setIsSubmitting(true);
    setMessage(initialMessage);
    setUploadProgress(null);

    setSelectedImages((current) =>
      current.map((image) =>
        image.status === "uploaded"
          ? image
          : { ...image, error: undefined, status: "pending" }
      )
    );

    try {
      let postId = metadataPostId;

      if (!postId) {
        const metadataResult = await createArchivePostMetadataAction(
          description,
          takenAt,
          {
            kind: isAlbumMode ? ARCHIVE_ALBUM_KIND : ARCHIVE_POST_KIND,
            title: isAlbumMode ? albumTitle : undefined,
          }
        );

        if (!metadataResult.ok) {
          setMessage({ ok: false, text: metadataResult.message });
          return;
        }

        postId = metadataResult.postId;
        setMetadataPostId(postId);
      }

      let uploadedCount = 0;
      const uploadedImageIdsByLocalId = new Map<string, string>();
      const failedImages: { fileName: string; message: string }[] = [];

      for (const [index, image] of uploadCandidates.entries()) {
        setUploadProgress(`subiendo ${index + 1} de ${uploadCandidates.length}`);
        updateImageStatus(image.id, "uploading");

        const imageFormData = new FormData();
        imageFormData.set("image", image.file);
        imageFormData.set(
          "order",
          String(selectedImages.findIndex((item) => item.id === image.id))
        );
        imageFormData.set("returnImages", "false");

        try {
          const result = await uploadSingleArchiveImageAction(
            postId,
            imageFormData
          );

          if (!result.ok) {
            failedImages.push({
              fileName: image.file.name,
              message: result.message,
            });
            updateImageStatus(image.id, "failed", result.message);
            continue;
          }

          uploadedCount += 1;
          uploadedImageIdsByLocalId.set(image.id, result.image.id);
          updateImageStatus(image.id, "uploaded", undefined, result.image.id);
        } catch {
          const failedMessage = `${image.file.name}: No se pudo subir la imagen.`;

          failedImages.push({
            fileName: image.file.name,
            message: failedMessage,
          });
          updateImageStatus(image.id, "failed", failedMessage);
        }
      }

      if (failedImages.length === 0) {
        if (isAlbumMode && postId) {
          const latestImages = selectedImagesRef.current;
          const requestedCover = latestImages.find(
            (image) => image.id === coverImageId
          );
          const coverArchiveImageId =
            requestedCover?.archiveImageId ??
            (requestedCover
              ? uploadedImageIdsByLocalId.get(requestedCover.id)
              : undefined) ??
            latestImages.find((image) => image.archiveImageId)?.archiveImageId ??
            uploadedImageIdsByLocalId.values().next().value;

          if (coverArchiveImageId) {
            await updateArchiveCoverImageAction(postId, coverArchiveImageId);
          }
        }

        selectedImages.forEach((image) =>
          URL.revokeObjectURL(image.previewUrl)
        );
        setAlbumTitle("");
        setCoverImageId(null);
        setDescription("");
        setMetadataPostId(null);
        setSelectedImages([]);
        setShowAllAlbumPreviews(false);
        setTakenAt(formatDateTimeLocal(new Date()));
        setUploadProgress(null);
        setMessage({ ok: true, text: "guardado en archive" });
        onCreated?.();
        return;
      }

      const failedSummary = formatFailureSummary(
        failedImages.map((image) => image.message)
      );

      if (uploadedCount === 0 && postId) {
        await deleteArchivePostAction(postId);
        setMetadataPostId(null);
        setUploadProgress(null);
        setMessage({
          ok: false,
          text: `No se subio ninguna imagen. El archivo vacio fue eliminado.\n${failedSummary}`,
        });
        return;
      }

      if (isAlbumMode && postId) {
        const latestImages = selectedImagesRef.current;
        const requestedCover = latestImages.find(
          (image) => image.id === coverImageId
        );
        const coverArchiveImageId =
          requestedCover?.archiveImageId ??
          (requestedCover
            ? uploadedImageIdsByLocalId.get(requestedCover.id)
            : undefined) ??
          latestImages.find((image) => image.archiveImageId)?.archiveImageId ??
          uploadedImageIdsByLocalId.values().next().value;

        if (coverArchiveImageId) {
          await updateArchiveCoverImageAction(postId, coverArchiveImageId);
        }
      }

      setUploadProgress(null);
      setMessage({
        ok: false,
        text: `${uploadedCount} imagen${uploadedCount === 1 ? "" : "es"} subid${
          uploadedCount === 1 ? "a" : "as"
        }, ${failedImages.length} fallaron.\n${failedSummary}\nPuedes reintentar sin duplicar las que ya subieron.`,
      });
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
              accept={ARCHIVE_IMAGE_ACCEPT}
              className="sr-only"
              multiple
              name="images"
              onChange={handleFilesChange}
              ref={inputRef}
              type="file"
            />
            <button
              className="rounded-full px-4 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10"
              disabled={isProcessingImages}
              onClick={() => inputRef.current?.click()}
              type="button"
            >
              {isProcessingImages ? "procesando" : "elegir"}
            </button>
          </div>
        </div>

        {selectedImages.length > 0 ? (
          isAlbumMode ? (
            <div className="space-y-4 rounded-2xl border border-neutral-800 bg-black p-4">
              <div className="space-y-1">
                <p className="text-sm text-neutral-300">album</p>
                <p className="text-xs leading-5 text-neutral-500">
                  seleccionaste mas de {ARCHIVE_ALBUM_THRESHOLD} imagenes, asi
                  que se publicara como album. el titulo es obligatorio.
                </p>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm text-neutral-400">
                  titulo del album
                </span>
                <input
                  className="w-full rounded-2xl border border-neutral-800 bg-black px-4 py-3 text-base text-white outline-none transition placeholder:text-neutral-600 focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500/40"
                  onChange={(event) => setAlbumTitle(event.target.value)}
                  placeholder="titulo"
                  required={isAlbumMode}
                  value={albumTitle}
                />
              </label>

              {selectedImages[0] ? (
                <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                  <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950">
                    <img
                      alt="cover preview"
                      className="aspect-square h-full w-full object-cover"
                      loading="lazy"
                      src={
                        selectedImages.find((image) => image.id === coverImageId)
                          ?.previewUrl ?? selectedImages[0].previewUrl
                      }
                    />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <p className="text-sm text-neutral-300">
                      {selectedImages.length} fotos seleccionadas
                    </p>
                    <p className="break-words text-xs leading-5 text-neutral-500">
                      portada:{" "}
                      {selectedImages.find((image) => image.id === coverImageId)
                        ?.file.name ?? selectedImages[0].file.name}
                    </p>
                    <p className="text-xs leading-5 text-neutral-500">
                      pendientes {uploadStatusCounts.pending} / subiendo{" "}
                      {uploadStatusCounts.uploading} / subidas{" "}
                      {uploadStatusCounts.uploaded} / fallidas{" "}
                      {uploadStatusCounts.failed}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="grid max-h-80 grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-6">
                {albumPreviewImages.map((image) => {
                  const index = selectedImages.findIndex(
                    (item) => item.id === image.id
                  );

                  return (
                  <div
                    className={
                      image.id === coverImageId
                        ? "overflow-hidden rounded-xl border border-[#ff003c] bg-neutral-950"
                        : "overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950"
                    }
                    key={image.id}
                  >
                    <button
                      className="block aspect-square w-full"
                      disabled={isSubmitting}
                      onClick={() => setCoverImageId(image.id)}
                      type="button"
                    >
                      <img
                        alt={image.file.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        src={image.previewUrl}
                      />
                    </button>
                    <div className="space-y-1 p-1.5">
                      <p className="truncate text-[11px] text-neutral-500">
                        {index + 1}
                      </p>
                      <button
                        className="w-full rounded-full px-2 py-1 text-[11px] text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:text-neutral-700 disabled:hover:bg-transparent"
                        disabled={image.status === "uploaded" || isSubmitting}
                        onClick={() => removeImage(image.id)}
                        type="button"
                      >
                        quitar
                      </button>
                      <p
                        className={
                          image.status === "failed"
                            ? "truncate text-[11px] text-red-400"
                            : "truncate text-[11px] text-neutral-500"
                        }
                      >
                        {image.status}
                      </p>
                    </div>
                  </div>
                  );
                })}
              </div>

              {hiddenAlbumPreviewCount > 0 ? (
                <button
                  className="w-full rounded-full px-4 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:text-neutral-500 disabled:hover:bg-transparent"
                  disabled={isSubmitting}
                  onClick={() => setShowAllAlbumPreviews(true)}
                  type="button"
                >
                  mostrar {hiddenAlbumPreviewCount} mas
                </button>
              ) : showAllAlbumPreviews &&
                selectedImages.length > ALBUM_PREVIEW_LIMIT ? (
                <button
                  className="w-full rounded-full px-4 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:text-neutral-500 disabled:hover:bg-transparent"
                  disabled={isSubmitting}
                  onClick={() => setShowAllAlbumPreviews(false)}
                  type="button"
                >
                  ver menos
                </button>
              ) : null}
            </div>
          ) : (
            <SortableImageGrid
              disabled={Boolean(metadataPostId) || isSubmitting}
              items={selectedImages}
              onReorder={moveImage}
              renderItem={(image, index) => (
                <>
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
                        disabled={
                          index === 0 || Boolean(metadataPostId) || isSubmitting
                        }
                        onClick={() => moveImage(index, index - 1)}
                        type="button"
                      >
                        &lt;
                      </button>
                      <button
                        className="rounded-full px-2 py-2 text-xs text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:text-neutral-700 disabled:hover:bg-transparent"
                        disabled={
                          index === selectedImages.length - 1 ||
                          Boolean(metadataPostId) ||
                          isSubmitting
                        }
                        onClick={() => moveImage(index, index + 1)}
                        type="button"
                      >
                        &gt;
                      </button>
                      <button
                        className="rounded-full px-2 py-2 text-xs text-[#ff003c] transition hover:bg-[#ff003c]/10"
                        disabled={image.status === "uploaded" || isSubmitting}
                        onClick={() => removeImage(image.id)}
                        type="button"
                      >
                        quitar
                      </button>
                    </div>
                    <p
                      className={
                        image.status === "failed"
                          ? "whitespace-pre-wrap text-xs text-red-400"
                          : "text-xs text-neutral-500"
                      }
                    >
                      {image.status}
                      {image.error ? `: ${image.error}` : ""}
                    </p>
                  </div>
                </>
              )}
            />
          )
        ) : null}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-neutral-400">fecha del archivo</span>
            <div aria-label="Modo de fecha" className="flex gap-1" role="group">
              <button
                aria-pressed={dateMode === "oldest"}
                className={
                  dateMode === "oldest"
                    ? "rounded-full bg-[#ff003c]/10 px-3 py-1.5 text-xs text-[#ff003c]"
                    : "rounded-full px-3 py-1.5 text-xs text-neutral-500 transition hover:bg-[#ff003c]/10 hover:text-[#ff003c]"
                }
                onClick={() => setDateMode("oldest")}
                type="button"
              >
                mas antigua
              </button>
              <button
                aria-pressed={dateMode === "newest"}
                className={
                  dateMode === "newest"
                    ? "rounded-full bg-[#ff003c]/10 px-3 py-1.5 text-xs text-[#ff003c]"
                    : "rounded-full px-3 py-1.5 text-xs text-neutral-500 transition hover:bg-[#ff003c]/10 hover:text-[#ff003c]"
                }
                onClick={() => setDateMode("newest")}
                type="button"
              >
                mas reciente
              </button>
            </div>
          </div>
          <input
            aria-label="fecha del archivo"
            className="w-full rounded-2xl border border-neutral-800 bg-black px-4 py-3 text-base text-white outline-none transition placeholder:text-neutral-600 focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500/40"
            name="takenAt"
            onChange={(event) => setTakenAt(event.target.value)}
            required
            type="datetime-local"
            value={takenAt}
          />
          <span className="block text-xs leading-5 text-neutral-500">
            se usa la fecha {dateMode === "newest" ? "mas reciente" : "mas antigua"}{" "}
            detectada; puedes cambiarla
          </span>
        </div>

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
          {uploadProgress ? (
            <p className="text-sm text-neutral-500">{uploadProgress}</p>
          ) : null}
          {message.text ? (
            <p
              className={
                message.ok
                  ? "text-sm text-green-400"
                  : "whitespace-pre-wrap text-sm text-red-400"
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
            {isSubmitting
              ? "subiendo"
              : metadataPostId
                ? "reintentar"
                : "guardar"}
          </button>
        </div>
      </div>
    </form>
  );
}
