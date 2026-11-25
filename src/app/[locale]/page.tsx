import { setRequestLocale } from "next-intl/server";
import { Hub } from "@/shared/ui/hub/hub";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <Hub />;
}
