// JSON lesbar und diff-freundlich formatieren: kurze Objekte/Arrays bleiben auf einer Zeile.
export function formatJSON(value, width = 110) {
  const inline = (v) => JSON.stringify(v).replace(/,"/g, ', "').replace(/":/g, '": ').replace(/,(?=[\d\-\[{"tfn])/g, ', ');
  const fmt = (v, ind) => {
    const one = inline(v);
    if (v === null || typeof v !== 'object' || ind.length + one.length <= width) return one;
    const nx = ind + '  ';
    if (Array.isArray(v)) return '[\n' + v.map((x) => nx + fmt(x, nx)).join(',\n') + '\n' + ind + ']';
    return '{\n' + Object.entries(v).map(([k, x]) => nx + JSON.stringify(k) + ': ' + fmt(x, nx)).join(',\n') + '\n' + ind + '}';
  };
  return fmt(value, '') + '\n';
}
