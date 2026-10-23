import { RedmineError, type RedmineClient } from "./redmine";

// Each instance belongs to one configured client. Nothing is persisted or shared across accounts.
export function createIssueLookup(redmine: RedmineClient) {
  type Issue = Awaited<ReturnType<RedmineClient["issue"]>>;
  const cache = new Map<string, { expiresAt: number; result: Promise<Issue> }>();
  return function lookup(code: string, refresh = false): Promise<Issue> {
    if (!/^[1-9]\d*$/.test(code) || !Number.isSafeInteger(Number(code)))
      return Promise.reject(
        new RedmineError(
          "invalid_issue",
          "Informe um código de tarefa inteiro e positivo.",
          400,
        ),
      );
    const previous = cache.get(code);
    if (!refresh && previous && previous.expiresAt > Date.now()) {
      cache.delete(code);
      cache.set(code, previous);
      return previous.result;
    }
    const value = {
      expiresAt: Date.now() + 10 * 60 * 1000,
      result: null! as Promise<Issue>,
    };
    value.result = redmine.issue(code)
      .then((issue) => {
        value.expiresAt = Date.now() + 10 * 60 * 1000;
        return issue;
      })
      .catch((error) => {
        if (cache.get(code) === value) cache.delete(code);
        throw error;
      });
    cache.delete(code);
    cache.set(code, value);
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    return value.result;
  };
}
