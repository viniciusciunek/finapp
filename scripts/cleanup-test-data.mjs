#!/usr/bin/env node
/**
 * Encontra e apaga contas de teste que tenham ido parar num projeto Supabase.
 *
 * ## Quando isso acontece
 *
 * Os testes automatizados só rodam contra bancos descartáveis, mas um comando
 * manual pode deixar resíduo: alguém aponta o app (ou o `test:rls`) para o
 * projeto de verdade e cria contas lá. Conta criada assim não sai sozinha —
 * apagar usuário exige a chave secreta, que os testes não usam.
 *
 * ## Segurança (leia antes de rodar)
 *
 * - **Sem `--delete` não apaga nada** — só lista o que encontrou.
 * - Só considera e-mails da lista `TEST_EMAILS` (abaixo). Qualquer outra conta
 *   é ignorada, inclusive parecidas.
 * - Mostra o alvo e quantos membros cada família tem **antes** de agir.
 * - Família que tenha alguém fora da lista de teste é **pulada**, não apagada:
 *   apagar levaria junto o vínculo de uma pessoa de verdade. O script explica
 *   e deixa a decisão para você (dá para resolver tudo pelo painel).
 * - Apaga as famílias antes das contas: `households.created_by` é
 *   `ON DELETE RESTRICT`, então o banco recusaria a ordem inversa.
 *
 * ## Uso
 *
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SECRET_KEY=sb_secret_... \
 *   npm run db:cleanup                 # só lista
 *
 *   ... npm run db:cleanup -- --delete # lista e apaga
 *
 * A chave secreta (Dashboard → Project Settings → API Keys) ignora o RLS.
 * Passe na linha de comando: vale só para aquela execução e não fica em lugar
 * nenhum — muito menos no repositório.
 */
import { createClient } from "@supabase/supabase-js";

/**
 * Contas que os testes e os roteiros manuais deste repositório criam.
 *
 * **Ao criar uma conta de teste nova, anote aqui.** É esta lista que faz a
 * limpeza encontrá-la depois. Os testes de isolamento usam `+a`, `+b` e `+c`
 * (a `+c` existe para provar que só membro da família pode ser pagador).
 */
const TEST_EMAILS = [
  "rls-teste+a@example.com",
  "rls-teste+b@example.com",
  "rls-teste+c@example.com",
  "teste.fase3@example.com",
  "teste.fase3.b@example.com",
];

const url = process.env.SUPABASE_URL?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
const shouldDelete = process.argv.includes("--delete");

if (!url || !secretKey) {
  console.error(
    [
      "",
      "Faltam as credenciais do alvo.",
      "",
      "  SUPABASE_URL         → Dashboard → Project Settings → Data API",
      "  SUPABASE_SECRET_KEY  → Dashboard → Project Settings → API Keys",
      "",
      "Exemplo:",
      "",
      "  SUPABASE_URL=https://<ref>.supabase.co \\",
      "  SUPABASE_SECRET_KEY=sb_secret_... \\",
      "  npm run db:cleanup",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

const supabase = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Todas as contas do projeto — a API de administração pagina de 100 em 100. */
async function listAllUsers() {
  const perPage = 100;
  const users = [];

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(`Não consegui listar as contas: ${error.message}`);
    }

    users.push(...data.users);

    if (data.users.length < perPage) {
      return users;
    }
  }
}

/** Famílias criadas por uma conta, com quem está nelas. */
async function householdsCreatedBy(userId) {
  const { data: households, error } = await supabase
    .from("households")
    .select("id, name")
    .eq("created_by", userId);

  if (error) {
    throw new Error(`Não consegui listar as famílias: ${error.message}`);
  }

  return Promise.all(
    (households ?? []).map(async (household) => {
      const { data: members, error: membersError } = await supabase
        .from("household_members")
        .select("user_id")
        .eq("household_id", household.id);

      if (membersError) {
        throw new Error(
          `Não consegui listar os membros da família: ${membersError.message}`,
        );
      }

      return { ...household, memberIds: (members ?? []).map((m) => m.user_id) };
    }),
  );
}

async function deleteHousehold(household) {
  const { error } = await supabase
    .from("households")
    .delete()
    .eq("id", household.id);

  return error ? error.message : null;
}

async function deleteUser(user) {
  const { error } = await supabase.auth.admin.deleteUser(user.id);

  return error ? error.message : null;
}

// ---------------------------------------------------------------------------

const targets = new Set(TEST_EMAILS.map((email) => email.toLowerCase()));

console.log(`\nAlvo: ${url}`);
console.log(`Modo: ${shouldDelete ? "APAGAR" : "somente listar"}\n`);

const testUsers = (await listAllUsers()).filter((user) =>
  targets.has((user.email ?? "").toLowerCase()),
);

if (testUsers.length === 0) {
  console.log(
    "Nenhuma conta da lista de teste existe nesse projeto. Nada a fazer.\n",
  );
  process.exit(0);
}

const testUserIds = new Set(testUsers.map((user) => user.id));
const owners = [];

for (const user of testUsers) {
  const households = await householdsCreatedBy(user.id);

  const owned = households.filter((h) =>
    h.memberIds.every((id) => testUserIds.has(id)),
  );
  const shared = households.filter((h) =>
    h.memberIds.some((id) => !testUserIds.has(id)),
  );

  owners.push({ user, owned, shared });
}

console.log("Encontrado:");
for (const { user, owned, shared } of owners) {
  console.log(`  conta   ${user.email}`);
  for (const household of owned) {
    console.log(`    família "${household.name}" — apagável`);
  }
  for (const household of shared) {
    console.log(
      `    família "${household.name}" — PULADA: ${household.memberIds.length} membro(s) e nem todos são de teste`,
    );
  }
}

if (!shouldDelete) {
  console.log(
    "\nNada foi apagado. Para apagar o que está marcado como apagável:\n" +
      "  npm run db:cleanup -- --delete\n",
  );
  process.exit(0);
}

console.log("");
let failures = 0;

for (const { owned } of owners) {
  for (const household of owned) {
    const error = await deleteHousehold(household);
    if (error) {
      failures += 1;
      console.error(`  ✗ família "${household.name}": ${error}`);
    } else {
      console.log(`  ✓ família "${household.name}" apagada`);
    }
  }
}

for (const { user, shared } of owners) {
  // Enquanto a conta continuar dona de uma família que foi pulada, o banco
  // recusa apagá-la (`households.created_by` é RESTRICT) — e é bom que recuse:
  // apagar levaria junto o vínculo de alguém de verdade.
  if (shared.length > 0) {
    console.log(
      `  – conta ${user.email} mantida: ainda é dona de família pulada`,
    );
    continue;
  }

  const error = await deleteUser(user);
  if (error) {
    failures += 1;
    console.error(`  ✗ conta ${user.email}: ${error}`);
  } else {
    console.log(`  ✓ conta ${user.email} apagada`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} falha(s) — nada foi escondido, veja acima.\n`);
  process.exit(1);
}

console.log("\nPronto. Confira em Authentication → Users.\n");
