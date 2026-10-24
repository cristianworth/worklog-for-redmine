import { useEffect, useState } from "react";
import { LoaderCircle, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import {
  validateActivityCatalog,
  type ActivityCatalog,
} from "../shared/activities";

interface Row {
  key: string;
  activityId: string;
  name: string;
}
const rowsFrom = (catalog: ActivityCatalog): Row[] =>
  catalog.activities.map((activity) => ({
    key: crypto.randomUUID(),
    activityId: String(activity.activityId),
    name: activity.name,
  }));
export function ActivityCatalogEditor({
  catalog,
  loadError,
  onSaved,
  onDirtyChange,
  onReload,
}: {
  catalog: ActivityCatalog | null;
  loadError: string;
  onSaved(catalog: ActivityCatalog): void;
  onDirtyChange(dirty: boolean): void;
  onReload(): void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [revision, setRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (catalog && !dirty) {
      setRows(rowsFrom(catalog));
      setRevision(catalog.revision);
    }
  }, [catalog, dirty]);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  function update(
    key: string,
    field: Exclude<keyof Row, "key">,
    value: string,
  ) {
    setRows((current) =>
      current.map((row) =>
        row.key === key ? { ...row, [field]: value } : row,
      ),
    );
    setDirty(true);
    setError("");
    setMessage("");
  }
  function discard() {
    if (catalog) {
      setRows(rowsFrom(catalog));
      setRevision(catalog.revision);
    }
    setDirty(false);
    setError("");
    setMessage("");
  }
  async function save() {
    if (!dirty || busy || !catalog) return;
    let payload: ActivityCatalog;
    try {
      if (rows.some((row) => !/^\d+$/.test(row.activityId)))
        throw new Error("Use códigos inteiros positivos para as atividades.");
      payload = validateActivityCatalog({
        revision,
        activities: rows.map(({ activityId, name }) => ({
          activityId: Number(activityId),
          name,
        })),
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Catálogo inválido.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/activities", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Não foi possível salvar o catálogo.");
      const saved = validateActivityCatalog(data);
      if (
        saved.revision !== revision + 1 ||
        JSON.stringify(saved.activities) !== JSON.stringify(payload.activities)
      )
        throw new Error(
          "Não foi possível confirmar o salvamento do catálogo. Preserve suas edições e recarregue o catálogo antes de tentar novamente.",
        );
      onSaved(saved);
      setRows(rowsFrom(saved));
      setRevision(saved.revision);
      setDirty(false);
      setMessage(
        "Catálogo salvo neste computador. Nenhum dado foi enviado ao Redmine.",
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Falha ao salvar catálogo.",
      );
    } finally {
      setBusy(false);
    }
  }
  const blocked = busy || !catalog;
  return (
    <section
      className="settings-panel catalog-panel"
      aria-labelledby="catalog-title"
    >
      <div className="settings-heading">
        <h2 id="catalog-title">Atividades</h2>
        <span className="catalog-state">
          {dirty
            ? "Alterações não salvas"
            : catalog
              ? `${catalog.activities.length} atividades salvas`
              : loadError
                ? "Catálogo indisponível"
                : "Carregando catálogo…"}
        </span>
      </div>
      <p>
        Cadastre cada atividade uma única vez, com o nome e o código usados no
        Redmine. A lista é compartilhada pelos dias e pelo modelo.
      </p>
      <p className="settings-note">
        Você pode escolher a atividade antes de informar a tarefa. Os códigos
        devem ser conferidos no Redmine; nenhuma atividade vem cadastrada por
        padrão.
      </p>
      {(loadError || error) && (
        <p className="field-error" role="alert">
          {error || loadError}
        </p>
      )}
      {catalog && (
        <div className="table-scroll">
          <table className="catalog-table">
            <thead>
              <tr>
                <th>Atividade (ID)</th>
                <th>Nome da atividade</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.key}>
                  <td>
                    <input
                      aria-label={`Código da atividade ${index + 1}`}
                      inputMode="numeric"
                      placeholder="Ex.: 101"
                      value={row.activityId}
                      disabled={blocked}
                      onChange={(event) =>
                        update(row.key, "activityId", event.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Nome da atividade ${index + 1}`}
                      placeholder="Nome no Redmine"
                      value={row.name}
                      disabled={blocked}
                      onChange={(event) =>
                        update(row.key, "name", event.target.value)
                      }
                    />
                  </td>
                  <td>
                    <button
                      className="icon-button remove-button"
                      aria-label={`Remover atividade ${index + 1}`}
                      title="Remover do catálogo local"
                      disabled={blocked}
                      onClick={() => {
                        setRows((current) =>
                          current.filter((item) => item.key !== row.key),
                        );
                        setDirty(true);
                        setError("");
                        setMessage("");
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <p className="catalog-empty">
              Seu catálogo está vazio. Adicione a primeira atividade.
            </p>
          )}
        </div>
      )}
      <div className="catalog-actions">
        <button
          className="button secondary"
          disabled={blocked}
          onClick={() => {
            setRows((current) => [
              ...current,
              {
                key: crypto.randomUUID(),
                activityId: "",
                name: "",
              },
            ]);
            setDirty(true);
            setMessage("");
            setError("");
          }}
        >
          <Plus size={16} />
          Adicionar atividade
        </button>
        <button
          className="button secondary"
          disabled={blocked || !dirty}
          onClick={save}
        >
          {busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Save size={16} />
          )}
          Salvar catálogo
        </button>
        <button
          className="button quiet"
          disabled={busy || !dirty}
          onClick={discard}
        >
          Descartar alterações
        </button>
        <button
          className="button quiet"
          disabled={busy || dirty}
          onClick={onReload}
        >
          <RotateCcw size={15} />
          Recarregar catálogo
        </button>
      </div>
      {message && (
        <p className="connection-success" role="status">
          {message}
        </p>
      )}
      <p className="settings-note">
        Salvar catálogo e salvar rascunhos são ações independentes. Renomear ou
        remover uma atividade não reescreve apontamentos existentes. Fechar
        Configurações preserva suas edições do catálogo nesta tela.
      </p>
    </section>
  );
}
