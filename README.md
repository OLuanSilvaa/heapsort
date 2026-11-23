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
- Clique em um nó ou posição do vetor para destacar o mesmo elemento nas duas representações.
- **Exemplo aleatório** cria uma nova demonstração; **Limpar** inicia uma árvore vazia. Esses controles também cancelam a demonstração atual.
- Novas inserções, mudança de tipo e ordenação ficam disponíveis ao concluir a demonstração. É possível avançar até a última etapa pela linha do tempo.

## Arquivos

- `index.html`: estrutura da interface.
- `styles.css`: layout responsivo e animações.
- `heap-engine.js`: algoritmo iterativo e geração das etapas.
- `app.js`: controles, reprodução e renderização sincronizada.
- `tests/heap-engine.test.cjs`: testes das propriedades do heap, ordenação e validação de entrada.
- `tests/app.test.cjs`: testes de integração dos controles e da sincronização, usando um adaptador DOM sem dependências. Não substituem a verificação visual em navegador.

Para executar os testes, use `node --test` se tiver Node.js disponível.

O algoritmo de Heap Sort usa ajuste iterativo, tempo O(n log n) e memória auxiliar O(1). O visualizador armazena cópias das etapas para permitir voltar e avançar; esse histórico consome memória adicional e não faz parte do algoritmo de ordenação.
