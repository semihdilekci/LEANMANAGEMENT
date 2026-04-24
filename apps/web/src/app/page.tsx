import { EmptyObjectSchema } from '@leanmgmt/shared-schemas';

export default function HomePage() {
  EmptyObjectSchema.parse({});
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-semibold text-slate-800">Lean Management</h1>
      <p className="mt-2 text-slate-600">Monorepo iskeleti hazır.</p>
    </main>
  );
}
