(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const engine = globalThis.HeapEngine;
  const initialValues = [90, 75, 80, 40, 60, 55, 65, 20, 35];
  let nextId = 0;
  const makeEntries = values => values.map(value => ({ id: `node-${nextId++}`, value }));
  let mode = 'max';
  let cursor = 0;
  let playing = false;
  let timer = null;
  let selectedId = null;
  let frames = [readyFrame(makeEntries(initialValues))];
  const treeElements = new Map();
  const vectorElements = new Map();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function readyFrame(entries) {
    return { entries, kind: 'done', title: entries.length ? 'Tudo em seu lugar' : 'Vamos começar?', description: entries.length ? `O ${mode}-heap está pronto. Insira um valor e acompanhe os ajustes, ou inicie a ordenação.` : 'Insira seus primeiros valores no campo acima. A árvore e o vetor serão construídos juntos, passo a passo.', active: [], sortedFrom: entries.length, formula: mode === 'max' ? 'pai ≥ filhos' : 'pai ≤ filhos', comparisons: 0, swaps: 0 };
  }

  function currentFrame() { return frames[cursor]; }
  function pause() {
    clearTimeout(timer);
    playing = false;
    renderControls();
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!playing) return;
      if (cursor < frames.length - 1) cursor++;
      if (cursor === frames.length - 1) playing = false;
      render();
      if (playing) schedule();
    }, Number($('speed').value));
  }

  function play() {
    if (frames.length <= 1) return;
    if (cursor === frames.length - 1) cursor = 0;
    playing = true;
    render();
    schedule();
  }

  function startOperation(newFrames) {
    pause();
    frames = newFrames;
    cursor = 0;
    selectedId = null;
    clearError();
    play();
  }

  function showError(message) {
    $('input-error').textContent = message;
    $('input-error').hidden = false;
    $('values-input').setAttribute('aria-invalid', 'true');
    $('values-input').focus();
  }

  function clearError() {
    $('input-error').hidden = true;
    $('values-input').removeAttribute('aria-invalid');
  }

  function selectEntry(id) {
    selectedId = selectedId === id ? null : id;
    renderVisuals();
  }

  function classification(index, frame) {
    const classes = [];
    if (index >= frame.sortedFrom) classes.push('sorted');
    if (frame.active.includes(index)) {
      if (frame.kind === 'compare') classes.push('comparing');
      if (frame.kind === 'swap') classes.push('swapping');
      if (frame.kind === 'insert') classes.push('is-new');
    }
    if (frame.entries[index].id === selectedId) classes.push('selected');
    return classes;
  }

  function position(index, levels, height) {
    const level = Math.floor(Math.log2(index + 1));
    const levelStart = 2 ** level - 1;
    return { x: ((index - levelStart + .5) / 2 ** level) * 100, y: 44 + level * ((height - 97) / (Math.max(levels, 4) - 1)) };
  }

  function renderVisuals() {
    const frame = currentFrame();
    const entries = frame.entries;
    const n = entries.length;
    const levels = n ? Math.floor(Math.log2(n)) + 1 : 0;
    const dense = n > 15;
    $('tree-canvas').classList.toggle('dense', dense);
    const height = $('tree-canvas').clientHeight;
    const present = new Set(entries.map(entry => entry.id));
    for (const [id, element] of treeElements) {
      if (!present.has(id)) { element.remove(); treeElements.delete(id); }
    }
    for (const [id, element] of vectorElements) {
      if (!present.has(id)) { element.remove(); vectorElements.delete(id); }
    }
    const previousRects = new Map();
    for (const [id, element] of vectorElements) previousRects.set(id, element.getBoundingClientRect());
    const svg = $('tree-edges');
    svg.replaceChildren();

    entries.forEach((entry, index) => {
      const point = position(index, levels, height);
      const classes = classification(index, frame);
      if (index > 0) {
        const parentIndex = Math.floor((index - 1) / 2);
        const parent = position(parentIndex, levels, height);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', `${parent.x}%`);
        line.setAttribute('y1', parent.y);
        line.setAttribute('x2', `${point.x}%`);
        line.setAttribute('y2', point.y);
        if (index >= frame.sortedFrom || parentIndex >= frame.sortedFrom) line.classList.add('edge-sorted');
        else if (frame.active.includes(index) && frame.active.includes(parentIndex)) line.classList.add('edge-active');
        svg.append(line);
      }

      let node = treeElements.get(entry.id);
      if (!node) {
        node = document.createElement('div');
        node.innerHTML = '<span class="node-circle"></span><span class="node-index"></span>';
        node.setAttribute('role', 'listitem');
        node.tabIndex = 0;
        node.addEventListener('click', () => selectEntry(entry.id));
        node.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectEntry(entry.id); } });
        treeElements.set(entry.id, node);
      }
      node.className = ['tree-node', index === 0 ? 'root' : '', n > 15 ? 'compact' : '', ...classes].join(' ');
      node.style.left = `${point.x}%`;
      node.style.top = `${point.y}px`;
      node.dataset.index = index;
      node.dataset.value = entry.value;
      const circle = node.firstElementChild;
      circle.textContent = entry.value;
      circle.classList.toggle('long-value', String(entry.value).length > 3);
      node.lastElementChild.textContent = index;
      const status = index >= frame.sortedFrom ? ', posição ordenada' : '';
      node.setAttribute('aria-label', `Índice ${index}, valor ${entry.value}${index === 0 ? ', raiz' : ''}${status}. Pressione Enter para destacar no vetor.`);
      node.title = `vetor[${index}] = ${entry.value}`;
      const treeAtIndex = $('tree-nodes').children[index];
      if (treeAtIndex !== node) $('tree-nodes').insertBefore(node, treeAtIndex || null);

      let slot = vectorElements.get(entry.id);
      if (!slot) {
        slot = document.createElement('div');
        slot.className = 'vector-slot';
        slot.setAttribute('role', 'listitem');
        slot.tabIndex = 0;
        slot.innerHTML = '<span class="vector-cell"></span><span class="vector-index"></span>';
        slot.addEventListener('click', () => selectEntry(entry.id));
        slot.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectEntry(entry.id); } });
        vectorElements.set(entry.id, slot);
      }
      slot.dataset.index = index;
      slot.dataset.value = entry.value;
      slot.setAttribute('aria-label', `Índice ${index}, valor ${entry.value}${status}. Pressione Enter para destacar na árvore.`);
      const cell = slot.firstElementChild;
      cell.textContent = entry.value;
      cell.className = ['vector-cell', String(entry.value).length > 3 ? 'long-value' : '', ...classes].join(' ');
      slot.lastElementChild.textContent = index;
      const vectorAtIndex = $('vector').children[index];
      if (vectorAtIndex !== slot) $('vector').insertBefore(slot, vectorAtIndex || null);
    });

    if (!reducedMotion.matches) {
      for (const [id, element] of vectorElements) {
        const old = previousRects.get(id);
        const now = element.getBoundingClientRect();
        if (old && (Math.abs(old.x - now.x) > 1 || Math.abs(old.y - now.y) > 1)) {
          element.getAnimations().forEach(animation => animation.cancel());
          element.animate([{ transform: `translate(${old.x - now.x}px, ${old.y - now.y}px)` }, { transform: 'translate(0, 0)' }], { duration: Math.min(400, Number($('speed').value) * .8), easing: 'ease-in-out' });
        }
      }
    }
    $('empty-tree').hidden = n > 0;
    $('empty-vector').hidden = n > 0;
    $('vector').hidden = n === 0;
    $('element-count').textContent = `${n} ${n === 1 ? 'elemento' : 'elementos'}`;
    $('tree-depth').textContent = `${levels} ${levels === 1 ? 'nível' : 'níveis'}`;
    $('root-value').textContent = n ? entries[0].value : '—';
    $('stat-size').replaceChildren(document.createTextNode(n), Object.assign(document.createElement('span'), { textContent: ' / 31' }));
    $('stat-comparisons').textContent = frame.comparisons;
    $('stat-swaps').textContent = frame.swaps;
    $('heap-rule').textContent = frame.kind === 'sorted' ? 'Ordenação concluída' : `Pai ${mode === 'max' ? '≥' : '≤'} filhos`;
  }

  function renderControls() {
    const n = currentFrame().entries.length;
    const inProgress = cursor < frames.length - 1;
    const hasHistory = frames.length > 1;
    $('previous-button').disabled = cursor === 0;
    $('next-button').disabled = !inProgress;
    $('restart-button').disabled = !hasHistory || (cursor === 0 && !playing);
    $('play-button').disabled = !hasHistory;
    $('play-button').setAttribute('aria-label', playing ? 'Pausar' : cursor === frames.length - 1 && hasHistory ? 'Reproduzir novamente' : 'Reproduzir');
    $('play-button').title = $('play-button').getAttribute('aria-label');
    $('play-icon').innerHTML = playing ? '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>' : '<path d="m8 5 11 7-11 7V5Z"/>';
    $('values-input').disabled = inProgress || playing;
    $('insert-button').disabled = inProgress || playing || n >= engine.LIMIT;
    $('sort-button').disabled = inProgress || playing || n < 2 || currentFrame().kind === 'sorted';
    $('sort-button').title = inProgress ? 'Conclua a demonstração antes de ordenar' : `Ordenar em ordem ${mode === 'max' ? 'crescente' : 'decrescente'}`;
    $('max-button').disabled = inProgress || playing;
    $('min-button').disabled = inProgress || playing;
    $('timeline').max = frames.length - 1;
    $('timeline').value = cursor;
    $('timeline').disabled = !hasHistory;
    $('timeline').style.setProperty('--progress', `${hasHistory ? cursor / (frames.length - 1) * 100 : 0}%`);
    $('timeline-count').textContent = `${cursor} / ${frames.length - 1}`;
    $('timeline-label').textContent = playing ? 'Demonstração em andamento' : inProgress ? 'Demonstração pausada' : hasHistory ? 'Demonstração concluída' : 'Pronto para explorar';
    document.documentElement.style.setProperty('--duration', `${Math.min(400, Number($('speed').value) * .8)}ms`);
  }

  function render() {
    const frame = currentFrame();
    renderVisuals();
    renderControls();
    $('step-heading').textContent = frame.title;
    $('step-description').textContent = frame.description;
    $('step-formula').textContent = frame.formula;
    $('step-counter').textContent = frames.length > 1 ? `ETAPA ${cursor + 1} / ${frames.length}` : 'PRONTO';
    $('step-icon').textContent = ({ compare: '?', swap: '⇄', insert: '+', done: '✓', sorted: '✓', start: '·' })[frame.kind];
    $('step-operation').firstElementChild.textContent = frame.kind === 'swap' ? 'TROCA DE POSIÇÕES' : frame.kind === 'compare' ? 'COMPARAÇÃO' : frame.kind === 'sorted' ? 'ORDEM FINAL' : 'REGRA DO HEAP';
    $('max-button').classList.toggle('active', mode === 'max');
    $('min-button').classList.toggle('active', mode === 'min');
    $('max-button').setAttribute('aria-pressed', mode === 'max');
    $('min-button').setAttribute('aria-pressed', mode === 'min');
    $('concept-property').textContent = mode === 'max' ? 'O maior fica no topo' : 'O menor fica no topo';
    $('concept-description').textContent = `No ${mode}-heap, cada pai é ${mode === 'max' ? 'maior' : 'menor'} ou igual aos seus filhos. A raiz guarda o ${mode === 'max' ? 'maior' : 'menor'} valor.`;
  }

  $('values-form').addEventListener('submit', event => {
    event.preventDefault();
    if (cursor < frames.length - 1 || playing) return;
    try {
      const values = engine.parseValues($('values-input').value, currentFrame().entries.length);
      const additions = makeEntries(values);
      const newFrames = engine.insertFrames(currentFrame().entries, additions, mode);
      $('values-input').value = '';
      startOperation(newFrames);
    } catch (error) { showError(error.message); }
  });

  $('values-input').addEventListener('input', clearError);
  $('sort-button').addEventListener('click', () => startOperation(engine.sortFrames(currentFrame().entries, mode)));
  $('random-button').addEventListener('click', () => {
    const values = Array.from({ length: 10 }, () => Math.floor(Math.random() * 90) + 10);
    startOperation(engine.buildFrames(makeEntries(values), mode));
  });
  $('clear-button').addEventListener('click', () => {
    pause();
    frames = [readyFrame([])];
    cursor = 0;
    selectedId = null;
    clearError();
    render();
    $('values-input').focus();
  });
  function changeMode(nextMode) {
    if (nextMode === mode || cursor < frames.length - 1 || playing) return;
    mode = nextMode;
    if (currentFrame().entries.length > 0) startOperation(engine.buildFrames(currentFrame().entries, mode));
    else { frames = [readyFrame([])]; render(); }
  }
  $('max-button').addEventListener('click', () => changeMode('max'));
  $('min-button').addEventListener('click', () => changeMode('min'));
  $('play-button').addEventListener('click', () => playing ? pause() : play());
  $('previous-button').addEventListener('click', () => { pause(); cursor = Math.max(0, cursor - 1); render(); });
  $('next-button').addEventListener('click', () => { pause(); cursor = Math.min(frames.length - 1, cursor + 1); render(); });
  $('restart-button').addEventListener('click', () => { pause(); cursor = 0; selectedId = null; render(); });
  $('timeline').addEventListener('input', event => { const target = Number(event.target.value); pause(); cursor = target; render(); });
  $('speed').addEventListener('change', () => { renderControls(); if (playing) schedule(); });
  $('help-button').addEventListener('click', () => {
    const expanded = $('help-button').getAttribute('aria-expanded') === 'true';
    $('help-button').setAttribute('aria-expanded', String(!expanded));
    $('help-panel').hidden = expanded;
  });
  document.addEventListener('keydown', event => {
    if (event.target.closest('input, select, textarea, button, a, [tabindex]')) return;
    if (event.code === 'Space' && frames.length > 1) { event.preventDefault(); playing ? pause() : play(); }
    if (event.key === 'ArrowRight' && cursor < frames.length - 1) { event.preventDefault(); pause(); cursor++; render(); }
    if (event.key === 'ArrowLeft' && cursor > 0) { event.preventDefault(); pause(); cursor--; render(); }
  });
  new ResizeObserver(() => renderVisuals()).observe($('tree-canvas'));
  render();
})();
