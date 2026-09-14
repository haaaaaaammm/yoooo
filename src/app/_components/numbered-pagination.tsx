import Link from "next/link";

import {
  getPaginationHref,
  getPaginationItems,
  type PaginationItem,
} from "@/lib/pagination";

type NumberedPaginationProps = {
  basePath: string;
  page: number;
  totalPages: number;
};

const controlClassName =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-sm text-neutral-500 transition hover:bg-[#ff003c]/10 hover:text-[#ff003c] focus:outline-none focus-visible:bg-[#ff003c]/10 focus-visible:text-[#ff003c]";
const activeClassName =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-[#ff003c]/10 px-2 text-sm text-[#ff003c] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#ff003c]/50";
const disabledClassName =
  "inline-flex h-9 min-w-9 items-center justify-center px-2 text-sm text-neutral-700";

function PaginationRow({
  className,
  currentPage,
  items,
  totalPages,
  basePath,
}: {
  basePath: string;
  className: string;
  currentPage: number;
  items: PaginationItem[];
  totalPages: number;
}) {
  return (
    <div className={className}>
      {currentPage > 1 ? (
        <Link
          aria-label="Previous page"
          className={controlClassName}
          href={getPaginationHref(basePath, currentPage - 1)}
        >
          &lt;
        </Link>
      ) : (
        <span aria-hidden="true" className={disabledClassName}>
          &lt;
        </span>
      )}

      {items.map((item, index) =>
        item === "ellipsis" ? (
          <span
            aria-hidden="true"
            className="inline-flex h-9 min-w-5 items-center justify-center text-sm text-neutral-600"
            key={`ellipsis-${index}`}
          >
            …
          </span>
        ) : (
          <Link
            aria-current={item === currentPage ? "page" : undefined}
            aria-label={`Page ${item}`}
            className={
              item === currentPage ? activeClassName : controlClassName
            }
            href={getPaginationHref(basePath, item)}
            key={item}
          >
            {item}
          </Link>
        )
      )}

      {currentPage < totalPages ? (
        <Link
          aria-label="Next page"
          className={controlClassName}
          href={getPaginationHref(basePath, currentPage + 1)}
        >
          &gt;
        </Link>
      ) : (
        <span aria-hidden="true" className={disabledClassName}>
          &gt;
        </span>
      )}
    </div>
  );
}

export default function NumberedPagination({
  basePath,
  page,
  totalPages,
}: NumberedPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const currentPage = Math.min(Math.max(page, 1), totalPages);

  return (
    <nav
      aria-label="Pagination"
      className="border-b border-neutral-800 px-2 py-4"
    >
      <PaginationRow
        basePath={basePath}
        className="flex min-w-0 items-center justify-center gap-0.5 sm:hidden"
        currentPage={currentPage}
        items={getPaginationItems(currentPage, totalPages, 0)}
        totalPages={totalPages}
      />
      <PaginationRow
        basePath={basePath}
        className="hidden min-w-0 items-center justify-center gap-1 sm:flex"
        currentPage={currentPage}
        items={getPaginationItems(currentPage, totalPages, 1)}
        totalPages={totalPages}
      />
    </nav>
  );
}
