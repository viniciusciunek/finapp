# PRODUCT.md — Finanças do Casal

> Contexto de produto. Leia antes de qualquer tarefa. Regras detalhadas de negócio estão em `DOMAIN.md`; ordem de construção em `ROADMAP.md`.

## 1. Problema

Vinícius controla as contas em um caderno (uma página por mês). Isabelle controla as dela em uma planilha. São dois sistemas diferentes para a mesma tarefa, sem visão conjunta. O objetivo é **largar o caderno e a planilha** e ter tudo num só lugar, com visão pessoal e visão da família.

## 2. Usuários

| Usuário | Papel |
|---|---|
| Vinícius | Paga normalmente as contas da casa. Fecha o mês no início do mês seguinte, quando recebe (5º dia útil). Empresta dinheiro/cartão a familiares. |
| Isabelle | Paga as contas dela e envia a sobra para o Vinícius; o casal guarda e deixa rendendo. Também enxerga a visão da família. |

Uso previsto: principalmente no **celular** (lançar um gasto logo depois que acontece) e no **desktop** no dia do fechamento.

## 3. Princípios de produto

1. **O coração é a Folha do mês** (o caderno digital). Todo o resto alimenta a folha.
2. **Lançar gasto é rápido** (menos de 15 segundos): valor, descrição, forma de pagamento, salvar.
3. **Lançar no cartão é opcional.** O sistema calcula a fatura a partir dos lançamentos, mas o valor **real** da fatura sempre pode ser digitado no fechamento. O usuário não precisa ser perfeito.
4. **O sistema nunca esconde a diferença** entre o calculado e o real; mostra como "não lançado".
5. **Privado por padrão.** Dados pessoais de cada um são invisíveis para o outro. A família é um espaço compartilhado explícito.
6. **Dinheiro é sempre inteiro em centavos, em reais (BRL).**

## 4. Mapeamento caderno → sistema

| No caderno | No sistema |
|---|---|
| Página "Contas Setembro" escrita no início de outubro | Folha do mês de referência = setembro, com data de fechamento planejada no 5º dia útil de outubro |
| Bloco de cima (prévia, valores redondos) | Itens da folha com valor **previsto** (gerados por modelos recorrentes + faturas calculadas) |
| Bloco de baixo (valores reais, "V" de pago) | Mesmos itens com valor **real** e status pago |
| Coluna da esquerda (cartões, Caixa, condomínio, IPTU) | Itens de escopo **pessoal** |
| Coluna da direita (internet, energia, água, carro, casa) | Itens de escopo **família** |
| "Total minhas" / "Total casa" | Totais da folha pessoal e da folha da família |
| "Atrasado!" | Status `overdue` calculado pelo vencimento |
| "Total ganhos" (Pai, Juliano, Thais...) | Valores **a receber** por pessoa (empréstimos) |
| IPVA, licenciamento, IPTU, multas | Itens pontuais/anuais |
| "Tudo pago! Obrigado Deus!" | Estado "mês quitado" (mostrar de forma discreta e agradável) |

## 5. Funcionalidades do MVP

### 5.1 Login e família
- Login individual (Vinícius e Isabelle).
- Existe uma **Família** com os dois como membros. Cada um vê o que é seu e o que é da família.
- A família **não** é um usuário; é um espaço compartilhado. Cada conta, cartão, lançamento e item da folha tem escopo `personal` ou `household`.

### 5.2 Contas e cartões
- Contas/bancos (ex.: Mercado Pago, Nubank, Banco do Brasil) e dinheiro em espécie.
- Cartões de crédito (ex.: Nubank, Banco do Brasil, Evolua), cada um com **dia de fechamento** e **dia de vencimento**.
- Pertencem a um usuário (pessoal) ou à família.

### 5.3 Lançamento rápido de despesa
- Campos: descrição, valor, data (aceita retroativo), categoria, forma de pagamento, conta ou cartão de origem, número de parcelas (cartão), "de quem é" (opcional, para empréstimo).
- **Pix/dinheiro/débito:** é uma saída imediata.
- **Cartão de crédito:** não é saída imediata; gera parcela(s) dentro da fatura correta e aumenta a fatura calculada.

### 5.4 Folha do mês (o "Fechar mês")
- Uma folha por mês de referência, por escopo (uma pessoal para cada usuário e uma da família).
- Ao abrir a folha, o sistema gera:
  - itens a partir dos **modelos recorrentes** (água, luz, internet, casa, carro, condomínio, mensalidade da conta, etc.), com valor previsto sugerido pelo mês anterior;
  - um item por **fatura de cartão**, com o valor calculado;
  - espaço para itens pontuais (IPVA, licenciamento, IPTU, multas).
- No fechamento o usuário:
  - ajusta o **valor real** de cada item (inclusive da fatura, quando diferente do calculado);
  - marca pago/pendente (com valor pago e data);
  - vê o total, o quanto já foi pago e o quanto falta;
  - usa o **switch "incluir contas da família"**: soma à sua visão os itens da família que **ele** paga;
  - trava o mês ("fechar"). Itens não pagos podem ser levados para o mês seguinte.
- Cada item de fatura permite abrir o **histórico de lançamentos** que compõem o valor.

### 5.5 Empréstimos a terceiros
- Pessoas cadastradas (Pai, Tio, Sogra...).
- Um lançamento pode ter "de quem é": cobre tanto dinheiro emprestado (Pix, dinheiro) quanto uso do cartão (ex.: geladeira em 10x no cartão do Vinícius).
- Cada pessoa tem uma **conta corrente**: quanto já era devido (parcelas vencidas), quanto pagou, saldo.
- Quando a pessoa paga, o usuário registra o **recebimento** e escolhe em qual conta o dinheiro entrou.
- Na fatura, o sistema mostra quanto dela é de terceiros e se já foi recebido. Não existe pergunta "a fatura já foi paga?" no recebimento; são fatos independentes que o sistema cruza.
- Lançamento retroativo é possível, mas não é prioridade.

### 5.6 Reserva do casal
- Um "pote" da família para o dinheiro guardado. Aportes (inclusive a sobra que a Isabelle envia), retiradas e rendimentos registrados manualmente. Saldo = soma.
- Visível para os dois.

### 5.7 Saldo de contas (opcional dentro do MVP)
- Saldo **informado** manualmente por conta; lançamentos Pix/dinheiro posteriores descontam dele; pagamento de fatura desconta da conta escolhida; recebimentos somam.
- O usuário pode "ajustar saldo" a qualquer momento (conciliação simples).

## 6. Fora do escopo do MVP
- Conciliação bancária automática / Open Finance.
- Multi-moeda.
- Orçamento por categoria, metas e gráficos avançados (fase 2).
- Divisão percentual das contas da casa (o modelo é "quem paga", não rateio).
- Rendimento calculado automaticamente da reserva.
- Aplicativo nativo (será PWA).

## 7. Critérios de sucesso
- O mês é fechado sem o caderno em menos de 10 minutos.
- A diferença entre fatura calculada e real aparece claramente.
- Os dois usam no dia a dia e a Isabelle vê a visão da família.

## 8. Glossário (interface em português)

| Termo | Significado |
|---|---|
| Folha do mês | Página do mês de referência (equivale à página do caderno) |
| Mês de referência | O mês a que as contas se referem (as de setembro são pagas no início de outubro) |
| Fatura | Conjunto de compras de um cartão fechado em um mês |
| Valor calculado | Soma dos lançamentos/parcelas lançados no sistema |
| Valor real | Valor digitado pelo usuário conforme o banco |
| Não lançado | Real − calculado |
| Escopo | `personal` (do usuário) ou `household` (da família) |
| Pagador | Quem paga um item da família (normalmente Vinícius) |
| Reserva | Dinheiro guardado pelo casal |
