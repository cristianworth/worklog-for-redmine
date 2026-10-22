import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Search } from "lucide-react";

interface Issue {
  id: number;
  subject: string;
  status: { id: number; name: string };
  project: { id: number; name: string };
}
export function IssueLookup({
  issue,
  label,
  disabled,
}: {
  issue: string;
  label: string;
  disabled: boolean;
}) {
  const code = issue.trim();
  const [result, setResult] = useState<{
    code: string;
    data?: Issue;
    error?: string;
  } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    setResult(null);
    setPending(null);
    return () => request.current?.abort();
  }, [code]);
  async function lookup() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setPending(code);
    setResult(null);
    try {
      const response = await fetch(
        `/api/redmine/issues/${encodeURIComponent(code)}`,
        { signal: controller.signal },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Não foi possível consultar a tarefa.");
      if (
        data.id !== Number(code) ||
        typeof data.subject !== "string" ||
        typeof data.status?.name !== "string" ||
        typeof data.project?.name !== "string"
      )
        throw new Error("Resposta inválida para a tarefa consultada.");
      if (!controller.signal.aborted) setResult({ code, data });
    } catch (error) {
      if (!controller.signal.aborted)
        setResult({
          code,
          error: error instanceof Error ? error.message : "Falha na consulta.",
        });
    } finally {
      if (!controller.signal.aborted) setPending(null);
    }
  }
  const current = result?.code === code ? result : null;
  const busy = pending === code;
  return (
    <div className="issue-lookup">
      <button
        className="text-button lookup-button"
        aria-label={`Consultar tarefa ${label}`}
        disabled={
          disabled ||
          busy ||
          !/^[1-9]\d*$/.test(code) ||
          !Number.isSafeInteger(Number(code))
        }
        onClick={lookup}
      >
        {busy ? (
          <LoaderCircle size={13} className="spin" />
        ) : (
          <Search size={13} />
        )}{" "}
        {busy ? "Consultando…" : "Consultar"}
      </button>
      {current?.error && (
        <small className="field-error" role="alert">
          {current.error}
        </small>
      )}
      {current?.data && (
        <div className="issue-result" role="status">
          <strong>{current.data.subject}</strong>
          <span>{current.data.status.name}</span>
          <small>{current.data.project.name}</small>
        </div>
      )}
    </div>
  );
}
