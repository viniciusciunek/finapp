/**
 * Identificador no formato UUID.
 *
 * Existe por causa de um caso chato de URL: `/contas/abc/editar`. Sem esta
 * checagem, o id malformado vai direto para o banco, que recusa o cast para
 * `uuid` e devolve **erro** — a tela mostraria "não foi possível carregar" para
 * um endereço que simplesmente não existe. Com ela, id torto é tratado como
 * "não encontrado", que é a verdade.
 *
 * Confere só o **formato** (8-4-4-4-12 dígitos hexadecimais), não a versão do
 * UUID: o Postgres aceita todas e aqui não há motivo para escolher.
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}
