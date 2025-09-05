import { ReactNode } from 'react'

export default function ModuleCard({
  title, leftActions, rightActions, children,
}: { title: string; leftActions?: ReactNode; rightActions?: ReactNode; children: ReactNode }) {
  return (
    <section className="border border-gray-200 rounded-md bg-white overflow-hidden">
      <header className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50/50">
        <div className="flex items-center gap-3">
          {leftActions}
          <h3 className="text-sm font-semibold module-title">{title}</h3>
        </div>
        <div className="flex items-center gap-2">{rightActions}</div>
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}
