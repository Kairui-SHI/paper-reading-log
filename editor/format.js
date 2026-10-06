(() => {
  function formatReadingNote(source) {
    const lines = source.replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let fence = null, math = false;
    const blank = () => { if (out.length && out.at(-1) !== '') out.push(''); };
    for (let line of lines) {
      const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
      if (marker) {
        if (!fence) { blank(); fence = {char:marker[1][0],length:marker[1].length}; }
        else if (marker[1][0] === fence.char && marker[1].length >= fence.length && /^\s*(?:`+|~+)\s*$/.test(line)) fence = null;
        out.push(line); continue;
      }
      if (fence) {out.push(line);continue;}
      if (/^\s*(\$\$|\\\[|\\\])\s*$/.test(line)) {if (!math) blank(); math = !math;out.push(line);continue;}
      if (math || /^(?: {4}|\t)/.test(line) || /^\s*\|/.test(line) || /<\/?[a-z]/i.test(line)) {out.push(line);continue;}
      line = line.trimEnd();
      if (!line.trim()) {blank();continue;}
      line = line.replace(/^\s*[•●]\s*/, '- ').replace(/^(\d+)[、．]\s*/, '$1. ').replace(/^(\d+\.)\s*(?=\S)/, '$1 ');
      if (/^\s*[^#>*|\d\-].{0,23}[：:]\s*$/.test(line) && !/https?:|\$|`/.test(line)) line = `## ${line.trim().replace(/[：:]$/, '')}`;
      if (/^#{1,6}\s/.test(line)) {blank();out.push(line);blank();continue;}
      const list = /^(?:\s*[-*+] |\d+\. |>)/.test(line);
      const previousList = /^(?:\s*[-*+] |\d+\. |>)/.test(out.at(-1) || '');
      if (!list || !previousList) blank();
      out.push(line);
    }
    return out.join('\n').replace(/^\n+|\n+$/g, '') + (out.length ? '\n' : '');
  }
  globalThis.formatReadingNote = formatReadingNote;
})();
