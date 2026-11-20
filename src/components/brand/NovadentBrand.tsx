type NovadentBrandProps = {
  compact?: boolean
  className?: string
}

export function NovadentBrand({ compact = false, className = '' }: NovadentBrandProps) {
  return <div className={`flex items-center gap-3 ${className}`} aria-label="NovaDent · Consultorio odontológico">
    <span className={`flex shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-900/15 ${compact ? 'h-14 w-14' : 'h-16 w-16'}`}>
      <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className={compact ? 'h-10 w-10' : 'h-12 w-12'}>
        <path d="M16 11c-6 2-8 9-6 18l6 20c1 4 5 6 8 2l5-13c1-3 5-3 6 0l5 13c2 4 7 2 8-2l6-20c2-9 0-16-6-18-5-2-9 1-16 2-7-1-11-4-16-2Z" stroke="currentColor" strokeWidth="3.4" strokeLinejoin="round" />
        <path d="m43 6 1.5 4.5L49 12l-4.5 1.5L43 18l-1.5-4.5L37 12l4.5-1.5L43 6Z" fill="currentColor" />
      </svg>
    </span>
    <span className="min-w-0 leading-none">
      <span className={`block font-extrabold tracking-tight text-slate-950 ${compact ? 'text-[1.7rem]' : 'text-3xl'}`}>Nova<span className="text-blue-600">Dent</span></span>
      <span className="mt-1.5 block text-[0.6rem] font-bold uppercase tracking-[0.12em] text-slate-600">Consultorio odontológico</span>
    </span>
  </div>
}
