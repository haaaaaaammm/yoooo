"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import NumberedPagination from "@/app/_components/numbered-pagination";
import {
  ARCHIVO_ALBUM_KIND,
  ARCHIVO_IMAGE_ACCEPT,
} from "@/lib/archivo";
import { ADMIN_PATH } from "@/lib/posts";

import { prepareArchivoImageFiles } from "./archivo-image-processing";
import ArchivoComposer from "./archivo-composer";
import SortableImageGrid from "./sortable-image-grid";
import {
  deleteArchivoPostAction,
  getArchivoImagesAction,
  removeArchivoImageAction,
  reorderArchivoImagesAction,
  updateArchivoCoverImageAction,
  updateArchivoPostAction,
  uploadSingleArchivoImageAction,
} from "./actions";

type AdminArchivoImage = {
  id: string;
  key: string;
  order: number;
  url: string;
};

export type AdminArchivoPost = {
  coverImage: AdminArchivoImage | null;
  coverImageId: string | null;
  createdAt: string;
  description: string;
  id: string;
  imageCount: number;
  images: AdminArchivoImage[];
  kind: string;
  takenAt: string;
  title: string | null;
};

type ArchivoManagerProps = {
  page: number;
  posts: AdminArchivoPost[];
  totalPages: number;
};

type UploadStatus = "pending" | "uploading" | "uploaded" | "failed";

type AddImageQueueItem = {
  error?: string;
  file: File;
  id: string;
  order: number;
  status: UploadStatus;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateTimeLocal(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

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

function formatArchivoDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  }).format(new Date(value));
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
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

// Success notices show briefly then clear themselves after 5s. The id makes
// repeated identical messages restart the timer, and the cleanup clears any
// pending timeout so unmounting or a new notice never leaks one.
function useAutoDismissNotice() {
  const idRef = useRef(0);
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(
    null
  );

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = setTimeout(() => setNotice(null), 5000);

    return () => clearTimeout(timer);
  }, [notice]);

  function showNotice(text: string) {
    idRef.current += 1;
    setNotice({ id: idRef.current, text });
  }

  function clearNotice() {
    setNotice(null);
  }

  return { clearNotice, notice, showNotice };
}

function ArchivoPostManager({
  onDeleted,
  post,
}: {
  onDeleted: (postId: string) => void;
  post: AdminArchivoPost;
}) {
  const addImagesFormRef = useRef<HTMLFormElement>(null);
  const addImagesInputRef = useRef<HTMLInputElement>(null);
  const jumpToImageInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { clearNotice, notice, showNotice } = useAutoDismissNotice();
  const isAlbum = post.kind === ARCHIVO_ALBUM_KIND;
  const [addImageQueue, setAddImageQueue] = useState<AddImageQueueItem[]>([]);
  const [addUploadProgress, setAddUploadProgress] = useState<string | null>(
    null
  );
  const [coverImageId, setCoverImageId] = useState(post.coverImageId);
  const [description, setDescription] = useState(post.description);
  const [draftDescription, setDraftDescription] = useState(post.description);
  const [draftTakenAt, setDraftTakenAt] = useState(
    formatDateTimeLocal(post.takenAt)
  );
  const [draftTitle, setDraftTitle] = useState(post.title ?? "");
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState(post.images);
  const [imageCount, setImageCount] = useState(post.imageCount);
  const [isAddingImages, setIsAddingImages] = useState(false);
  const [isLoadingAllImages, setIsLoadingAllImages] = useState(false);
  const [isProcessingAddImages, setIsProcessingAddImages] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [jumpToImageNumber, setJumpToImageNumber] = useState("");
  const [pendingImageId, setPendingImageId] = useState<string | null>(null);
  const [takenAt, setTakenAt] = useState(post.takenAt);
  const [title, setTitle] = useState(post.title ?? "");
  const imageItemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const addImageCount = addImageQueue.length;
  const coverImage =
    images.find((image) => image.id === coverImageId) ??
    post.coverImage ??
    images[0] ??
    null;
  const visibleImages = images;
  const hasHiddenAlbumImages = isAlbum && imageCount > images.length;
  const coverImageIndex = images.findIndex((image) => image.id === coverImageId);
  const coverLabel =
    coverImageIndex >= 0
      ? `portada #${images[coverImageIndex].order + 1}`
      : null;
  const visibleAddImageQueue = isAlbum
    ? addImageQueue.slice(0, 12)
    : addImageQueue;
  const hiddenAddImageQueueCount =
    addImageQueue.length - visibleAddImageQueue.length;

  function startEditing() {
    setDraftDescription(description);
    setDraftTakenAt(formatDateTimeLocal(takenAt));
    setDraftTitle(title);
    setError(null);
    setIsEditing(true);
  }

  function cancelEditing() {
    setDraftDescription(description);
    setDraftTakenAt(formatDateTimeLocal(takenAt));
    setDraftTitle(title);
    setError(null);
    setIsEditing(false);
  }

  async function savePost() {
    setIsSaving(true);
    setError(null);
    clearNotice();

    try {
      const result = await updateArchivoPostAction(
        post.id,
        draftDescription,
        draftTakenAt,
        isAlbum ? draftTitle : undefined,
        isAlbum ? coverImageId : undefined
      );

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setDescription(result.description ?? draftDescription.trim());
      setTakenAt(result.takenAt ?? new Date(draftTakenAt).toISOString());
      setTitle(result.title ?? draftTitle.trim());
      setCoverImageId(result.coverImageId ?? coverImageId);
      setIsEditing(false);
      showNotice("archivo actualizado");
      router.refresh();
    } catch {
      setError("No se pudo guardar el archivo.");
    } finally {
      setIsSaving(false);
    }
  }

  async function addImages(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isProcessingAddImages) {
      setError("Espera a que terminen de procesarse.");
      return;
    }

    const uploadCandidates = addImageQueue.filter(
      (image) => image.status !== "uploaded"
    );

    if (uploadCandidates.length === 0) {
      setError("Selecciona al menos una imagen.");
      return;
    }

    setIsAddingImages(true);
    setError(null);
    setAddUploadProgress(null);
    clearNotice();
    setAddImageQueue((current) =>
      current.map((image) =>
        image.status === "uploaded"
          ? image
          : { ...image, error: undefined, status: "pending" }
      )
    );

    try {
      let uploadedCount = 0;
      let latestImages: AdminArchivoImage[] | null = null;
      const uploadedImages: AdminArchivoImage[] = [];
      const failedItems: AddImageQueueItem[] = [];

      for (const [index, image] of uploadCandidates.entries()) {
        setAddUploadProgress(
          `subiendo ${index + 1} de ${uploadCandidates.length}`
        );
        setAddImageQueue((current) =>
          current.map((item) =>
            item.id === image.id ? { ...item, status: "uploading" } : item
          )
        );

        const formData = new FormData();
        formData.set("image", image.file);
        formData.set("order", String(image.order));
        formData.set("returnImages", isAlbum ? "false" : "true");

        try {
          const result = await uploadSingleArchivoImageAction(post.id, formData);

          if (!result.ok) {
            failedItems.push({
              ...image,
              error: result.message,
              status: "failed",
            });
            setAddImageQueue((current) =>
              current.map((item) =>
                item.id === image.id
                  ? { ...item, error: result.message, status: "failed" }
                  : item
              )
            );
            continue;
          }

          uploadedCount += 1;
          uploadedImages.push(result.image);
          latestImages = result.images ?? null;
          setAddImageQueue((current) =>
            current.map((item) =>
              item.id === image.id ? { ...item, status: "uploaded" } : item
            )
          );
        } catch {
          const failedMessage = `${image.file.name}: No se pudo subir la imagen.`;

          failedItems.push({
            ...image,
            error: failedMessage,
            status: "failed",
          });
          setAddImageQueue((current) =>
            current.map((item) =>
              item.id === image.id
                ? { ...item, error: failedMessage, status: "failed" }
                : item
            )
          );
        }
      }

      if (latestImages) {
        setImages(latestImages);
        setImageCount(latestImages.length);
      } else if (uploadedImages.length > 0) {
        setImages((current) => {
          const currentIds = new Set(current.map((image) => image.id));
          const nextImages = [
            ...current,
            ...uploadedImages.filter((image) => !currentIds.has(image.id)),
          ].sort((left, right) => left.order - right.order);

          return nextImages;
        });
        setImageCount((current) => current + uploadedImages.length);
      }

      setAddUploadProgress(null);

      if (failedItems.length === 0) {
        addImagesFormRef.current?.reset();
        setAddImageQueue([]);
        showNotice("imagenes agregadas");
        router.refresh();
        return;
      }

      setAddImageQueue(failedItems);
      setError(
        `${uploadedCount} imagen${uploadedCount === 1 ? "" : "es"} subid${
          uploadedCount === 1 ? "a" : "as"
        }, ${failedItems.length} fallaron.\n${formatFailureSummary(
          failedItems.map((image) => image.error ?? image.file.name)
        )}\nPuedes reintentar sin duplicar las que ya subieron.`
      );

      if (uploadedCount > 0) {
        router.refresh();
      }
    } catch {
      setError("No se pudieron agregar las imagenes.");
      addImagesFormRef.current?.reset();
    } finally {
      setAddUploadProgress(null);
      setIsAddingImages(false);
    }
  }

  async function removeImage(imageId: string) {
    if (!window.confirm("quitar imagen?")) {
      return;
    }

    setPendingImageId(imageId);
    setError(null);
    clearNotice();

    try {
      const result = await removeArchivoImageAction(imageId);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      if (result.images) {
        setImages(result.images);
        setImageCount(result.images.length);
      }

      if (result.coverImageId !== undefined) {
        setCoverImageId(result.coverImageId);
      }

      showNotice("imagen quitada");
    } catch {
      setError("No se pudo quitar la imagen.");
    } finally {
      setPendingImageId(null);
    }
  }

  async function reorderImages(fromIndex: number, toIndex: number) {
    const previousImages = images;
    const nextImages = moveItem(images, fromIndex, toIndex).map(
      (image, index) => ({ ...image, order: index })
    );

    setImages(nextImages);
    setPendingImageId(nextImages[toIndex]?.id ?? null);
    setError(null);

    try {
      const result = await reorderArchivoImagesAction(
        post.id,
        nextImages.map((image) => image.id)
      );

      if (!result.ok) {
        setImages(previousImages);
        setError(result.message);
        return;
      }

      if (result.images) {
        setImages(result.images);
      }

      router.refresh();
    } catch {
      setImages(previousImages);
      setError("No se pudo reordenar.");
    } finally {
      setPendingImageId(null);
    }
  }

  async function deletePost() {
    if (!window.confirm("borrar archivo completo?")) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const result = await deleteArchivoPostAction(post.id);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      onDeleted(post.id);
      router.refresh();
    } catch {
      setError("No se pudo borrar el archivo.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function loadAllImages() {
    setIsLoadingAllImages(true);
    setError(null);
    clearNotice();

    try {
      const result = await getArchivoImagesAction(post.id);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setCoverImageId(result.coverImageId);
      setImageCount(result.images.length);
      setImages(result.images);
      showNotice("imagenes cargadas");
    } catch {
      setError("No se pudieron cargar las imagenes.");
    } finally {
      setIsLoadingAllImages(false);
    }
  }

  function jumpToImage() {
    const imageNumber = Number(
      jumpToImageInputRef.current?.value ?? jumpToImageNumber
    );

    if (
      !Number.isSafeInteger(imageNumber) ||
      imageNumber < 1 ||
      imageNumber > images.length
    ) {
      setError(`Elige un numero entre 1 y ${images.length}.`);
      return;
    }

    const targetImage = images[imageNumber - 1];

    if (!targetImage) {
      return;
    }

    setError(null);
    imageItemRefs.current[targetImage.id]?.scrollIntoView({
      behavior: "auto",
      block: "center",
    });
  }

  async function changeCover(imageId: string) {
    setPendingImageId(imageId);
    setError(null);
    clearNotice();

    try {
      const result = await updateArchivoCoverImageAction(post.id, imageId);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setCoverImageId(result.coverImageId ?? imageId);
      showNotice("portada actualizada");
    } catch {
      setError("No se pudo cambiar la portada.");
    } finally {
      setPendingImageId(null);
    }
  }

  async function handleAddImagesChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);

    setAddImageQueue([]);
    setAddUploadProgress(null);
    setError(null);
    clearNotice();

    if (files.length === 0) {
      input.value = "";
      return;
    }

    setIsProcessingAddImages(true);

    try {
      const result = await prepareArchivoImageFiles(files, `add-${post.id}`);

      if (result.errors.length > 0) {
        setError(result.errors.join("\n"));
      }

      setAddImageQueue(
        result.files.map((prepared, index) => ({
          file: prepared.file,
          id: crypto.randomUUID(),
          order: imageCount + index,
          status: "pending",
        }))
      );
    } finally {
      setIsProcessingAddImages(false);
      input.value = "";
    }
  }

  return (
    <li className="border-b border-neutral-800 transition hover:bg-neutral-950">
      <article className="px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <time className="text-sm text-neutral-500" dateTime={takenAt}>
              {formatArchivoDate(takenAt)}
            </time>
            {isAlbum ? (
              <div className="mt-2 flex min-w-0 gap-3">
                {coverImage ? (
                  <img
                    alt={title || "album cover"}
                    className="h-20 w-20 flex-none rounded-2xl border border-neutral-800 object-cover"
                    loading="lazy"
                    src={coverImage.url}
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="text-sm text-neutral-500">
                    album
                  </p>
                  <h2 className="mt-1 truncate text-lg font-semibold leading-6 text-white">
                    {title || "album"}
                  </h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    {imageCount} foto{imageCount === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            ) : null}
            {description ? (
              <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-6 text-neutral-100">
                {description}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="rounded-full px-4 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10"
              onClick={startEditing}
              type="button"
            >
              editar
            </button>
            <button
              className="rounded-full px-4 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:cursor-not-allowed disabled:text-neutral-500 disabled:hover:bg-transparent"
              disabled={isDeleting}
              onClick={deletePost}
              type="button"
            >
              {isDeleting ? "borrando" : "borrar"}
            </button>
          </div>
        </div>

        {isEditing ? (
          <div className="mt-4 space-y-3 rounded-2xl border border-neutral-800 bg-black p-3">
            {isAlbum ? (
              <>
                <label className="block">
                  <span className="mb-2 block text-sm text-neutral-400">
                    titulo
                  </span>
                  <input
                    className="w-full rounded-2xl border border-neutral-800 bg-black px-4 py-3 text-base text-white outline-none transition placeholder:text-neutral-600 focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500/40"
                    onChange={(event) => setDraftTitle(event.target.value)}
                    value={draftTitle}
                  />
                </label>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm text-neutral-400">portada</span>
                    {hasHiddenAlbumImages ? (
                      <button
                        className="rounded-full px-3 py-1.5 text-xs text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:text-neutral-500 disabled:hover:bg-transparent"
                        disabled={isLoadingAllImages}
                        onClick={loadAllImages}
                        type="button"
                      >
                        {isLoadingAllImages ? "cargando" : "cargar todas"}
                      </button>
                    ) : null}
                  </div>
                  <div className="grid max-h-48 grid-cols-5 gap-2 overflow-y-auto pr-1 sm:grid-cols-8">
                    {images.map((image, index) => (
                      <button
                        className={
                          image.id === coverImageId
                            ? "overflow-hidden rounded-xl border border-[#ff003c] bg-neutral-950"
                            : "overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950"
                        }
                        disabled={pendingImageId !== null}
                        key={image.id}
                        onClick={() => void changeCover(image.id)}
                        type="button"
                      >
                        <img
                          alt={`cover option ${index + 1}`}
                          className="aspect-square h-full w-full object-cover"
                          loading="lazy"
                          src={image.url}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
            <label className="block">
              <span className="mb-2 block text-sm text-neutral-400">
                fecha
              </span>
              <input
                className="w-full rounded-2xl border border-neutral-800 bg-black px-4 py-3 text-base text-white outline-none transition placeholder:text-neutral-600 focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500/40"
                onChange={(event) => setDraftTakenAt(event.target.value)}
                type="datetime-local"
                value={draftTakenAt}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-neutral-400">
                descripcion
              </span>
              <textarea
                className="min-h-24 w-full resize-y rounded-2xl border border-transparent bg-black px-1 text-md leading-7 text-white outline-none transition placeholder:text-neutral-500"
                onChange={(event) => setDraftDescription(event.target.value)}
                value={draftDescription}
              />
            </label>
            <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-900 pt-3">
              <button
                className="rounded-full px-5 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:cursor-not-allowed disabled:text-neutral-500 disabled:hover:bg-transparent"
                disabled={isSaving}
                onClick={cancelEditing}
                type="button"
              >
                cancelar
              </button>
              <button
                className="rounded-full px-5 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:cursor-not-allowed disabled:text-neutral-500 disabled:hover:bg-transparent"
                disabled={isSaving}
                onClick={savePost}
                type="button"
              >
                {isSaving ? "guardando" : "guardar"}
              </button>
            </div>
          </div>
        ) : null}

        {isAlbum ? (
          <div
            className="mt-4 overflow-hidden rounded-2xl border border-neutral-800 bg-black"
            data-archivo-album-manager={post.id}
          >
            <div className="border-b border-neutral-800 bg-black/95 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-neutral-300">
                    {images.length === imageCount
                      ? `${imageCount} foto${imageCount === 1 ? "" : "s"}`
                      : `mostrando ${images.length} de ${imageCount} fotos`}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {coverLabel ? `${coverLabel} / ` : ""}
                    scroll para administrar todas
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {hasHiddenAlbumImages ? (
                    <button
                      className="rounded-full px-3 py-1.5 text-xs text-[#ff003c] transition hover:bg-[#ff003c]/10 focus:outline-none focus-visible:bg-[#ff003c]/10 disabled:text-neutral-500 disabled:hover:bg-transparent"
                      disabled={isLoadingAllImages}
                      onClick={loadAllImages}
                      type="button"
                    >
                      {isLoadingAllImages ? "cargando" : "cargar todas"}
                    </button>
                  ) : null}
                  {images.length > 0 ? (
                    <div className="flex items-center gap-1">
                      <input
                        aria-label="Ir a imagen"
                        className="h-8 w-20 rounded-full border border-neutral-800 bg-black px-3 text-xs text-white outline-none transition placeholder:text-neutral-600 focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500/40"
                        max={images.length}
                        min={1}
                        onChange={(event) =>
                          setJumpToImageNumber(event.target.value)
                        }
                        placeholder="#"
                        ref={jumpToImageInputRef}
                        type="number"
                        value={jumpToImageNumber}
                      />
                      <button
                        className="rounded-full px-3 py-1.5 text-xs text-[#ff003c] transition hover:bg-[#ff003c]/10 focus:outline-none focus-visible:bg-[#ff003c]/10"
                        onClick={jumpToImage}
                        type="button"
                      >
                        ir
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="max-h-[30rem] overflow-y-auto overscroll-contain p-2 sm:max-h-[36rem]">
              {images.length === 0 ? (
                <p className="px-3 py-10 text-center text-sm leading-6 text-neutral-500">
                  este album no tiene imagenes
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {visibleImages.map((image, index) => (
                    <div
                      className={
                        image.id === coverImageId
                          ? "overflow-hidden rounded-xl border border-[#ff003c] bg-neutral-950"
                          : "overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950"
                      }
                      data-archivo-image-number={image.order + 1}
                      key={image.id}
                      ref={(node) => {
                        if (node) {
                          imageItemRefs.current[image.id] = node;
                        } else {
                          delete imageItemRefs.current[image.id];
                        }
                      }}
                    >
                      <div className="relative aspect-square">
                        <img
                          alt={`album image ${image.order + 1}`}
                          className="h-full w-full object-cover"
                          loading={index < 12 ? "eager" : "lazy"}
                          src={image.url}
                        />
                        <span className="absolute left-1.5 top-1.5 rounded-full bg-black/75 px-1.5 py-0.5 text-[11px] leading-none text-neutral-200">
                          #{image.order + 1}
                        </span>
                        {image.id === coverImageId ? (
                          <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/75 px-1.5 py-0.5 text-[11px] leading-none text-[#ff003c]">
                            portada
                          </span>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-2 gap-1 p-1.5">
                        <a
                          className="rounded-full px-2 py-1.5 text-center text-[11px] leading-none text-[#ff003c] transition hover:bg-[#ff003c]/10 focus:outline-none focus-visible:bg-[#ff003c]/10"
                          href={image.url}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          ver
                        </a>
                        <button
                          className="rounded-full px-2 py-1.5 text-[11px] leading-none text-[#ff003c] transition hover:bg-[#ff003c]/10 focus:outline-none focus-visible:bg-[#ff003c]/10 disabled:text-neutral-700 disabled:hover:bg-transparent"
                          disabled={
                            pendingImageId !== null || image.id === coverImageId
                          }
                          onClick={() => void changeCover(image.id)}
                          type="button"
                        >
                          portada
                        </button>
                        <button
                          className="col-span-2 rounded-full px-2 py-1.5 text-[11px] leading-none text-[#ff003c] transition hover:bg-[#ff003c]/10 focus:outline-none focus-visible:bg-[#ff003c]/10 disabled:cursor-not-allowed disabled:text-neutral-500 disabled:hover:bg-transparent"
                          disabled={pendingImageId !== null}
                          onClick={() => removeImage(image.id)}
                          type="button"
                        >
                          {pendingImageId === image.id ? "..." : "quitar"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <SortableImageGrid
            className="mt-4"
            disabled={pendingImageId !== null}
            items={visibleImages}
            onReorder={reorderImages}
            renderItem={(image, index) => (
              <>
                <div className="aspect-square">
                  <img
                    alt={`imagen de archivo ${index + 1}`}
                    className="h-full w-full object-cover"
                    src={image.url}
                  />
                </div>
                <div className="space-y-2 p-2">
                  <p className="text-xs text-neutral-500">
                    imagen {image.order + 1}
                    {image.id === coverImageId ? " / portada" : ""}
                  </p>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      className="rounded-full px-2 py-2 text-xs text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:text-neutral-700 disabled:hover:bg-transparent"
                      disabled={index === 0 || pendingImageId !== null}
                      onClick={() => reorderImages(index, index - 1)}
                      type="button"
                    >
                      &lt;
                    </button>
                    <button
                      className="rounded-full px-2 py-2 text-xs text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:text-neutral-700 disabled:hover:bg-transparent"
                      disabled={
                        index === images.length - 1 || pendingImageId !== null
                      }
                      onClick={() => reorderImages(index, index + 1)}
                      type="button"
                    >
                      &gt;
                    </button>
                    <button
                      className="rounded-full px-2 py-2 text-xs text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:cursor-not-allowed disabled:text-neutral-500 disabled:hover:bg-transparent"
                      disabled={pendingImageId !== null}
                      onClick={() => removeImage(image.id)}
                      type="button"
                    >
                      {pendingImageId === image.id ? "..." : "quitar"}
                    </button>
                  </div>
                </div>
              </>
            )}
          />
        )}

        <form
          className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-900 pt-3"
          onSubmit={addImages}
          ref={addImagesFormRef}
        >
          <div className="flex min-w-0 items-center gap-2">
            <input
              accept={ARCHIVO_IMAGE_ACCEPT}
              className="sr-only"
              multiple
              onChange={handleAddImagesChange}
              ref={addImagesInputRef}
              type="file"
            />
            <button
              className="rounded-full px-4 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:cursor-not-allowed disabled:text-neutral-500 disabled:hover:bg-transparent"
              disabled={isProcessingAddImages}
              onClick={() => addImagesInputRef.current?.click()}
              type="button"
            >
              {isProcessingAddImages ? "procesando" : "agregar imagenes"}
            </button>
            {isProcessingAddImages ? (
              <span className="text-sm text-neutral-500">procesando</span>
            ) : addImageCount > 0 ? (
              <span className="text-sm text-neutral-500">
                {addImageCount} seleccionada{addImageCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
          <button
            className="rounded-full px-5 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:cursor-not-allowed disabled:text-neutral-500 disabled:hover:bg-transparent"
            disabled={isAddingImages || isProcessingAddImages || addImageCount === 0}
            type="submit"
          >
            {isAddingImages ? "subiendo" : "subir"}
          </button>
        </form>

        {addUploadProgress ? (
          <p className="mt-3 text-sm text-neutral-500">{addUploadProgress}</p>
        ) : null}

        {addImageQueue.length > 0 ? (
          <div className="mt-3 space-y-1 text-xs text-neutral-500">
            {visibleAddImageQueue.map((image, index) => (
              <p
                className={
                  image.status === "failed"
                    ? "whitespace-pre-wrap text-red-400"
                    : undefined
                }
                key={image.id}
              >
                {index + 1}. {image.file.name} - {image.status}
                {image.error ? `: ${image.error}` : ""}
              </p>
            ))}
            {hiddenAddImageQueueCount > 0 ? (
              <p>...y {hiddenAddImageQueueCount} mas en la cola</p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 whitespace-pre-wrap text-sm text-red-400">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="mt-3 text-sm text-green-400">{notice.text}</p>
        ) : null}
      </article>
    </li>
  );
}

export default function ArchivoManager({
  page,
  posts: initialPosts,
  totalPages,
}: ArchivoManagerProps) {
  const router = useRouter();
  const { notice, showNotice } = useAutoDismissNotice();
  const [posts, setPosts] = useState(initialPosts);

  useEffect(() => {
    setPosts(initialPosts);
  }, [initialPosts]);

  return (
    <>
      <ArchivoComposer onCreated={() => router.refresh()} />

      <section aria-label="Gestor de archivo">
        {notice ? (
          <p className="border-b border-neutral-800 px-4 py-3 text-sm text-green-400">
            {notice.text}
          </p>
        ) : null}
        {posts.length === 0 ? (
          <p className="border-b border-neutral-800 px-4 py-10 text-center text-sm leading-6 text-neutral-500">
            todavia no hay archivo
          </p>
        ) : (
          <ol>
            {posts.map((post) => (
              <ArchivoPostManager
                key={post.id}
                onDeleted={(postId) => {
                  setPosts((currentPosts) =>
                    currentPosts.filter((currentPost) => currentPost.id !== postId)
                  );
                  showNotice("archivo borrado");
                }}
                post={post}
              />
            ))}
          </ol>
        )}
        <NumberedPagination
          basePath={`${ADMIN_PATH}?app=archivo`}
          page={page}
          totalPages={totalPages}
        />
      </section>
    </>
  );
}
