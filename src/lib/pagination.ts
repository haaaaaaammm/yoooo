export type PaginationItem = number | "ellipsis";

export function getPaginationItems(
  page: number,
  totalPages: number,
  siblingCount: 0 | 1 = 1
): PaginationItem[] {
  if (totalPages <= 0) {
    return [];
  }

  const currentPage = Math.min(Math.max(Math.trunc(page), 1), totalPages);
  const edgeWindow = siblingCount === 0 ? 2 : 3;
  const visiblePages = new Set<number>([1, totalPages]);

  if (totalPages <= edgeWindow + 2) {
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      visiblePages.add(pageNumber);
    }
  } else if (currentPage <= edgeWindow) {
    for (let pageNumber = 1; pageNumber <= edgeWindow; pageNumber += 1) {
      visiblePages.add(pageNumber);
    }
  } else if (currentPage > totalPages - edgeWindow) {
    for (
      let pageNumber = totalPages - edgeWindow + 1;
      pageNumber <= totalPages;
      pageNumber += 1
    ) {
      visiblePages.add(pageNumber);
    }
  } else {
    for (
      let pageNumber = currentPage - siblingCount;
      pageNumber <= currentPage + siblingCount;
      pageNumber += 1
    ) {
      visiblePages.add(pageNumber);
    }
  }

  const sortedPages = [...visiblePages].sort((a, b) => a - b);
  const items: PaginationItem[] = [];

  sortedPages.forEach((pageNumber, index) => {
    const previousPage = sortedPages[index - 1];

    if (previousPage && pageNumber - previousPage > 1) {
      items.push("ellipsis");
    }

    items.push(pageNumber);
  });

  return items;
}

export function getPaginationHref(basePath: string, page: number) {
  const url = new URL(basePath, "https://pagination.invalid");
  url.searchParams.set("page", String(page));

  return `${url.pathname}${url.search}${url.hash}`;
}
