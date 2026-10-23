import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import * as repository from "../lib/repository";
import type { Book, EntryInput, Plan } from "../lib/book";

const emptyBook: Book = { transactions: [], plans: [] };

export function useLedger() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const owner = user?.id ?? "demo";
  const [loaded, setLoaded] = useState<{ owner: string; book: Book } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const url = new URL(window.location.href);
    if (
      url.searchParams.has("error_description") ||
      new URLSearchParams(url.hash.slice(1)).has("error_description")
    ) {
      setError("Google 로그인이 완료되지 않았어요. 다시 시도해주세요.");
      history.replaceState(null, "", import.meta.env.BASE_URL);
    }
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!alive) return;
        setUser(session?.user ?? null);
        setAuthReady(true);
        if (
          session &&
          (window.location.pathname.replace(/\/$/, "") ===
            `${import.meta.env.BASE_URL}auth/callback` ||
            url.searchParams.has("code"))
        )
          history.replaceState(null, "", import.meta.env.BASE_URL);
      },
    );
    void supabase.auth
      .getSession()
      .then(({ data, error: authError }) => {
        if (!alive) return;
        if (authError) {
          setError("로그인 정보를 확인하지 못했어요. 다시 로그인해주세요.");
          history.replaceState(null, "", import.meta.env.BASE_URL);
        }
        setUser(data.session?.user ?? null);
        setAuthReady(true);
      })
      .catch(() => {
        if (alive) {
          setError("로그인을 확인하지 못했어요. 연결 상태를 확인해주세요.");
          setAuthReady(true);
        }
      });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;
    let alive = true;
    setLoading(true);
    setLoaded(null);
    repository
      .loadBook(user?.id)
      .then((book) => {
        if (alive) {
          setLoaded({ owner, book });
          setLoading(false);
        }
      })
      .catch((error) => {
        if (alive) {
          setError(repository.friendlyError(error));
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [authReady, owner, user?.id, revision]);

  // Never render data belonging to the previous account, even for one frame.
  const book = loaded?.owner === owner ? loaded.book : emptyBook;
  const ready = authReady && !loading && loaded?.owner === owner;
  const updateBook = (transform: (book: Book) => Book) =>
    setLoaded((previous) =>
      previous?.owner === owner
        ? { owner, book: transform(previous.book) }
        : previous,
    );

  return {
    user,
    book,
    ready,
    loading: !authReady || loading,
    error,
    setError,
    refresh: () => {
      setError("");
      setRevision((value) => value + 1);
    },
    async saveEntry(input: EntryInput, id?: string) {
      if (!ready) throw new Error("가계부를 불러온 뒤 다시 시도해주세요.");
      const saved = await repository.saveEntry(input, id, user?.id);
      updateBook((book) => ({
        ...book,
        transactions: [
          saved,
          ...book.transactions.filter((entry) => entry.id !== saved.id),
        ],
      }));
    },
    async deleteEntry(id: string) {
      if (!ready) throw new Error("가계부를 불러온 뒤 다시 시도해주세요.");
      await repository.deleteEntry(id, user?.id);
      updateBook((book) => ({
        ...book,
        transactions: book.transactions.filter((entry) => entry.id !== id),
      }));
    },
    async savePlan(plan: Plan) {
      if (!ready) throw new Error("가계부를 불러온 뒤 다시 시도해주세요.");
      await repository.savePlan(plan, user?.id);
      updateBook((book) => ({
        ...book,
        plans: [plan, ...book.plans.filter((old) => old.month !== plan.month)],
      }));
    },
    async signOut() {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
      setLoaded(null);
      setUser(null);
    },
  };
}
