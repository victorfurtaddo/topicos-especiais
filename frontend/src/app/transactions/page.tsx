"use client";

import { useEffect, useState } from "react";
import { NumericFormat } from "react-number-format";
import { motion, useReducedMotion } from "framer-motion";
import { PageReveal } from "@/components/page-reveal";
import { SmoothListHeight } from "@/components/smooth-list-height";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { IconCheck, IconDots, IconLoader2, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { AppAlert } from "@/components/app-alert";
import { DatePicker } from "@/components/date-picker";
import { CategoryBadge, categoryColor } from "@/components/category-badge";
import { AppSelect } from "@/components/app-select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const categories = [
  "Alimentação",
  "Moradia",
  "Transporte",
  "Saúde",
  "Educação",
  "Lazer",
  "Compras",
  "Assinaturas",
  "Salário",
  "Freelance",
  "Outros",
];
const payments: Record<string, string> = {
  pix: "Pix",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  cash: "Dinheiro",
  transfer: "Transferência",
};
type Transaction = {
  _id: string;
  description: string;
  amount: string;
  type: string;
  category: string;
  date: string;
  payment_method: string;
  installments: number;
  is_recurring: boolean;
  merchant: { name: string; city: string };
  tags: string[];
  notes: string;
};
type Form = Omit<Transaction, "_id" | "tags" | "merchant"> & {
  tags: string;
  merchant_name: string;
  merchant_city: string;
};
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const blank = (): Form => ({
  description: "",
  amount: "",
  type: "expense",
  category: "Alimentação",
  date: today(),
  payment_method: "pix",
  installments: 1,
  is_recurring: false,
  tags: "",
  merchant_name: "",
  merchant_city: "",
  notes: "",
});
const money = (value: string) =>
  Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateBR = (value: string) =>
  value.slice(0, 10).split("-").reverse().join("/");
const categoryOptions = categories.map((category) => ({
  value: category,
  label: category,
  color: categoryColor(category),
}));
const transactionTypes = [
  { value: "income", label: "Receita", color: "var(--income-color)" },
  { value: "expense", label: "Despesa", color: "var(--expense-color)" },
];
const paymentOptions = Object.entries(payments).map(([value, label]) => ({
  value,
  label,
}));
const emptyFilters = { q: "", start: "", end: "", category: "", type: "" };

export default function Transactions() {
  const reduced = useReducedMotion();
  const [rows, setRows] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(emptyFilters);
  const [searchText, setSearchText] = useState("");
  const [revision, setRevision] = useState(0);
  const [form, setForm] = useState<Form>(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [remove, setRemove] = useState<Transaction | null>(null);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [resolvedRequest, setResolvedRequest] = useState("");
  const [busy, setBusy] = useState(false);
  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
  const hasFilters = params.size > 0;
  params.set("page", String(page));
  const requestUrl = `/api/transactions?${params.toString()}`;
  const requestKey = `${revision}:${requestUrl}`;
  const loading = requestKey !== resolvedRequest;

  useEffect(() => {
    const query = searchText.trim();
    if (query === filters.q) return;
    const timer = window.setTimeout(() => {
      setFilters((current) => ({ ...current, q: query }));
      setPage(1);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [searchText, filters.q]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const res = await fetch(requestUrl, { cache: "no-store", signal: controller.signal });
        const data = await res.json();
        if (controller.signal.aborted) return;
        if (!res.ok) throw new Error(data.error || "Não foi possível carregar as transações.");
        setRows(data.items);
        setTotal(data.total);
        setListError("");
      } catch (e) {
        if (controller.signal.aborted) return;
        setRows([]);
        setTotal(0);
        setListError(e instanceof Error ? e.message : "Erro de conexão.");
      } finally {
        if (!controller.signal.aborted) setResolvedRequest(requestKey);
      }
    }
    void load();
    return () => controller.abort();
  }, [requestKey, requestUrl]);

  function updateFilter(filter: keyof typeof emptyFilters, value: string) {
    setFilters((current) => ({ ...current, [filter]: value }));
    setPage(1);
  }
  async function mutation(url: string, method: string, body?: unknown) {
    const tokenResponse = await fetch("/api/csrf", { cache: "no-store" });
    if (!tokenResponse.ok)
      throw new Error("Não foi possível iniciar a sessão.");
    const { csrf_token } = await tokenResponse.json();
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrf_token,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Não foi possível salvar.");
    }
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { merchant_name, merchant_city, tags, ...rest } = form;
      await mutation(
        editing ? `/api/transactions/${editing}` : "/api/transactions",
        editing ? "PUT" : "POST",
        {
          ...rest,
          installments: Number(rest.installments),
          tags: tags
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
          merchant: { name: merchant_name, city: merchant_city },
        },
      );
      setOpen(false);
      setRevision((value) => value + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro de conexão.");
    } finally {
      setBusy(false);
    }
  }
  async function deleteRow() {
    if (!remove) return;
    setBusy(true);
    setError("");
    try {
      await mutation(`/api/transactions/${remove._id}?confirm=yes`, "DELETE");
      setRemove(null);
      if (rows.length === 1 && page > 1) setPage(page - 1);
      setRevision((value) => value + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro de conexão.");
    } finally {
      setBusy(false);
    }
  }
  function edit(row: Transaction) {
    setEditing(row._id);
    setForm({
      ...row,
      date: row.date.slice(0, 10),
      tags: row.tags.join(", "),
      merchant_name: row.merchant.name,
      merchant_city: row.merchant.city,
    });
    setError("");
    setOpen(true);
  }
  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  const pages = Math.max(1, Math.ceil(total / 20));
  return (
    <PageReveal>
      <div className="heading">
        <div>
          <h1>Transações</h1>
          <p>Consulte e altere seus lançamentos.</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setForm(blank());
            setError("");
            setOpen(true);
          }}
        >
          <IconPlus /> Nova transação
        </Button>
      </div>
      {error && !open && !remove && <AppAlert error>{error}</AppAlert>}
      <Card>
        <CardContent>
          <div className="filters" role="group" aria-label="Filtros de transações">
            <label>
              Pesquisar
              <Input
                placeholder="Buscar pela descrição"
                maxLength={100}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </label>
            <DatePicker
              label="De"
              value={filters.start}
              onChange={(start) => updateFilter("start", start)}
              allowClear
            />
            <DatePicker
              label="Até"
              value={filters.end}
              onChange={(end) => updateFilter("end", end)}
              allowClear
            />
            <AppSelect
              id="filter-category"
              label="Categoria"
              value={filters.category || "all"}
              onValueChange={(value) =>
                updateFilter("category", value === "all" ? "" : value)
              }
              options={[{ value: "all", label: "Todas" }, ...categoryOptions]}
            />
            <AppSelect
              id="filter-type"
              label="Tipo"
              value={filters.type || "all"}
              onValueChange={(value) =>
                updateFilter("type", value === "all" ? "" : value)
              }
              options={[{ value: "all", label: "Todos" }, ...transactionTypes]}
            />
            {hasFilters && (
              <div className="filter-actions">
                <Button
                  type="button"
                  variant="destructive"
                  data-variant="destructive"
                  onClick={() => {
                    setSearchText("");
                    setFilters(emptyFilters);
                    setPage(1);
                  }}
                >
                  Limpar
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="history-head">
          <CardTitle>Seu histórico</CardTitle>
          <span role="status">{loading ? "Carregando…" : `${total} registros encontrados`}</span>
        </CardHeader>
        <CardContent>
          <SmoothListHeight>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row._id}>
                    <TableCell className="font-medium">
                      {row.description}
                    </TableCell>
                    <TableCell>
                      <CategoryBadge category={row.category} />
                    </TableCell>
                    <TableCell>{dateBR(row.date)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="transaction-type-badge" data-kind={row.type}>
                        {row.type === "income" ? "Receita" : "Despesa"}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={row.type === "income" ? "income" : "expense"}
                    >
                      {row.type === "income" ? "+ " : "− "}
                      {money(row.amount)}
                    </TableCell>
                    <TableCell className="actions">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Ações para ${row.description}`}
                            />
                          }
                        >
                          <IconDots />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => edit(row)}>
                            <IconPencil />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => {
                              setError("");
                              setRemove(row);
                            }}
                          >
                            <IconTrash />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!loading && (listError
              ? <div className="px-(--card-spacing) py-3"><AppAlert error>{listError}</AppAlert></div>
              : rows.length === 0 && <p className="empty">Nenhuma transação encontrada.</p>)}
          </SmoothListHeight>
          <div className="pagination">
            <span>
              Página {page} de {pages}
            </span>
            <div>
              <Button
                variant="outline"
                disabled={page <= 1 || loading}
                onClick={() => setPage(page - 1)}
              >
                Anterior
              </Button>{" "}
              <Button
                variant="outline"
                disabled={page >= pages || loading}
                onClick={() => setPage(page + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="form-dialog">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar transação" : "Nova transação"}
            </DialogTitle>
            <DialogDescription>
              Informe os dados do lançamento.
            </DialogDescription>
          </DialogHeader>
          <motion.form
            onSubmit={save}
            className="transaction-dialog-form"
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.28, ease: "easeOut" }}
          >
            <div className="transaction-dialog-body form-grid scroll-thin">
              {error && (
                <div className="full">
                  <AppAlert error>{error}</AppAlert>
                </div>
              )}
              <label className="full">
                <span>Descrição *</span>
                <Input
                  required
                  maxLength={160}
                  placeholder="Ex.: Compras do mês"
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                />
              </label>
              <label>
                <span>Valor (R$) *</span>
                <NumericFormat
                  customInput={Input}
                  inputMode="decimal"
                  value={form.amount}
                  valueIsNumericString
                  thousandSeparator="."
                  decimalSeparator=","
                  decimalScale={2}
                  fixedDecimalScale
                  allowNegative={false}
                  isAllowed={({ floatValue }) =>
                    floatValue === undefined || floatValue <= 999999999.99
                  }
                  placeholder="250,00"
                  required
                  pattern="[0-9.,]*[1-9][0-9.,]*"
                  title="Informe um valor de pelo menos R$ 0,01."
                  disabled={busy}
                  onValueChange={({ value }, { source }) => {
                    if (source === "event") update("amount", value);
                  }}
                />
              </label>
              <AppSelect
                id="transaction-type"
                label="Tipo *"
                value={form.type}
                onValueChange={(value) => update("type", value)}
                options={transactionTypes}
              />
              <AppSelect
                id="transaction-category"
                label="Categoria *"
                value={form.category}
                onValueChange={(value) => update("category", value)}
                options={categoryOptions}
              />
              <DatePicker label="Data *" value={form.date} onChange={(date) => update("date", date)} />
              <AppSelect
                id="transaction-payment"
                label="Pagamento"
                value={form.payment_method}
                onValueChange={(value) => update("payment_method", value)}
                options={paymentOptions}
              />
              <label>
                <span>Parcelas</span>
                <Input
                  type="number"
                  required
                  min="1"
                  max="60"
                  placeholder="Ex.: 1"
                  value={form.installments}
                  onChange={(e) => update("installments", Number(e.target.value))}
                />
              </label>
              <p className="help full">
                O valor entra integralmente na data escolhida; parcelas são
                informativas.
              </p>
              <label>
                <span>Estabelecimento</span>
                <Input
                  maxLength={100}
                  placeholder="Ex.: Supermercado Central"
                  value={form.merchant_name}
                  onChange={(e) => update("merchant_name", e.target.value)}
                />
              </label>
              <label>
                <span>Cidade</span>
                <Input
                  maxLength={80}
                  placeholder="Ex.: São Paulo"
                  value={form.merchant_city}
                  onChange={(e) => update("merchant_city", e.target.value)}
                />
              </label>
              <label className="full">
                <span>Tags</span>
                <Input
                  placeholder="Ex.: mercado, casa"
                  value={form.tags}
                  onChange={(e) => update("tags", e.target.value)}
                />
              </label>
              <label className="full">
                <span>Observações</span>
                <Textarea
                  maxLength={1000}
                  placeholder="Ex.: Compra da semana"
                  value={form.notes}
                  onChange={(e) => update("notes", e.target.value)}
                />
              </label>
              <label className="full check">
                <Checkbox
                  checked={form.is_recurring}
                  onCheckedChange={(checked) => update("is_recurring", checked)}
                />{" "}
                Esta é uma transação recorrente
              </label>
              <p className="help full">
                A recorrência é informativa e não cria novos lançamentos.
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? <IconLoader2 aria-hidden className="motion-safe:animate-spin" /> : <IconCheck aria-hidden />}
                {busy ? "Salvando..." : "Salvar transação"}
              </Button>
            </DialogFooter>
          </motion.form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!remove}
        onOpenChange={(value) => {
          if (!value) setRemove(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir transação?</DialogTitle>
            <DialogDescription>
              Esta ação excluirá “{remove?.description}” permanentemente.
            </DialogDescription>
          </DialogHeader>
          {error && <AppAlert error>{error}</AppAlert>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemove(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={busy} onClick={deleteRow}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageReveal>
  );
}
