// The numbered key points of an exercise's form. On a page with a 3D view it sits under the
// view's controls, above the muscles; elsewhere it follows the page's header.
export function FormSteps({ cues }: { cues: string[] }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xs font-medium tracking-wide text-faint">จุดสำคัญของฟอร์ม</h2>
      <ol className="flex flex-col">
        {cues.map((c, i) => (
          <li key={c} className="relative flex gap-4 pb-6 last:pb-0">
            {/* Connector between steps */}
            {i < cues.length - 1 && <span aria-hidden className="absolute top-9 bottom-1 left-[1.05rem] w-px bg-line" />}
            <span className="num grid h-9 w-9 shrink-0 place-items-center rounded-full bg-raised text-sm font-semibold text-primary">
              {i + 1}
            </span>
            <p className="pt-1.5 text-[1.02rem] leading-relaxed">{c}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
