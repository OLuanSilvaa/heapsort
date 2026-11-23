# Heap Lab

Visualizador interativo de Heap Sort em português, com árvore binária e vetor sincronizados. Implementado em HTML, CSS e JavaScript, sem instalação ou compilação.

## Abrir

Abra `index.html` no navegador. O sistema funciona diretamente pelo arquivo, sem servidor. As fontes online são opcionais; quando indisponíveis, o navegador usa fontes locais.

## Usar

- Insira um ou vários inteiros, separados por vírgula, espaço ou ponto e vírgula. Aceita valores negativos, repetidos e zero, entre −99999 e 99999, com até 31 elementos.
- Cada inserção mostra as comparações e trocas necessárias para ajustar o heap.
- Selecione **Max-heap** ou **Min-heap**. A mudança reconstrói o heap com os mesmos valores.
- Use **Ordenar com Heap Sort** para ordenar em ordem crescente com max-heap ou decrescente com min-heap.
- Pause, volte, avance ou arraste a linha do tempo para revisar as etapas. A velocidade pode ser ajustada de 0,5× a 4×.
- Clique em um nó ou posição do vetor para selecionar o mesmo elemento nas duas representações. A seleção pausa a reprodução e mostra **Excluir selecionado**. A exclusão remove apenas o elemento escolhido, mesmo se houver números repetidos, e demonstra o ajuste do heap.
- É possível excluir durante uma ordenação pausada: o novo ajuste parte exatamente dos valores visíveis naquela etapa.
- Arraste um valor do vetor sobre outra posição para trocar os dois elementos. A reprodução pausa durante o gesto, e o destino fica destacado. Os valores só mudam e são salvos quando você solta o mouse sobre outra posição; em seguida, o ajuste do heap é demonstrado na árvore e no vetor. Soltar fora, sobre a mesma posição ou pressionar **Esc** cancela a troca.
- O estado atual é salvo no `localStorage` **a cada etapa**, inclusive durante inserções, exclusões, comparações, trocas e navegação manual. Ao recarregar, a árvore e o vetor voltam à etapa salva, com a reprodução pausada. O histórico, o tipo de heap e a velocidade também são restaurados.
- **Limpar** também salva o estado vazio. Se o navegador bloquear o armazenamento, o sistema continua funcionando e informa que o salvamento está indisponível.
- **Exemplo aleatório** cria uma nova demonstração; **Limpar** inicia uma árvore vazia. Esses controles também cancelam a demonstração atual.
- Novas inserções, mudança de tipo e ordenação ficam disponíveis ao concluir a demonstração. É possível avançar até a última etapa pela linha do tempo.

## Arquivos

- `index.html`: estrutura da interface.
- `styles.css`: layout responsivo e animações.
- `heap-engine.js`: inserção, exclusão, troca manual e ordenação iterativas, com geração das etapas.
- `app.js`: controles, reprodução, renderização sincronizada e persistência por etapa.
- `tests/heap-engine.test.cjs`: testes das propriedades do heap, ordenação e validação de entrada.
- `tests/app.test.cjs`: testes de integração dos controles e da sincronização, usando um adaptador DOM sem dependências. Não substituem a verificação visual em navegador.

Para executar os testes, use `node --test` se tiver Node.js disponível.

O algoritmo de Heap Sort usa ajuste iterativo, tempo O(n log n) e memória auxiliar O(1). O visualizador armazena cópias das etapas para permitir voltar e avançar; esse histórico consome memória adicional e não faz parte do algoritmo de ordenação.
