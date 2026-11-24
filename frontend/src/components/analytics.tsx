"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DatePicker } from "@/components/date-picker";
import { CategoryBadge, categoryColor } from "@/components/category-badge";
import { IconArrowRight, IconArrowUpRight, IconChevronRight } from "@tabler/icons-react";
import { AppAlert } from "@/components/app-alert";
import { AppSelect } from "@/components/app-select";
import { CategoryChart, Evolution } from "@/components/dashboard-charts";
import { PageReveal } from "@/components/page-reveal";
import { SmoothListHeight } from "@/components/smooth-list-height";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Amount = string | number;
type Category = {
  category: string;
  total: Amount;
  percentage: Amount;
  count: number;
};
type DashboardData = {
  month: string;
  income: Amount;
  expense: Amount;
  balance: Amount;
  saving_rate: Amount | null;
  expense_change: Amount | null;
  previous: { income: Amount; expense: Amount };
  categories: Category[];
  chart: { labels: string[]; income: number[]; expense: number[] };
};
type InsightData = {
  month: string;
  changes: {
    category: string;
    previous: Amount;
    current: Amount;
    change: Amount | null;
  }[];
  opportunities: { category: string; total: Amount; saving: Amount }[];
  concentrations: Category[];
  outliers: {
    _id: string;
    description: string;
    category: string;
    amount: Amount;
    date: string;
    average: Amount;
    threshold: Amount;
    sample_size: number;
  }[];
  recurring: {
    merchant: string;
    category: string;
    cadence: string;
    min_interval: number;
    max_interval: number;
    average: Amount;
    days: number;
    payments: number;
    dates: string[];
    last_date: string;
  }[];
};
type Simulation = {
  month: string;
  category: string;
  percent: Amount;
  months: number;
  current: Amount;
  reduced: Amount;
  monthly_saving: Amount;
  accumulated: Amount;
  current_total: Amount;
  reduced_total: Amount;
};
type Recent = {
  _id: string;
  description: string;
  category: string;
  date: string;
  type: string;
  amount: Amount;
};
const categories = ["Alimentação", "Moradia", "Transporte", "Saúde", "Educação", "Lazer", "Compras", "Assinaturas", "Salário", "Freelance", "Outros"];
const categoryOptions = categories.map((category) => ({
  value: category,
  label: category,
  color: categoryColor(category),
}));
const brl = (value: Amount) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (value: Amount) => `${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const dateBR = (value: string) => value.slice(0, 10).split("-").reverse().join("/");
const localMonth = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
async function fetchJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Não foi possível carregar os dados.");
  return body as T;
}
function useApi<T>(url: string | null) {
  const [result, setResult] = useState<{
    url: string;
    data: T | null;
    error: string;
  } | null>(null);
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    fetchJSON<T>(url, controller.signal)
      .then((data) => setResult({ url, data, error: "" }))
      .catch((e) => {
        if (e.name !== "AbortError")
          setResult({
            url,
            data: null,
            error: e.message || "Erro de conexão.",
          });
      });
    return () => controller.abort();
  }, [url]);
  const current = result?.url === url ? result : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? "",
    loading: !!url && !current,
  };
}
function Panel({ title, subtitle, cardRef, className, children }: { title: string; subtitle?: string; cardRef?: React.Ref<HTMLDivElement>; className?: string; children: React.ReactNode }) {
  return (
    <Card ref={cardRef} className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {subtitle && <p className="subtle">{subtitle}</p>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
function MonthFilter({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const selectedMonth = month || localMonth();

  return (
    <form
      className="month-filter"
      onSubmit={(e) => {
        e.preventDefault();
        onChange(String(new FormData(e.currentTarget).get("month")));
      }}
    >
      <DatePicker key={selectedMonth} label="Período" precision="month" name="month" defaultValue={selectedMonth} />
      <Button type="submit" variant="secondary">
        Aplicar
      </Button>
    </form>
  );
}
function Status({ error, loading }: { error: string; loading: boolean }) {
  return error ? (
    <AppAlert error>{error}</AppAlert>
  ) : loading ? (
    <span className="sr-only absolute" role="status">
      Carregando dados…
    </span>
  ) : null;
}
export function Dashboard() {
  const [month, setMonth] = useState("");
  const tagsRef = useRef<HTMLDivElement>(null);
  const categoryCardRef = useRef<HTMLDivElement>(null);
  const { data, error, loading } = useApi<DashboardData>(`/api/analytics${month ? `?month=${encodeURIComponent(month)}` : ""}`);
  const current = data?.month;
  const last = current ? new Date(Date.UTC(Number(current.slice(0, 4)), Number(current.slice(5, 7)), 0)).getUTCDate() : 0;
  const recent = useApi<{ items: Recent[] }>(current ? `/api/transactions?start=${current}-01&end=${current}-${last}` : null);

  useEffect(() => {
    const tags = tagsRef.current;
    const card = categoryCardRef.current;
    if (!tags || !card) return;

    const badges = Array.from(tags.querySelectorAll<HTMLElement>(".hero-tag"));
    let paths: { badge: HTMLElement; x: number; y: number; distance: number }[] = [];
    let frame: number | undefined;

    function paint() {
      frame = undefined;
      const scroll = Math.max(0, window.scrollY);
      for (const { badge, x, y, distance } of paths) {
        const progress = Math.min(1, scroll / distance);
        badge.style.setProperty("--tag-x", `${x * progress}px`);
        badge.style.setProperty("--tag-y", `${y * progress}px`);
      }
    }

    function onScroll() {
      if (frame === undefined) frame = window.requestAnimationFrame(paint);
    }

    const measure = () => {
      const origin = tags.getBoundingClientRect();
      const target = card.getBoundingClientRect();
      const distance = Math.max(160, (target.top - origin.top) * 0.62);
      paths = badges.map((badge, index) => ({
        badge,
        x: target.left + target.width * (0.3 + index * 0.2) - (origin.left + badge.offsetLeft + badge.offsetWidth / 2),
        y: target.top + 54 + index * 6 - (origin.top + badge.offsetTop + badge.offsetHeight / 2),
        distance: distance + index * 24,
      }));
      onScroll();
    };

    const observer = new ResizeObserver(measure);
    observer.observe(tags);
    observer.observe(card);
    const dashboard = tags.closest("main");
    if (dashboard) observer.observe(dashboard);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", onScroll, { passive: true });
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", onScroll);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      for (const badge of badges) {
        badge.style.removeProperty("--tag-x");
        badge.style.removeProperty("--tag-y");
      }
    };
  }, [current]);

  return (
    <PageReveal dashboard>
      <div className="heading dashboard-hero">
        <div data-page-reveal>
          <h1>Visão geral</h1>
          <p>Receitas, despesas e saldo do período.</p>
        </div>
        <div className="hero-tags" ref={tagsRef} aria-hidden="true">
          <Badge className="hero-tag tag-coral">Alimentação</Badge>
          <Badge className="hero-tag tag-sky">Assinaturas</Badge>
          <Badge className="hero-tag tag-lime">Receitas</Badge>
        </div>
        <Link href="/transactions" className={buttonVariants({ size: "lg" })} data-page-reveal>
          Ver transações <IconArrowUpRight />
        </Link>
      </div>
      <div>
        <MonthFilter month={month || data?.month || ""} onChange={setMonth} />
      </div>
      {error && <AppAlert error>{error}</AppAlert>}
      {loading && (
        <span className="sr-only absolute" role="status">
          Carregando dados…
        </span>
      )}
      {data && (
        <>
          <div className="metrics-grid" data-page-intro>
            <Panel title="Receitas do mês">
              <strong className="metric-value">{brl(data.income)}</strong>
              <p className="subtle">Mês anterior: {brl(data.previous.income)}</p>
            </Panel>
            <Panel title="Despesas do mês">
              <strong className="metric-value">{brl(data.expense)}</strong>
              <p className="subtle">{data.expense_change === null ? "Sem despesas no mês anterior" : `${pct(data.expense_change)} em relação ao mês anterior`}</p>
            </Panel>
            <Panel title="Saldo do mês">
              <strong className={`metric-value ${Number(data.balance) >= 0 ? "income" : "expense"}`}>{brl(data.balance)}</strong>
              <p className="subtle">Receitas menos despesas</p>
            </Panel>
            <Panel title="Taxa de poupança">
              <strong className="metric-value">{data.saving_rate === null ? "—" : pct(data.saving_rate)}</strong>
              <p className="subtle">Parcela da receita que restou</p>
            </Panel>
          </div>
          <div className="dashboard-grid" data-page-intro>
            <Panel title="Evolução financeira" subtitle="Receitas e despesas nos últimos 6 meses">
              <Evolution chart={data.chart} />
            </Panel>
            <Panel title="Despesas por categoria" subtitle="Participação no total do mês" cardRef={categoryCardRef} className="category-target z-3">
              <CategoryChart rows={data.categories} total={data.expense} />
            </Panel>
          </div>
          <Panel title="Últimas transações" subtitle="Movimentações do mês selecionado">
            {recent.error && <AppAlert error>{recent.error}</AppAlert>}
            <SmoothListHeight>
              {recent.data &&
                (recent.data.items.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recent.data.items.slice(0, 5).map((row) => (
                        <TableRow key={row._id}>
                          <TableCell>{row.description}</TableCell>
                          <TableCell>
                            <CategoryBadge category={row.category} />
                          </TableCell>
                          <TableCell>{dateBR(row.date)}</TableCell>
                          <TableCell className={row.type === "income" ? "income" : "expense"}>
                            {row.type === "income" ? "+" : "−"} {brl(row.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="empty">Nenhuma transação neste mês.</p>
                ))}
            </SmoothListHeight>
            <Link className="text-link" href="/transactions">
              Ver todas as transações <IconArrowRight aria-hidden />
            </Link>
          </Panel>
        </>
      )}
    </PageReveal>
  );
}
export function Insights() {
  const [month, setMonth] = useState("");
  const { data, error, loading } = useApi<InsightData>(`/api/insights${month ? `?month=${encodeURIComponent(month)}` : ""}`);
  return (
    <PageReveal>
      <div className="heading">
        <div>
          <h1>Análise de gastos</h1>
          <p>Comparações por categoria e padrões de pagamento.</p>
        </div>
        <MonthFilter month={month || data?.month || ""} onChange={setMonth} />
      </div>
      <AppAlert>Análises do mês completo selecionado. Se ele ainda estiver em andamento, a comparação com o mês anterior é parcial.</AppAlert>
      <Status error={error} loading={loading && !data} />
      {data && (
        <>
          <div className="insight-grid" data-page-intro>
            <Panel title="Comparação por categoria">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Anterior</TableHead>
                    <TableHead>Selecionado</TableHead>
                    <TableHead>Variação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.changes.map((row) => (
                    <TableRow key={row.category}>
                      <TableCell>
                        <CategoryBadge category={row.category} />
                      </TableCell>
                      <TableCell>{brl(row.previous)}</TableCell>
                      <TableCell>{brl(row.current)}</TableCell>
                      <TableCell className={row.change !== null && Number(row.change) > 0 ? "expense" : "income"}>{row.change === null ? "Sem base" : pct(row.change)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!data.changes.length && <p className="empty">Sem despesas nos dois meses comparados.</p>}
            </Panel>
            <Panel title="Redução de gastos variáveis">
              {data.opportunities.map((row) => (
                <div className="insight-item" key={row.category}>
                  <CategoryBadge category={row.category} />
                  <p>
                    Uma redução de 15% sobre {brl(row.total)} representaria <span className="income">{brl(row.saving)} por mês</span>.
                  </p>
                  <Link className="text-link" href={`/simulator?month=${data.month}&category=${encodeURIComponent(row.category)}&percent=15&months=12`}>
                    Simular esta categoria <IconArrowRight aria-hidden />
                  </Link>
                </div>
              ))}
              {!data.opportunities.length && <p className="subtle">Nenhuma despesa variável neste mês.</p>}
              <p className="fine-print">Cenários hipotéticos, sem garantia de economia.</p>
            </Panel>
            <Panel title="Despesas fora do padrão">
              {data.outliers.map((row) => (
                <div className="insight-item" key={row._id}>
                  <strong>
                    {row.description} <span className="expense">{brl(row.amount)}</span>
                  </strong>
                  <p>
                    <CategoryBadge category={row.category} /> · {dateBR(row.date)}
                  </p>
                  <p>
                    Média histórica: {brl(row.average)} em {row.sample_size} registros. Limite de 2×: {brl(row.threshold)}.
                  </p>
                </div>
              ))}
              {!data.outliers.length && <p className="empty">Nenhuma despesa atípica identificada. São necessárias ao menos 3 despesas anteriores por categoria.</p>}
              <p className="fine-print">Acima de 2× a média dos 6 meses anteriores, excluindo o mês analisado.</p>
            </Panel>
            <Panel title="Categorias com maior participação">
              {data.concentrations.map((row) => (
                <div className="insight-item" key={row.category}>
                  <strong>
                    <CategoryBadge category={row.category} /> · {pct(row.percentage)}
                  </strong>
                  <p>
                    {brl(row.total)} em {row.count} lançamentos.
                  </p>
                </div>
              ))}
              {!data.concentrations.length && <p className="subtle">Nenhuma categoria concentra 25% ou mais das despesas neste mês.</p>}
              <p className="fine-print">Participação = despesas da categoria ÷ despesas totais × 100.</p>
            </Panel>
          </div>
          <Panel title="Pagamentos recorrentes" subtitle="Últimos 6 meses até o mês selecionado · pelo menos 3 dias de pagamento">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estabelecimento / descrição</TableHead>
                  <TableHead>Frequência</TableHead>
                  <TableHead>Intervalos</TableHead>
                  <TableHead>Média por dia</TableHead>
                  <TableHead>Ocorrências</TableHead>
                  <TableHead>Último pagamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recurring.map((row) => (
                  <TableRow key={`${row.merchant}-${row.category}`}>
                    <TableCell>
                      {row.merchant}
                      <br />
                      <CategoryBadge category={row.category} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{row.cadence}</Badge>
                    </TableCell>
                    <TableCell>
                      {row.min_interval}–{row.max_interval} dias
                    </TableCell>
                    <TableCell>{brl(row.average)}</TableCell>
                    <TableCell>
                      <details className="recurring-details">
                        <summary className="recurring-summary">
                          <IconChevronRight aria-hidden />
                          {row.days} dias / {row.payments} registros
                        </summary>
                        {[...row.dates].sort().map((d) => (
                          <div key={d}>{dateBR(d)}</div>
                        ))}
                      </details>
                    </TableCell>
                    <TableCell>{dateBR(row.last_date)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!data.recurring.length && <p className="empty">Ainda não há histórico suficiente para identificar padrões regulares.</p>}
            <p className="fine-print">Semanal: intervalos de 5 a 9 dias. Mensal: de 25 a 35 dias. Compras no mesmo dia são agrupadas; a marcação manual de recorrência não determina este resultado.</p>
          </Panel>
        </>
      )}
    </PageReveal>
  );
}
export function Simulator({ initial }: { initial: Record<string, string> }) {
  const [query, setQuery] = useState(initial.category ? new URLSearchParams(initial).toString() : "");
  const { data, error, loading } = useApi<Simulation>(query ? `/api/simulation?${query}` : null);
  return (
    <PageReveal>
      <div className="heading">
        <div>
          <h1>Simulador de economia</h1>
          <p>Calcule quanto uma redução de gastos pode representar.</p>
        </div>
      </div>
      <div className="sim-grid" data-page-intro>
        <Panel title="Parâmetros da simulação" subtitle="Base: despesas do mês selecionado.">
          <form
            className="sim-form"
            onSubmit={(e) => {
              e.preventDefault();
              const params = new URLSearchParams();
              new FormData(e.currentTarget).forEach((v, k) => params.set(k, String(v)));
              setQuery(params.toString());
            }}
          >
            <DatePicker label="Mês de referência" name="month" precision="month" defaultValue={initial.month || localMonth()} />
            <AppSelect id="simulation-category" label="Categoria de despesa" name="category" defaultValue={initial.category || "Lazer"} options={categoryOptions} />
            <label>
              Redução desejada (%)
              <Input name="percent" type="number" min="0" max="100" step="0.01" required defaultValue={initial.percent || "15"} />
            </label>
            <label>
              Período de projeção (meses)
              <Input name="months" type="number" min="1" max="120" required defaultValue={initial.months || "12"} />
            </label>
            <Button type="submit">Calcular economia</Button>
          </form>
        </Panel>
        <Panel title="Resultado da simulação">
          <Status error={error} loading={loading} />
          {data && !error ? (
            <div data-page-reveal>
              <h2 className="result-heading">Uma mudança de {data.percent}%</h2>
              <p className="subtle">Economia estimada em {data.months} meses</p>
              <strong className="projected income">{brl(data.accumulated)}</strong>
              <p>{brl(data.monthly_saving)} por mês, mantendo a redução proposta.</p>
              <div className="scenario">
                <div>
                  <span>Cenário atual / mês</span>
                  <strong>{brl(data.current)}</strong>
                </div>
                <div>
                  <span>Cenário reduzido / mês</span>
                  <strong>{brl(data.reduced)}</strong>
                </div>
                <div>
                  <span>Total atual em {data.months} meses</span>
                  <strong>{brl(data.current_total)}</strong>
                </div>
                <div>
                  <span>Total reduzido em {data.months} meses</span>
                  <strong>{brl(data.reduced_total)}</strong>
                </div>
              </div>
              {Number(data.current) === 0 && <AppAlert>Não há despesas nesta categoria no mês selecionado.</AppAlert>}
            </div>
          ) : (
            !error && !loading && <p className="empty">Preencha os campos para visualizar sua projeção.</p>
          )}
          <p className="fine-print">Projeção sem juros, inflação ou investimentos. Repete a base de gastos do mês escolhido e arredonda a economia mensal para centavos. Não representa economia garantida.</p>
        </Panel>
      </div>
    </PageReveal>
  );
}
