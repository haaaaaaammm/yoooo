import { permanentRedirect } from "next/navigation";

type LegacyArchivoRedirectProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getQueryString(
  params: Record<string, string | string[] | undefined>
) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item));
      return;
    }

    query.set(key, value);
  });

  const queryString = query.toString();

  return queryString ? `?${queryString}` : "";
}

export default async function LegacyArchivoPage({
  searchParams,
}: LegacyArchivoRedirectProps) {
  const params = (await searchParams) ?? {};

  permanentRedirect(`/archivo${getQueryString(params)}`);
}
