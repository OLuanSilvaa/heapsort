/* The heap operations are iterative. Frames are presentation history, not
   auxiliary storage required by the sorting algorithm itself. */
(function (root) {
  'use strict';
  const LIMIT = 31;
  const MIN = -99999;
  const MAX = 99999;

  function parseValues(text, currentLength = 0) {
    const tokens = text.trim().split(/[\s,;]+/).filter(Boolean);
    if (!tokens.length) throw new Error('Digite pelo menos um número para inserir.');
    if (tokens.some(token => !/^[+-]?\d+$/.test(token))) {
      throw new Error('Use apenas números inteiros, separados por vírgula, espaço ou ponto e vírgula.');
    }
    const values = tokens.map(Number);
    if (values.some(value => !Number.isSafeInteger(value) || value < MIN || value > MAX)) {
      throw new Error('Os valores devem ser inteiros entre −99999 e 99999.');
    }
    if (currentLength + values.length > LIMIT) {
      throw new Error(`O heap comporta até ${LIMIT} elementos. Há espaço para ${Math.max(0, LIMIT - currentLength)} novo(s) valor(es).`);
    }
    return values;
  }

  const preferred = (a, b, mode) => mode === 'min' ? a < b : a > b;
  const rule = mode => mode === 'min' ? 'pai ≤ filhos' : 'pai ≥ filhos';

  function recorder(initial, mode) {
    const entries = initial.map(entry => ({ ...entry }));
    const frames = [];
    let comparisons = 0;
    let swaps = 0;
    function record(kind, title, description, active = [], sortedFrom = entries.length, formula = rule(mode)) {
      if (kind === 'compare') comparisons++;
      if (kind === 'swap') swaps++;
      frames.push({ entries: entries.map(entry => ({ ...entry })), kind, title, description, active: [...active], sortedFrom, formula, comparisons, swaps });
    }
    function swap(a, b) { [entries[a], entries[b]] = [entries[b], entries[a]]; }
    function siftDown(start, size, sortedFrom = entries.length) {
      let parent = start;
      while (parent * 2 + 1 < size) {
        const left = 2 * parent + 1;
        const right = left + 1;
        let best = parent;
        record('compare', 'Comparando com o filho esquerdo', `Compare ${entries[best].value} com ${entries[left].value}. O ${mode === 'min' ? 'menor' : 'maior'} valor deve ficar acima.`, [best, left], sortedFrom, `${entries[best].value} ${mode === 'min' ? '≤' : '≥'} ${entries[left].value} ?`);
        if (preferred(entries[left].value, entries[best].value, mode)) best = left;
        if (right < size) {
          record('compare', 'Comparando com o filho direito', `Compare ${entries[best].value} com ${entries[right].value} para escolher quem ocupa a posição do pai.`, [best, right], sortedFrom, `${entries[best].value} ${mode === 'min' ? '≤' : '≥'} ${entries[right].value} ?`);
          if (preferred(entries[right].value, entries[best].value, mode)) best = right;
        }
        if (best === parent) break;
        const oldParent = entries[parent].value;
        const child = entries[best].value;
        swap(parent, best);
        record('swap', 'Reorganizando o heap', `${child} sobe e ${oldParent} desce. A árvore e o vetor mostram a mesma troca.`, [parent, best], sortedFrom, `vetor[${parent}] ↔ vetor[${best}]`);
        parent = best;
      }
    }
    return { entries, frames, record, swap, siftDown };
  }

  function buildFrames(initial, mode = 'max') {
    const r = recorder(initial, mode);
    r.record('start', 'Construindo o heap', 'Os valores estão no vetor. Vamos ajustar a árvore de baixo para cima, a partir do último pai.');
    for (let i = Math.floor(r.entries.length / 2) - 1; i >= 0; i--) r.siftDown(i, r.entries.length);
    r.record('done', 'Tudo em seu lugar', `O ${mode}-heap está pronto. Cada pai respeita a regra: ${rule(mode)}.`);
    return r.frames;
  }

  function insertFrames(initial, additions, mode = 'max') {
    const r = recorder(initial, mode);
    r.record('start', 'Preparando a inserção', `${additions.length === 1 ? 'Um novo valor será inserido' : `${additions.length} novos valores serão inseridos`}. Cada elemento entra no fim do vetor e sobe até encontrar seu lugar.`);
    // Also restores the heap if the starting vector came from a completed sort.
    if (!isHeap(r.entries, mode)) {
      for (let i = Math.floor(r.entries.length / 2) - 1; i >= 0; i--) r.siftDown(i, r.entries.length);
    }
    for (const addition of additions) {
      r.entries.push({ ...addition });
      let child = r.entries.length - 1;
      r.record('insert', 'Um novo nó na árvore', `O valor ${addition.value} entra no índice ${child}, a próxima posição disponível na árvore completa.`, [child], r.entries.length, `vetor[${child}] = ${addition.value}`);
      while (child > 0) {
        const parent = Math.floor((child - 1) / 2);
        r.record('compare', 'Comparando com o pai', `O novo nó vale ${r.entries[child].value} e seu pai vale ${r.entries[parent].value}. Vamos verificar a regra do ${mode}-heap.`, [parent, child], r.entries.length, `${r.entries[parent].value} ${mode === 'min' ? '≤' : '≥'} ${r.entries[child].value} ?`);
        if (!preferred(r.entries[child].value, r.entries[parent].value, mode)) break;
        const value = r.entries[child].value;
        r.swap(parent, child);
        r.record('swap', 'O novo valor sobe', `${value} troca de posição com seu pai. O ajuste continua até a propriedade do heap ser respeitada.`, [parent, child], r.entries.length, `vetor[${parent}] ↔ vetor[${child}]`);
        child = parent;
      }
    }
    r.record('done', 'Inserção concluída', `Todos os valores encontraram seu lugar. O ${mode}-heap está ajustado e as duas representações estão sincronizadas.`);
    return r.frames;
  }

  function sortFrames(initial, mode = 'max') {
    const r = recorder(initial, mode);
    r.record('start', 'Preparando o Heap Sort', `Primeiro garantimos a propriedade do ${mode}-heap. Depois retiramos a raiz, um elemento por vez.`);
    for (let i = Math.floor(r.entries.length / 2) - 1; i >= 0; i--) r.siftDown(i, r.entries.length);
    for (let end = r.entries.length - 1; end > 0; end--) {
      const rootValue = r.entries[0].value;
      r.swap(0, end);
      r.record('swap', 'A raiz encontra seu lugar', `${rootValue}, o ${mode === 'min' ? 'menor' : 'maior'} valor do heap ativo, vai para o índice ${end}. Essa posição está ordenada.`, [0, end], end, `vetor[0] ↔ vetor[${end}]`);
      r.siftDown(0, end, end);
    }
    r.record('sorted', 'Vetor ordenado!', `Heap Sort concluído em ordem ${mode === 'min' ? 'decrescente' : 'crescente'}. Todos os ${r.entries.length} elementos estão em suas posições finais.`, [], 0, mode === 'min' ? 'maior → menor' : 'menor → maior');
    return r.frames;
  }

  function isHeap(entries, mode = 'max', size = entries.length) {
    for (let i = 1; i < size; i++) {
      if (preferred(entries[i].value, entries[Math.floor((i - 1) / 2)].value, mode)) return false;
    }
    return true;
  }

  root.HeapEngine = { LIMIT, parseValues, buildFrames, insertFrames, sortFrames, isHeap };
})(globalThis);
