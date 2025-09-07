'use client'

import { useState } from 'react'

type Dept = { id: string; name: string }

export default function UserCreate({
  actionCreate,
  departments
}: {
  // server action
  actionCreate: (data: FormData) => Promise<void>
  departments: Dept[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      {!open ? (
        <button className="btn" onClick={() => setOpen(true)}>+ Añadir usuario</button>
      ) : (
        <form action={actionCreate} className="bg-white border rounded p-3 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm mb-1">Email *</label>
              <input name="email" type="email" required className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm mb-1">Nombre completo</label>
              <input name="full_name" className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm mb-1">Nick</label>
              <input name="nick" className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm mb-1">Departamento</label>
              <select name="department_id" className="w-full border rounded px-3 py-2">
                <option value="">(sin departamento)</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="is_admin" /> Administrador
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button className="btn">Crear</button>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
          </div>
        </form>
      )}
    </div>
  )
}
