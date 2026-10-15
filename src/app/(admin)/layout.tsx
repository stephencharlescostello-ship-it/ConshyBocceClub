import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/data/session";
import { Wordmark } from "@/components/ui/logo";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=/admin");
  if (!viewer.isAdmin) redirect("/?denied=admin");
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2">
          <Link href="/admin" className="flex items-center gap-2"><Wordmark compact /><span className="chip bg-accent-soft text-accent">Admin</span></Link>
          <Link href="/" className="btn btn-ghost !min-h-[40px] px-3 text-sm">← App</Link>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-4 md:flex-row">
        <AdminNav />
        <main className="min-w-0 flex-1 pb-10">{children}</main>
      </div>
    </div>
  );
}
