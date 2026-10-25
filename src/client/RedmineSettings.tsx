import { useEffect, useState } from "react";
import { LoaderCircle, PlugZap, X } from "lucide-react";
import { useWorklogData } from "./WorklogDataProvider";
import type { ConnectionStatus } from "./data-access";

export function RedmineSettings({ onClose }: { onClose(): void }) {
  const data = useWorklogData();
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    data.readConnectionStatus(controller.signal)
      .then((loaded) => {
        if (!controller.signal.aborted) setStatus(loaded);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            "Não foi possível consultar a configuração local. Confira se o servidor foi reiniciado após a atualização.",
          );
      });
    return () => controller.abort();
  }, [data]);
  async function check() {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await data.checkConnection();
      setMessage(
        data.mode === "demo"
          ? "Simulação isolada disponível. Nenhuma conexão externa foi feita."
          : "Acesso à API confirmado. Você já pode consultar tarefas; nenhuma hora foi enviada.",
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Falha ao testar acesso.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="settings-panel" aria-labelledby="settings-title">
      <div className="settings-heading">
        <h2 id="settings-title">Acesso ao Redmine</h2>
        <button
          className="icon-button"
          aria-label="Fechar configurações"
          onClick={onClose}
          disabled={busy}
        >
          <X size={18} />
        </button>
      </div>
      {data.mode === "demo" ? <p>Simulação isolada, sem endereço, chave ou conexão com o Redmine.</p> : <>
      <p>
        Conexão para consultar tarefas e enviar horas após revisão e
        confirmação. Salvar rascunhos continua independente do Redmine.
      </p>
      <p className="connection-status">
        {status
          ? status.configured
            ? `Endereço configurado · ${status.hasApiKey ? "chave de API configurada" : "sem chave de API"}`
            : "Acesso ainda não configurado"
          : "Conferindo configuração…"}
      </p>
      {status?.certificateException && (
        <p className="certificate-warning" role="status">
          Exceção de certificado ativa para este Redmine. A conexão permanece
          criptografada, mas a identidade do servidor não é validada pelo
          certificado.
        </p>
      )}
      <ol>
        <li>
          {status?.configured ? (
            <>
              Abra o arquivo <code>.env</code> existente na pasta da aplicação e
              preserve o endereço já configurado.
            </>
          ) : (
            <>
              Se ainda não existir <code>.env</code>, copie{" "}
              <code>.env.example</code> para esse nome na pasta da aplicação.
            </>
          )}
        </li>
        <li>
          Preencha <code>REDMINE_URL</code> com o endereço HTTPS. Se necessário,
          obtenha sua chave em Minha conta no Redmine e preencha{" "}
          <code>REDMINE_API_KEY</code>.
        </li>
        <li>
          Salve seus rascunhos, reinicie a aplicação e use o teste abaixo.
        </li>
      </ol>
      <p className="settings-note">
        A configuração fica somente neste computador. Não cole senhas ou chaves
        no chat. O login do navegador não conecta automaticamente a aplicação. A
        validação de certificado é o padrão. Em um servidor conhecido com
        certificado inválido, a exceção é configurada localmente e indicada
        acima quando ativa.
      </p>
      </>}
      <button
        className="button secondary"
        onClick={check}
        disabled={busy || !status}
      >
        <>
          {busy ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <PlugZap size={16} />
          )}
        </>
        {busy ? "Testando acesso…" : data.mode === "demo" ? "Conferir simulação" : "Testar acesso à API"}
      </button>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="connection-success" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
