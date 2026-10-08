# ROADMAP.md — Ordem de construção

> Construir em **fatias verticais**: cada fatia entrega algo que o Vinícius consegue usar de verdade (banco + regra + tela + teste). Não começar a próxima fatia sem a anterior "pronta quando" estar cumprida.
> Antes de cada fatia: ler `PRODUCT.md` e `DOMAIN.md`. Mudanças no schema só por migration.

## Fatia 0 — Fundação
- Projeto Next.js (App Router) + TypeScript + Tailwind + shadcn/ui.
- Supabase (Postgres, Auth) com migrations versionadas.
- Vitest configurado; pasta `src/domain/` para regras puras.
- PWA básico (manifest + ícones; instalável).
- **Pronta quando:** deploy no ar, login funciona, `npm test` roda.

## Fatia 1 — Login e família
- Cadastro/login por e-mail.
- Criar a família e convidar a Isabelle.
- Menu com alternância entre visão **pessoal** e **família**.
- RLS ativada nas tabelas existentes, com teste de isolamento.
- **Pronta quando:** Vinícius e Isabelle entram com logins diferentes; nenhum vê dados pessoais do outro; ambos veem a família.

## Fatia 2 — Contas e cartões
- CRUD de contas e cartões (pessoal ou família), com dia de fechamento e vencimento nos cartões.
- Cadastrar: Nubank, Banco do Brasil, Evolua (cartões); Mercado Pago, Nubank, Banco do Brasil (contas).
- **Pronta quando:** todos os cartões e contas reais estão cadastrados.

## Fatia 3 — Lançamento rápido (Pix/dinheiro)
- Formulário mobile-first de despesa; lista com filtro por mês; editar/excluir.
- Categorias básicas e criação de nova categoria no próprio formulário.
- **Pronta quando:** lançar "futebol, R$ 12, Pix, Mercado Pago" leva menos de 15 segundos.

## Fatia 4 — Cartão, parcelas e faturas
- Lançamento no crédito com número de parcelas.
- Funções puras `resolveStatementMonth` e `splitInstallments`, com todos os testes do `DOMAIN.md` §5.
- Criação automática de faturas; tela da fatura com calculado, real, "não lançado" e histórico.
- **Pronta quando:** uma compra parcelada aparece nas faturas dos meses certos e a soma das parcelas fecha com o total.

## Fatia 5 — Folha do mês (coração do produto)
- Modelos recorrentes (CRUD): água, luz, internet, casa, carro, condomínio, mensalidade da conta etc., com pagador para itens da família.
- Gerar a folha: itens recorrentes, itens de fatura, itens pontuais.
- Editar valor real, marcar pago/parcial, status calculado (inclui atrasado).
- Totais (total, pago, falta pagar) e switch "incluir contas da família".
- Fechar mês, levar itens para o próximo, reabrir.
- Data planejada de fechamento no 5º dia útil e aviso na tela inicial.
- **Pronta quando:** o Vinícius fecha o mês de setembro real, no sistema, sem usar o caderno.

## Fatia 6 — Empréstimos e terceiros
- CRUD de pessoas; campo "de quem é" no lançamento (cartão e dinheiro).
- Geração de `charge`s; conta corrente por pessoa (devido, pago, saldo, contratado).
- Registrar recebimento escolhendo a conta.
- Na fatura, mostrar a parcela de terceiros e se já foi recebida.
- **Pronta quando:** o caso da geladeira em 10x de R$ 300 no cartão do pai aparece corretamente mês a mês e o saldo dele bate com a realidade.

## Fatia 7 — Reserva do casal
- Pote da família com aportes, retiradas e rendimentos manuais; saldo visível para os dois.
- **Pronta quando:** a Isabelle lança a sobra do mês e ambos veem o saldo.

## Fatia 8 — Saldo de contas (opcional)
- Saldo informado por conta; Pix/dinheiro descontam; pagamento de fatura desconta; recebimento soma; ajuste de saldo.
- **Pronta quando:** o saldo no sistema bate com o app do banco após um mês de uso.

## Fatia 9 — Polimento
- Alertas de vencimento e de dia de fechar.
- Exportar CSV.
- Importar histórico do caderno (opcional, baixa prioridade).
- Revisão de acessibilidade e desempenho no celular.

## Fase 2 (depois do MVP)
- Orçamento por categoria e metas; gráficos e comparativo mês a mês.
- Provisão mensal para contas anuais (IPVA, IPTU, licenciamento).
- Feriados nacionais no cálculo de dia útil.
- Rendimento estimado da reserva.
