import Link from "next/link";

export default function ShareNotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold text-zinc-200 mb-3">404</h1>
        <p className="text-zinc-400 text-[15px] mb-6">
          This project doesn&apos;t exist or was unpublished.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500/80 hover:bg-green-500 text-white text-[14px] font-medium rounded-lg transition-colors"
        >
          Build your own site
        </Link>
      </div>
    </div>
  );
}
