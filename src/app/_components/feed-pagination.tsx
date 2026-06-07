import Link from "next/link";

type FeedPaginationProps = {
  basePath: string;
  hasNextPage: boolean;
  page: number;
};

function pageHref(basePath: string, page: number) {
  return `${basePath}?page=${page}`;
}

export default function FeedPagination({
  basePath,
  hasNextPage,
  page,
}: FeedPaginationProps) {
  const linkClass =
    "rounded-full px-4 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10";

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between border-b border-neutral-800 px-4 py-4"
    >
      <div className="w-24">
        {page > 1 ? (
          <Link className={linkClass} href={pageHref(basePath, page - 1)}>
            previous
          </Link>
        ) : null}
      </div>
      <span className="text-sm text-neutral-500">Page {page}</span>
      <div className="flex w-24 justify-end">
        {hasNextPage ? (
          <Link className={linkClass} href={pageHref(basePath, page + 1)}>
            next
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
