import fs from 'fs';
import path from 'path';

const exts = new Set(['.ts', '.tsx', '.js', '.jsx']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue;
      walk(p, out);
    } else {
      const ext = path.extname(p);
      if (exts.has(ext)) out.push(p);
    }
  }
  return out;
}

function rewrite(content, file) {
  let changed = content;

  // 1) Objetos de ruta (UrlObject)
  changed = changed.replace(
    /pathname:\s*['"]\/actividades\/\[artistId\]['"]/g,
    "pathname: '/actividades/artista/[artistId]'"
  );
  changed = changed.replace(
    /pathname:\s*['"]\/actividades\/\[activityId\]['"]/g,
    "pathname: '/actividades/actividad/[activityId]'"
  );

  // 2) Plantillas tipo `/actividades/${algo}`
  // Si el placeholder contiene 'activity', mandamos a /actividad; si no, a /artista.
  changed = changed.replace(/\/actividades\/\$\{([^}]+)\}/g, (m, p1) => {
    const key = String(p1).toLowerCase();
    if (key.includes('activity')) return `/actividades/actividad/\${${p1}}`;
    return `/actividades/artista/\${${p1}}`;
  });

  // 3) push("/actividades/${...}") o strings simples (muy comunes)
  changed = changed.replace(/["'`]\/actividades\/\$\{([^}]+)\}["'`]/g, (m, p1) => {
    const key = String(p1).toLowerCase();
    if (key.includes('activity')) return "`/actividades/actividad/${" + p1 + "}`";
    return "`/actividades/artista/${" + p1 + "}`";
  });

  return changed;
}

function run() {
  const roots = [];
  if (fs.existsSync('app')) roots.push('app');
  if (fs.existsSync('components')) roots.push('components');
  if (roots.length === 0) {
    console.log('No se encontraron carpetas app/ ni components/. Nada que hacer.');
    return;
  }

  const files = roots.flatMap(r => walk(r));
  let edited = 0;

  for (const f of files) {
    const old = fs.readFileSync(f, 'utf8');
    const neu = rewrite(old, f);
    if (neu !== old) {
      fs.writeFileSync(f, neu);
      edited++;
      console.log('✔ Actualizado:', f);
    }
  }
  console.log(`\nHecho. Archivos modificados: ${edited}`);
}

run();
