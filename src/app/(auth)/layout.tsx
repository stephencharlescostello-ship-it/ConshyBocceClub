import Link from "next/link";
import { Wordmark } from "@/components/ui/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
      <Link href="/" className="mb-8 inline-flex self-start" aria-label="CBC Shuffle home">
        <Wordmark />
      </Link>
      {children}
    </div>
  );
}
