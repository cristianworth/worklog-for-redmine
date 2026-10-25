import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import type { DemoSession } from "./data-access";

export function DemoControls({ session, onRestored }: {
  session: DemoSession;
  onRestored(): void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);
  useEffect(() => {
    if (confirming) cancel.current?.focus();
    else if (wasConfirming.current) trigger.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);
  async function restore() {
    setBusy(true);
    setError("");
    try {
      await session.restoreExamples();
      onRestored();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível restaurar os exemplos.");
      setBusy(false);
    }
  }
  return <section className="demo-controls" aria-label="Exemplos e dados da demonstração">
    <div>
      <strong>Vários dias de horas, um fluxo organizado</strong>
      <p>Recomponha seus apontamentos, confira os totais e revise o envio sem depender de uma planilha. Experimente em poucos minutos com exemplos fictícios.</p>
      <ol className="demo-steps">
        <li>Edite um dia ou crie o dia de hoje com o modelo. Tarefas disponíveis: 9001, 9004 e 9007.</li>
        <li>Use <strong>Salvar rascunhos</strong> para guardar as alterações.</li>
        <li>Selecione uma linha, um dia ou várias datas e confirme a <strong>simulação</strong>. Confira os recibos e restaure os exemplos quando quiser.</li>
      </ol>
      <p>{session.persistent
        ? "Salvar guarda os dados somente neste navegador. Recarregar recupera o que foi salvo."
        : "Os dados desta página são temporários; confira o aviso de armazenamento abaixo."}</p>
      {session.notice && <p className="field-error" role="alert">{session.notice}</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
    {confirming ? <div className="demo-restore-confirmation">
      <p>Restaurar descarta os dados e as edições abertas da demo e volta aos exemplos iniciais com datas atuais. Não altera outros dados do navegador nem o modo local.</p>
      <div className="demo-restore-actions">
        <button ref={cancel} className="button quiet" disabled={busy} onClick={() => setConfirming(false)}>Cancelar restauração</button>
        <button className="button secondary" disabled={busy} onClick={() => void restore()}>Confirmar restauração</button>
      </div>
    </div> : <button ref={trigger} className="button secondary" onClick={() => setConfirming(true)}>
      <RotateCcw size={16} aria-hidden="true" /> Restaurar exemplos
    </button>}
  </section>;
}
