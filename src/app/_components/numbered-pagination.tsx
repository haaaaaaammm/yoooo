import Link from "next/link";

type NumberedPaginationProps = {
  basePath: string;
  page: number;
  totalPages: number;
};

function pageHref(basePath: string, page: number) {
  const separator = basePath.includes("?") ? "&" : "?";

  return `${basePath}${separator}page=${page}`;
}

// Shared style for the non-active controls (page numbers and the previous link)
// so the `<` link visually matches the inactive page-number links.
const navLinkClassName =
  "rounded-full px-4 py-2 text-sm text-neutral-500 transition hover:bg-[#ff003c]/10 hover:text-[#ff003c] focus:outline-none focus-visible:bg-[#ff003c]/10 focus-visible:text-[#ff003c]";

export default function NumberedPagination({
  basePath,
  page,
  totalPages,
}: NumberedPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-center gap-2 border-b border-neutral-800 px-4 py-4"
    >
      {currentPage > 1 ? (
        <Link
          aria-label="Pagina anterior"
          className={navLinkClassName}
          href={pageHref(basePath, currentPage - 1)}
        >
          &lt;
        </Link>
      ) : null}
      {pages.map((pageNumber) => {
        const isActive = pageNumber === currentPage;

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "rounded-full bg-[#ff003c]/10 px-4 py-2 text-sm text-[#ff003c] focus:outline-none focus-visible:bg-[#ff003c]/10"
                : navLinkClassName
            }
            href={pageHref(basePath, pageNumber)}
            key={pageNumber}
          >
            {pageNumber}
          </Link>
        );
      })}
    </nav>
  );
}
