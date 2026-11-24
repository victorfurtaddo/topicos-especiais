import { Simulator } from "@/components/analytics";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initial: Record<string, string> = {};
  for (const key of ["month", "category", "percent", "months"]) {
    const value = params[key];
    if (typeof value === "string") initial[key] = value;
  }
  return (
    <Simulator
      key={new URLSearchParams(initial).toString()}
      initial={initial}
    />
  );
}
