export type PostOptionItem = "copy" | "edit" | "delete";

export function getPostOptionItems({
  canDelete,
  canEdit,
}: {
  canDelete: boolean;
  canEdit: boolean;
}): PostOptionItem[] {
  return [
    "copy",
    ...(canEdit ? (["edit"] as const) : []),
    ...(canDelete ? (["delete"] as const) : []),
  ];
}
