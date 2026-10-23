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
  automaticRequest,
  label,
  disabled,
  onProject,
}: {
  issue: string;
  automaticRequest?: { code: string };
  label: string;
  disabled: boolean;
  onProject(projectId: number | undefined): void;
}) {
  const code = issue.trim();
  const [result, setResult] = useState<{
    code: string;
    data?: Issue;
    error?: string;
  } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const latestCode = useRef(code);
  latestCode.current = code;
  const projectCallback = useRef(onProject);
  projectCallback.current = onProject;
  useEffect(() => {
    setResult(null);
    setPending(null);
    return () => request.current?.abort();
  }, [code]);
  useEffect(() => {
    if (automaticRequest?.code === code) void lookup();
  }, [automaticRequest, code]);
  async function lookup(refresh = false) {
    if (disabled || !code || (!refresh && pending === code)) return;
    if (!/^[1-9]\d*$/.test(code) || !Number.isSafeInteger(Number(code))) {
      setResult({
        code,
        error: "Informe um código de tarefa inteiro e positivo.",
      });
      return;
    }
    request.current?.abort();
    projectCallback.current(undefined);
    const controller = new AbortController();
    request.current = controller;
    setPending(code);
    setResult(null);
    const isCurrent = () =>
      !controller.signal.aborted &&
      latestCode.current === code &&
      request.current === controller;
    try {
      const response = await fetch(
        `/api/redmine/issues/${encodeURIComponent(code)}${refresh ? "?refresh=1" : ""}`,
        { signal: controller.signal },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Não foi possível consultar a tarefa.");
      if (
        data.id !== Number(code) ||
        typeof data.subject !== "string" ||
        typeof data.status?.name !== "string" ||
        typeof data.project?.name !== "string" ||
        !Number.isSafeInteger(data.project.id) ||
        data.project.id <= 0
      )
        throw new Error("Resposta inválida para a tarefa consultada.");
      if (isCurrent()) {
        setResult({ code, data });
        projectCallback.current(data.project.id);
      }
    } catch (error) {
      if (isCurrent())
        setResult({
          code,
          error: error instanceof Error ? error.message : "Falha na consulta.",
        });
    } finally {
      if (isCurrent()) setPending(null);
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
        onClick={() => void lookup(true)}
      >
        {busy ? (
          <LoaderCircle size={13} className="spin" />
        ) : (
          <Search size={13} />
        )}{" "}
        {busy
          ? "Consultando…"
          : current?.data
            ? "Atualizar tarefa"
            : "Consultar"}
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
          <small>
            {current.data.project.name} · Projeto #{current.data.project.id}
          </small>
        </div>
      )}
    </div>
  );
}
