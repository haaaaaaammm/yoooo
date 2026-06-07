"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import ArchiveComposer from "./archive-composer";
import {
  addArchiveImagesAction,
  deleteArchivePostAction,
  removeArchiveImageAction,
  reorderArchiveImagesAction,
  updateArchivePostAction,
} from "./actions";

type AdminArchiveImage = {
  id: string;
  key: string;
  order: number;
  url: string;
};

export type AdminArchivePost = {
  createdAt: string;
  description: string;
  id: string;
  images: AdminArchiveImage[];
  takenAt: string;
};

type ArchiveManagerProps = {
  posts: AdminArchivePost[];
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

function formatArchiveDate(value: string) {
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

function ArchivePostManager({
  onDeleted,
  post,
}: {
  onDeleted: (postId: string) => void;
  post: AdminArchivePost;
}) {
  const addImagesFormRef = useRef<HTMLFormElement>(null);
  const addImagesInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { clearNotice, notice, showNotice } = useAutoDismissNotice();
  const [addImageCount, setAddImageCount] = useState(0);
  const [description, setDescription] = useState(post.description);
  const [draftDescription, setDraftDescription] = useState(post.description);
  const [draftTakenAt, setDraftTakenAt] = useState(
    formatDateTimeLocal(post.takenAt)
  );
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState(post.images);
  const [isAddingImages, setIsAddingImages] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingImageId, setPendingImageId] = useState<string | null>(null);
  const [takenAt, setTakenAt] = useState(post.takenAt);

  function startEditing() {
    setDraftDescription(description);
    setDraftTakenAt(formatDateTimeLocal(takenAt));
    setError(null);
    setIsEditing(true);
  }

  function cancelEditing() {
    setDraftDescription(description);
    setDraftTakenAt(formatDateTimeLocal(takenAt));
    setError(null);
    setIsEditing(false);
  }

  async function savePost() {
    setIsSaving(true);
    setError(null);
    clearNotice();

    try {
      const result = await updateArchivePostAction(
        post.id,
        draftDescription,
        draftTakenAt
      );

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setDescription(result.description ?? draftDescription.trim());
      setTakenAt(result.takenAt ?? new Date(draftTakenAt).toISOString());
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

    if (addImageCount === 0) {
      setError("Selecciona al menos una imagen.");
      return;
    }

    setIsAddingImages(true);
    setError(null);
    clearNotice();

    try {
      const formData = new FormData(event.currentTarget);
      const result = await addArchiveImagesAction(post.id, formData);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      if (result.images) {
        setImages(result.images);
      }

      addImagesFormRef.current?.reset();
      setAddImageCount(0);
      showNotice("imagenes agregadas");
      router.refresh();
    } catch {
      setError("No se pudieron agregar las imagenes.");
    } finally {
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
      const result = await removeArchiveImageAction(imageId);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      if (result.images) {
        setImages(result.images);
      }

      showNotice("imagen quitada");
      router.refresh();
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
      const result = await reorderArchiveImagesAction(
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
      const result = await deleteArchivePostAction(post.id);

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

  function handleAddImagesChange(event: ChangeEvent<HTMLInputElement>) {
    setAddImageCount(event.target.files?.length ?? 0);
  }

  return (
    <li className="border-b border-neutral-800 transition hover:bg-neutral-950">
      <article className="px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <time className="text-sm text-neutral-500" dateTime={takenAt}>
              {formatArchiveDate(takenAt)}
            </time>
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
            <label className="block">
              <span className="mb-2 block text-sm text-neutral-400">
                fecha
              </span>
              <input
                className="w-full rounded-2xl border border-neutral-800 bg-black px-4 py-3 text-base text-white outline-none transition placeholder:text-neutral-600 focus:border-[#ff003c] focus:ring-1 focus:ring-[#ff003c]"
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

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((image, index) => (
            <div
              className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950"
              key={image.id}
            >
              <div className="aspect-square">
                <img
                  alt={`archive image ${index + 1}`}
                  className="h-full w-full object-cover"
                  src={image.url}
                />
              </div>
              <div className="space-y-2 p-2">
                <p className="text-xs text-neutral-500">imagen {index + 1}</p>
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
                    disabled={pendingImageId === image.id}
                    onClick={() => removeImage(image.id)}
                    type="button"
                  >
                    {pendingImageId === image.id ? "..." : "quitar"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <form
          className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-900 pt-3"
          onSubmit={addImages}
          ref={addImagesFormRef}
        >
          <div className="flex min-w-0 items-center gap-2">
            <input
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              multiple
              name="images"
              onChange={handleAddImagesChange}
              ref={addImagesInputRef}
              type="file"
            />
            <button
              className="rounded-full px-4 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:cursor-not-allowed disabled:text-neutral-500 disabled:hover:bg-transparent"
              onClick={() => addImagesInputRef.current?.click()}
              type="button"
            >
              agregar imagenes
            </button>
            {addImageCount > 0 ? (
              <span className="text-sm text-neutral-500">
                {addImageCount} seleccionada{addImageCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
          <button
            className="rounded-full px-5 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:cursor-not-allowed disabled:text-neutral-500 disabled:hover:bg-transparent"
            disabled={isAddingImages || addImageCount === 0}
            type="submit"
          >
            {isAddingImages ? "subiendo" : "subir"}
          </button>
        </form>

        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        {notice ? (
          <p className="mt-3 text-sm text-green-400">{notice.text}</p>
        ) : null}
      </article>
    </li>
  );
}

export default function ArchiveManager({ posts: initialPosts }: ArchiveManagerProps) {
  const router = useRouter();
  const { notice, showNotice } = useAutoDismissNotice();
  const [posts, setPosts] = useState(initialPosts);

  useEffect(() => {
    setPosts(initialPosts);
  }, [initialPosts]);

  return (
    <>
      <ArchiveComposer onCreated={() => router.refresh()} />

      <section aria-label="Archive manager">
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
              <ArchivePostManager
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
      </section>
    </>
  );
}
