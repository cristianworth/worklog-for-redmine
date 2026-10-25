import { useState } from "react";
import { RotateCcw } from "lucide-react";
import type { DemoSession } from "./data-access";

export function DemoControls({ session, onRestored }: {
  session: DemoSession;
  onRestored(): void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
      <strong>Experimente com dados fictícios</strong>
      <p>Edite um dos três dias de exemplo ou crie o dia de hoje com o modelo. Tarefas: 9001, 9004 e 9007. Salvar continua separado de enviar; os envios simulados ainda estão em preparação.</p>
      <p>{session.persistent
        ? "Salvar guarda os dados somente neste navegador. Recarregar recupera o que foi salvo."
        : "Os dados desta página são temporários; confira o aviso de armazenamento abaixo."}</p>
      {session.notice && <p className="field-error" role="alert">{session.notice}</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
    {confirming ? <div className="demo-restore-confirmation">
      <p>Restaurar descarta os dados e as edições abertas da demo e volta aos exemplos iniciais com datas atuais. Não altera outros dados do navegador nem o modo local.</p>
      <div className="demo-restore-actions">
        <button className="button quiet" disabled={busy} onClick={() => setConfirming(false)}>Cancelar restauração</button>
        <button className="button secondary" disabled={busy} onClick={() => void restore()}>Confirmar restauração</button>
      </div>
    </div> : <button className="button secondary" onClick={() => setConfirming(true)}>
      <RotateCcw size={16} aria-hidden="true" /> Restaurar exemplos
    </button>}
  </section>;
}
