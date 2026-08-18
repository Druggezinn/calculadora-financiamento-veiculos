import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { saveProposalPdf } from "@/lib/proposalPdf";
import {
  calculateFinancing,
  calculateInstallmentsForTargetPayment,
  type FinancingResult,
} from "@shared/finance";
import type { FinancialInstitution } from "../../../drizzle/schema";
import {
  ArrowDownRight,
  ArrowUpRight,
  Calculator,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Database,
  Download,
  Info,
  Landmark,
  Loader2,
  LockKeyhole,
  LogIn,
  LogOut,
  Moon,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Sparkles,
  Upload,
} from "lucide-react";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

type CalculationMode = "payment" | "term";
type Rate = FinancialInstitution;
type RateResult = { rate: Rate; calculation: FinancingResult };
type SessionItem = {
  id: string;
  createdAt: number;
  vehicleValue: number;
  downPayment: number;
  mode: CalculationMode;
  value: number;
  leadingInstitution: string;
  leadingPayment: number;
  leadingTotalPaid: number;
  leadingInstallments: number;
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});

const percentageFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatRate(value: number) {
  return `${percentageFormatter.format(value)}% a.m.`;
}

function loadSessionHistory(): SessionItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.sessionStorage.getItem("autofin-session-history");
    return stored ? (JSON.parse(stored) as SessionItem[]) : [];
  } catch {
    return [];
  }
}

function CurrencyInput({
  id,
  label,
  value,
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-[0.72rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </Label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm font-semibold text-muted-foreground">R$</span>
        <Input
          id={id}
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : 0}
          disabled={disabled}
          onChange={event => onChange(Number(event.target.value))}
          className="h-13 rounded-2xl border-border/90 bg-card pl-11 text-base font-semibold shadow-[0_1px_0_rgba(15,52,53,0.04)] transition-shadow focus-visible:shadow-[0_0_0_4px_rgba(36,122,117,0.11)]"
        />
      </div>
    </div>
  );
}

export default function Home() {
  const { user, loading: authLoading, logout, refresh: refreshAuth } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const ratesQuery = trpc.finance.listRates.useQuery();
  const settingsQuery = trpc.settings.get.useQuery();
  const authStatusQuery = trpc.auth.status.useQuery();
  const utils = trpc.useUtils();
  const updateRate = trpc.finance.updateRate.useMutation({
    onSuccess: () => {
      toast.success("Taxa atualizada e disponível para novos cálculos.");
      utils.finance.listRates.invalidate();
    },
    onError: error => toast.error(error.message || "Não foi possível atualizar a taxa."),
  });
  const syncRates = trpc.finance.syncRates.useMutation({
    onSuccess: result => {
      utils.finance.listRates.invalidate();
      toast.success(`${result.recordsUpdated} taxa(s) atualizada(s) pela fonte oficial.`);
      if (result.details.length) toast.info(result.details.join(" "));
    },
    onError: error => toast.error(error.message || "Não foi possível consultar a fonte oficial."),
  });
  const updateBrand = trpc.settings.updateBrand.useMutation({
    onSuccess: () => {
      utils.settings.get.invalidate();
      toast.success("Marca atualizada.");
    },
    onError: error => toast.error(error.message || "Não foi possível atualizar a marca."),
  });
  const login = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await refreshAuth();
      toast.success("Acesso administrativo liberado.");
    },
    onError: error => toast.error(error.message || "Não foi possível entrar."),
  });
  const bootstrapAdmin = trpc.auth.bootstrapAdmin.useMutation({
    onSuccess: async () => {
      await authStatusQuery.refetch();
      toast.success("Administrador criado. Agora entre com seu usuário e senha.");
    },
    onError: error => toast.error(error.message || "Não foi possível provisionar o administrador."),
  });

  const [vehicleValue, setVehicleValue] = useState(0);
  const [downPayment, setDownPayment] = useState(0);
  const [mode, setMode] = useState<CalculationMode>("payment");
  const [targetPayment, setTargetPayment] = useState(0);
  const [installments, setInstallments] = useState(48);
  const [results, setResults] = useState<RateResult[]>([]);
  const [unavailableRates, setUnavailableRates] = useState<Rate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<SessionItem[]>(loadSessionHistory);
  const [loginOpen, setLoginOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [logoDataUri, setLogoDataUri] = useState<string | null>(null);
  const [brandName, setBrandName] = useState("");

  const principal = Math.max(vehicleValue - downPayment, 0);
  const activeRates = (ratesQuery.data ?? []) as Rate[];
  const calculationLabel = mode === "payment" ? "Parcela desejada" : "Prazo desejado";
  const brand = settingsQuery.data;
  const hasLocalAdmin = authStatusQuery.data?.hasAdmin ?? true;

  const lowestResult = useMemo(
    () => results.reduce<RateResult | null>((lowest, current) => {
      if (!lowest || current.calculation.totalPaid < lowest.calculation.totalPaid) return current;
      return lowest;
    }, null),
    [results],
  );

  function persistHistory(nextHistory: SessionItem[]) {
    setHistory(nextHistory);
    window.sessionStorage.setItem("autofin-session-history", JSON.stringify(nextHistory));
  }

  function handleCalculate() {
    if (vehicleValue <= 0) {
      setError("Informe um valor de veículo maior que zero.");
      return;
    }
    if (downPayment < 0 || downPayment > vehicleValue) {
      setError("A entrada deve estar entre zero e o valor do veículo.");
      return;
    }
    if (principal === 0) {
      setError("O valor financiado precisa ser maior que zero.");
      return;
    }
    if (activeRates.length === 0) {
      setError("As taxas ainda não estão disponíveis. Tente novamente em instantes.");
      return;
    }
    if (mode === "payment" && targetPayment <= 0) {
      setError("Informe o valor máximo da parcela desejada.");
      return;
    }
    if (mode === "term" && (!Number.isInteger(installments) || installments < 1 || installments > 84)) {
      setError("Informe um prazo inteiro entre 1 e 84 parcelas.");
      return;
    }

    const attemptedResults = activeRates
      .map(rate => {
        const calculation = mode === "payment"
          ? calculateInstallmentsForTargetPayment(principal, rate.monthlyRate, targetPayment, 84)
          : calculateFinancing(principal, rate.monthlyRate, installments);
        return { rate, calculation };
      });
    const nextResults = attemptedResults
      .filter((result): result is { rate: Rate; calculation: FinancingResult } => result.calculation !== null)
      .sort((a, b) => a.calculation.totalPaid - b.calculation.totalPaid);
    const nextUnavailableRates = attemptedResults
      .filter(result => result.calculation === null)
      .map(result => result.rate);

    if (nextResults.length === 0) {
      setError("Nenhuma taxa alcançou a parcela desejada em até 84 meses. Ajuste a entrada ou a parcela alvo.");
      setResults([]);
      setUnavailableRates(nextUnavailableRates);
      return;
    }

    setError(null);
    setResults(nextResults);
    setUnavailableRates(nextUnavailableRates);
    const leadingResult = nextResults[0];
    const item: SessionItem = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      vehicleValue,
      downPayment,
      mode,
      value: mode === "payment" ? targetPayment : installments,
      leadingInstitution: leadingResult.rate.displayName,
      leadingPayment: leadingResult.calculation.payment,
      leadingTotalPaid: leadingResult.calculation.totalPaid,
      leadingInstallments: leadingResult.calculation.installments,
    };
    persistHistory([item, ...history].slice(0, 5));
  }

  function handleRateUpdate(event: FormEvent<HTMLFormElement>, rate: Rate) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const annualRateValue = String(formData.get("annualRate") ?? "").trim();
    updateRate.mutate({
      id: rate.id,
      monthlyRate: Number(formData.get("monthlyRate")),
      annualRate: annualRateValue ? Number(annualRateValue) : null,
      sourceDescription: String(formData.get("sourceDescription") ?? "").trim() || null,
      referenceStart: String(formData.get("referenceStart") ?? "").trim() || null,
      referenceEnd: String(formData.get("referenceEnd") ?? "").trim() || null,
    });
  }

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    login.mutate({
      username: String(formData.get("username") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
  }

  function handleBootstrap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    bootstrapAdmin.mutate({
      username: String(formData.get("username") ?? ""),
      password: String(formData.get("password") ?? ""),
      setupToken: String(formData.get("setupToken") ?? ""),
    });
  }

  function handleLogoFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/image\/(png|jpeg|webp)/.test(file.type) || file.size > 1_000_000) {
      toast.error("Envie um logo PNG, JPEG ou WebP de até 1 MB.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoDataUri(String(reader.result));
    reader.readAsDataURL(file);
  }

  function handleBrandUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    updateBrand.mutate({
      brandName: String(formData.get("brandName") ?? brand?.brandName ?? "AutoFin"),
      logoDataUri,
    });
  }

  async function exportProposalPdf() {
    if (!results.length) {
      toast.error("Calcule ao menos uma proposta antes de exportar.");
      return;
    }
    try {
      await saveProposalPdf({
        title: brand?.brandName ?? "AutoFin",
        vehicleValue,
        downPayment,
        principal,
        mode,
        targetPayment,
        installments,
        results: results.map(result => ({ institutionName: result.rate.displayName, calculation: result.calculation })),
      });
      toast.success("Proposta em PDF gerada.");
    } catch {
      toast.error("Não foi possível gerar o PDF da proposta.");
    }
  }

  return (
    <div className="min-h-screen finance-grid">
      <header className="border-b border-border/75 bg-background/75 backdrop-blur-xl">
        <div className="container flex h-18 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-[0_10px_25px_rgba(18,59,58,0.16)]">
              {brand?.logoUrl ? <img src={brand.logoUrl} alt={`Logo ${brand.brandName}`} className="size-full object-cover" /> : <Calculator className="size-5" strokeWidth={2.1} />}
            </div>
            <div>
              <p className="text-sm font-extrabold tracking-tight text-foreground">{brand?.brandName ?? "AutoFin"}</p>
              <p className="micro-label text-[0.56rem] text-muted-foreground">simulador de margem</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5 text-[0.68rem] font-bold tracking-[0.09em] text-secondary-foreground uppercase sm:flex">
              <span className="size-1.5 rounded-full bg-primary" />Taxas configuráveis
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
              aria-pressed={theme === "dark"}
              title={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
              className="size-9 rounded-xl border-border bg-card text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
            >
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              <span className="sr-only">{theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}</span>
            </Button>
            {!authLoading && user?.role === "admin" ? (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-xl border-border bg-card text-xs font-bold shadow-sm">
                    <SlidersHorizontal className="mr-2 size-3.5" />Gerenciar taxas
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto rounded-3xl p-0">
                  <DialogHeader className="border-b border-border bg-muted px-6 py-6">
                    <div className="mb-3 flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><LockKeyhole className="size-4" /></div>
                    <DialogTitle className="text-xl tracking-tight">Tabela administrativa de taxas</DialogTitle>
                    <DialogDescription>Atualize a referência mensal e a vigência. As mudanças serão usadas nos próximos cálculos.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-5 p-6">
                    <section className="rounded-2xl border border-border bg-secondary p-4">
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-sm font-extrabold text-foreground">Sincronizar referência oficial</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Consulta manual à base pública do Banco Central; valores ficam registrados na auditoria.</p></div><Button type="button" onClick={() => syncRates.mutate()} disabled={syncRates.isPending} className="rounded-xl bg-primary text-xs font-bold text-primary-foreground hover:bg-primary/90">{syncRates.isPending ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <RefreshCw className="mr-2 size-3.5" />}Atualizar taxas</Button></div>
                    </section>
                    <form onSubmit={handleBrandUpdate} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                      <div className="mb-4 flex items-center justify-between gap-3"><div><p className="font-bold text-foreground">Marca e logo</p><p className="mt-1 text-xs text-muted-foreground">A imagem fica armazenada com acesso administrativo.</p></div>{logoDataUri || brand?.logoUrl ? <img src={logoDataUri ?? brand?.logoUrl ?? ""} alt="Prévia do logo" className="size-10 rounded-xl object-cover" /> : <Upload className="size-4 text-primary" />}</div>
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto]"><div className="space-y-1.5"><Label className="text-xs">Nome da marca</Label><Input name="brandName" defaultValue={brand?.brandName ?? "AutoFin"} onChange={event => setBrandName(event.target.value)} /></div><div className="space-y-1.5"><Label className="text-xs">Logo (até 1 MB)</Label><Input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoFile} className="max-w-xs cursor-pointer" /></div></div>
                      <Button type="submit" size="sm" disabled={updateBrand.isPending || !brandName && !brand?.brandName} className="mt-3 rounded-xl bg-primary text-xs font-bold text-primary-foreground hover:bg-primary/90">{updateBrand.isPending ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : "Salvar marca"}</Button>
                    </form>
                    {activeRates.map(rate => (
                      <form key={rate.id} onSubmit={event => handleRateUpdate(event, rate)} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-foreground">{rate.displayName}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{rate.legalName}</p>
                          </div>
                          <Button type="submit" size="sm" disabled={updateRate.isPending} className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
                            {updateRate.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Salvar"}
                          </Button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="space-y-1.5"><Label className="text-xs">Taxa mensal (%)</Label><Input name="monthlyRate" type="number" step="0.01" min="0" defaultValue={rate.monthlyRate} /></div>
                          <div className="space-y-1.5"><Label className="text-xs">Taxa anual (%)</Label><Input name="annualRate" type="number" step="0.01" min="0" defaultValue={rate.annualRate ?? ""} /></div>
                          <div className="space-y-1.5"><Label className="text-xs">Início da vigência</Label><Input name="referenceStart" type="date" defaultValue={rate.referenceStart ?? ""} /></div>
                          <div className="space-y-1.5"><Label className="text-xs">Fim da vigência</Label><Input name="referenceEnd" type="date" defaultValue={rate.referenceEnd ?? ""} /></div>
                        </div>
                        <div className="mt-3 space-y-1.5"><Label className="text-xs">Nota da fonte</Label><Input name="sourceDescription" defaultValue={rate.sourceDescription ?? ""} /></div>
                      </form>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            ) : (
              <Dialog open={hasLocalAdmin ? loginOpen : setupOpen} onOpenChange={open => hasLocalAdmin ? setLoginOpen(open) : setSetupOpen(open)}>
                <DialogTrigger asChild><Button variant="ghost" size="sm" onClick={() => hasLocalAdmin ? setLoginOpen(true) : setSetupOpen(true)} className="rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground"><LockKeyhole className="mr-2 size-3.5" />Acesso do dono</Button></DialogTrigger>
                <DialogContent className="max-w-md rounded-3xl"><DialogHeader><DialogTitle>{hasLocalAdmin ? "Acesso administrativo" : "Criar administrador inicial"}</DialogTitle><DialogDescription>{hasLocalAdmin ? "Use o usuário e a senha configurados na VPS." : "Use o token privado gerado na configuração da VPS para criar o administrador."}</DialogDescription></DialogHeader>{hasLocalAdmin ? <form onSubmit={handleLogin} className="space-y-4"><div className="space-y-2"><Label>Usuário</Label><Input name="username" autoComplete="username" required /></div><div className="space-y-2"><Label>Senha</Label><Input name="password" type="password" autoComplete="current-password" minLength={12} required /></div><Button type="submit" disabled={login.isPending} className="w-full rounded-xl bg-primary text-primary-foreground">{login.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <LogIn className="mr-2 size-4" />}Entrar</Button></form> : <form onSubmit={handleBootstrap} className="space-y-4"><div className="space-y-2"><Label>Usuário administrador</Label><Input name="username" autoComplete="username" minLength={3} required /></div><div className="space-y-2"><Label>Senha forte</Label><Input name="password" type="password" autoComplete="new-password" minLength={12} required /></div><div className="space-y-2"><Label>Token de provisionamento</Label><Input name="setupToken" type="password" autoComplete="one-time-code" minLength={24} required /></div><Button type="submit" disabled={bootstrapAdmin.isPending} className="w-full rounded-xl bg-primary text-primary-foreground">{bootstrapAdmin.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ShieldCheck className="mr-2 size-4" />}Criar administrador</Button></form>}</DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </header>

      <main className="container py-7 sm:py-10">
        <section className="mb-8 grid gap-5 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-primary"><Sparkles className="size-4" /><span className="micro-label text-[0.63rem] font-bold">proposta de venda</span></div>
            <h1 className="max-w-3xl text-[2.2rem] font-extrabold leading-[1.02] tracking-[-0.055em] text-foreground sm:text-5xl">Estruture uma venda que <span className="text-primary">cabe no cliente.</span></h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Compare a parcela e o custo estimado em seis financeiras. A simulação inclui IOF e usa a tabela de taxas definida pelo seu negócio.</p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-2xl border border-border/80 bg-card/75 px-4 py-3 text-xs text-muted-foreground shadow-sm">
            <span className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" />Cálculo Price</span>
            <span className="flex items-center gap-2"><CircleDollarSign className="size-4 text-primary" />IOF incluído</span>
            <span className="flex items-center gap-2"><Database className="size-4 text-primary" />Taxas editáveis</span>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
          <aside className="rounded-[1.7rem] border border-border bg-card p-5 shadow-[0_16px_45px_rgba(25,58,55,0.07)] sm:p-6">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="micro-label text-[0.62rem] font-bold text-primary">01 · dados da venda</p>
                <h2 className="mt-1 text-lg font-extrabold tracking-tight text-foreground">Monte o cenário</h2>
              </div>
              <div className="grid size-9 place-items-center rounded-xl bg-secondary text-primary"><Landmark className="size-4" /></div>
            </div>

            <div className="space-y-4">
              <CurrencyInput id="vehicle-value" label="Valor do veículo" value={vehicleValue} onChange={setVehicleValue} />
              <CurrencyInput id="down-payment" label="Valor de entrada" value={downPayment} onChange={setDownPayment} />
              <div className="rounded-2xl border border-dashed border-border bg-secondary p-4">
                <div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-secondary-foreground">Valor financiado</span><span className="text-xs font-bold text-primary">automático</span></div>
                <p className="mt-1.5 text-2xl font-extrabold tracking-tight text-foreground">{formatCurrency(principal)}</p>
              </div>
            </div>

            <div className="mt-6">
              <p className="micro-label mb-3 text-[0.62rem] font-bold text-primary">02 · estratégia da parcela</p>
              <Tabs value={mode} onValueChange={value => { setMode(value as CalculationMode); setResults([]); setError(null); }}>
                <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl bg-muted p-1">
                  <TabsTrigger value="payment" className="rounded-xl px-2 py-2.5 text-xs font-bold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">Parcela fixa</TabsTrigger>
                  <TabsTrigger value="term" className="rounded-xl px-2 py-2.5 text-xs font-bold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">Nº de parcelas</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="mt-4">
                {mode === "payment" ? (
                  <CurrencyInput id="target-payment" label="Parcela máxima desejada" value={targetPayment} onChange={setTargetPayment} />
                ) : (
                  <div className="space-y-2"><Label htmlFor="installments" className="text-[0.72rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase">Número de parcelas</Label><div className="relative"><Input id="installments" type="number" min="1" max="84" step="1" inputMode="numeric" value={installments} onChange={event => setInstallments(Number(event.target.value))} className="h-13 rounded-2xl bg-card pr-16 text-base font-semibold" /><span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs font-bold text-muted-foreground">meses</span></div></div>
                )}
              </div>
            </div>

            {error && <div className="mt-5 flex gap-2 rounded-2xl border border-destructive/40 bg-destructive/15 p-3 text-xs leading-5 text-destructive"><Info className="mt-0.5 size-4 shrink-0" />{error}</div>}
            <Button onClick={handleCalculate} disabled={ratesQuery.isLoading} className="mt-6 h-13 w-full rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-[0_12px_24px_rgba(18,59,58,0.18)] transition hover:bg-primary/90">
              {ratesQuery.isLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Calculator className="mr-2 size-4" />}Calcular propostas<ChevronRight className="ml-1 size-4" />
            </Button>
            <p className="mt-3 text-center text-[0.67rem] leading-4 text-muted-foreground">{calculationLabel} · Prazo máximo de 84 meses · valores indicativos</p>
          </aside>

          <div className="min-w-0 rounded-[1.7rem] border border-border bg-card/90 shadow-[0_16px_45px_rgba(25,58,55,0.07)]">
            <div className="flex flex-col justify-between gap-4 border-b border-border/70 px-5 py-5 sm:flex-row sm:items-start sm:px-6">
              <div>
                <p className="micro-label text-[0.62rem] font-bold text-primary">03 · comparativo</p>
                <h2 className="mt-1 text-lg font-extrabold tracking-tight text-foreground">Propostas por financeira</h2>
              </div>
              <div className="flex items-center gap-2">{results.length > 0 && <Button variant="outline" size="sm" onClick={exportProposalPdf} className="rounded-xl border-border bg-card text-xs font-bold text-foreground"><Download className="mr-2 size-3.5" />Exportar PDF</Button>}{results.length > 0 && lowestResult && <div className="rounded-2xl bg-accent px-3 py-2 text-right"><p className="micro-label text-[0.56rem] font-bold text-primary">menor custo total</p><p className="mt-0.5 text-sm font-extrabold text-foreground">{lowestResult.rate.displayName}</p></div>}</div>
            </div>

            <div className="p-4 sm:p-6">
              {ratesQuery.isLoading ? (
                <div className="min-h-78 rounded-2xl border border-dashed border-border bg-muted/60 p-6">
                  <div className="mb-6 flex items-center gap-3"><Loader2 className="size-4 animate-spin text-primary" /><div><p className="text-sm font-bold text-foreground">Carregando a tabela de taxas</p><p className="mt-0.5 text-xs text-muted-foreground">Preparando seu comparativo.</p></div></div>
                  <div className="grid gap-3 lg:grid-cols-2">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-42 animate-pulse rounded-2xl bg-secondary" />)}</div>
                </div>
              ) : ratesQuery.isError ? (
                <div className="grid min-h-78 place-items-center rounded-2xl border border-dashed border-destructive/40 bg-destructive/15 p-6 text-center"><div><RefreshCw className="mx-auto size-6 text-destructive" /><p className="mt-3 text-sm font-bold text-destructive">Não foi possível carregar as taxas.</p><Button variant="link" onClick={() => ratesQuery.refetch()} className="mt-1 text-destructive">Tentar novamente</Button></div></div>
              ) : results.length === 0 ? (
                <div className="grid min-h-78 place-items-center rounded-2xl border border-dashed border-border bg-muted/60 p-7 text-center"><div className="max-w-xs"><div className="mx-auto grid size-12 place-items-center rounded-2xl bg-secondary text-primary"><ArrowUpRight className="size-5" /></div><p className="mt-4 text-sm font-extrabold text-foreground">Seu comparativo aparece aqui.</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Preencha os dados da venda e escolha a estratégia para visualizar as possibilidades por financeira.</p></div></div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {results.map((result, index) => {
                    const isBest = result.rate.id === lowestResult?.rate.id;
                    return <article key={result.rate.id} className={`relative overflow-hidden rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${isBest ? "border-primary/50 bg-accent/50" : "border-border bg-card"}`}>
                      {isBest && <div className="absolute right-0 top-0 rounded-bl-xl bg-primary px-2.5 py-1 text-[0.58rem] font-bold tracking-[0.08em] text-primary-foreground uppercase">melhor custo</div>}
                      <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-extrabold text-foreground">{result.rate.displayName}</p><p className="mt-0.5 text-[0.68rem] text-muted-foreground">{formatRate(result.rate.monthlyRate)}</p></div><div className="flex items-center gap-1.5 rounded-lg bg-secondary px-2 py-1 text-[0.66rem] font-bold text-primary"><Check className="size-3" />{result.calculation.installments}x</div></div>
                      <div className="mt-5 flex items-end justify-between gap-2"><div><p className="micro-label text-[0.58rem] text-muted-foreground">parcela estimada</p><p className="mt-1 text-xl font-extrabold tracking-tight text-foreground">{formatCurrency(result.calculation.payment)}</p></div><ArrowDownRight className={`mb-1 size-5 ${index === 0 ? "text-primary" : "text-muted-foreground"}`} /></div>
                      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-border/60 pt-3"><div><dt className="text-[0.62rem] text-muted-foreground">Financiado</dt><dd className="mt-1 text-xs font-bold text-foreground">{formatCurrency(result.calculation.financedAmount)}</dd></div><div><dt className="text-[0.62rem] text-muted-foreground">Total pago</dt><dd className="mt-1 text-xs font-bold text-foreground">{formatCurrency(result.calculation.totalPaid)}</dd></div><div><dt className="text-[0.62rem] text-muted-foreground">CET est.</dt><dd className="mt-1 text-xs font-bold text-foreground">{formatRate(result.calculation.cetMonthly)}</dd></div></dl>
                    </article>;
                  })}
                  {unavailableRates.map(rate => <article key={rate.id} className="flex min-h-51 flex-col justify-between rounded-2xl border border-dashed border-border bg-muted/60 p-4"><div><p className="text-sm font-extrabold text-foreground">{rate.displayName}</p><p className="mt-0.5 text-[0.68rem] text-muted-foreground">{formatRate(rate.monthlyRate)}</p></div><div><p className="text-sm font-bold text-secondary-foreground">Parcela-alvo indisponível</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Não atinge o teto informado em até 84 meses. Aumente a entrada ou ajuste a parcela desejada.</p></div></article>)}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-border/80 bg-card/80 p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="micro-label text-[0.6rem] font-bold text-primary">sessão atual</p><h3 className="mt-1 text-sm font-extrabold text-foreground">Histórico recente</h3></div><Clock3 className="size-4 text-primary" /></div>{history.length === 0 ? <p className="mt-4 text-xs text-muted-foreground">Os próximos cálculos serão preservados aqui somente durante esta sessão.</p> : <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{history.map(item => <div key={item.id} className="rounded-xl bg-secondary px-3 py-2.5"><div className="flex items-center justify-between gap-2"><p className="text-xs font-bold text-foreground">{formatCurrency(item.vehicleValue)}</p><span className="rounded-md bg-card px-1.5 py-0.5 text-[0.58rem] font-bold text-primary">{item.leadingInstitution}</span></div><p className="mt-1 text-[0.65rem] text-muted-foreground">{item.leadingInstallments}x de {formatCurrency(item.leadingPayment)} · total {formatCurrency(item.leadingTotalPaid)}</p></div>)}</div>}</div>
          <div className="rounded-3xl border border-primary/40 bg-primary p-5 text-primary-foreground shadow-[0_16px_30px_rgba(18,59,58,0.14)]"><div className="flex items-center gap-2 text-primary-foreground/80"><Info className="size-4" /><span className="micro-label text-[0.58rem] font-bold">transparência</span></div><p className="mt-3 text-sm font-bold leading-5">CET estimado, não oferta bancária.</p><p className="mt-2 text-xs leading-5 text-primary-foreground/80">A taxa é uma média configurada. O resultado não inclui serviços ou tarifas que não tenham sido cadastrados pelo administrador.</p>{user?.role === "admin" && <Button variant="ghost" size="sm" onClick={() => logout()} className="mt-3 h-auto p-0 text-xs font-bold text-primary-foreground/80 hover:bg-transparent hover:text-primary-foreground"><LogOut className="mr-2 size-3.5" />Sair do painel</Button>}</div>
        </section>
      </main>
    </div>
  );
}
