import Link from "next/link";

/**
 * "← Contas" — o caminho de volta das telas de conta e de cartão.
 *
 * Virou componente quando a quarta tela passou a precisar dele (criar e editar,
 * dos dois tipos): quatro cópias de um link que precisa levar ao mesmo lugar é
 * como se descobre, meses depois, que uma delas aponta para outro sítio.
 */
export function BackToAccountsLink() {
  return (
    <Link
      href="/contas"
      className="text-muted-foreground hover:text-foreground text-sm"
    >
      ← Contas
    </Link>
  );
}
