"use client";

import { useState } from "react";
import type { TransactionPreview } from "@/lib/stellar/client";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useEscrowActions } from "@/hooks/use-escrows";
import { useWallet } from "@/hooks/use-wallet";
import { useSettingsStore } from "@/stores/settings-store";
import { config } from "@/lib/stellar/config";
import { parseAmount, formatAmount } from "@/lib/format";
import { CUSTOM_TOKEN_VALUE, getTokenOptions, resolveTokenLabel } from "@/lib/stellar/tokens";

const STELLAR_ADDR = /^[GC][A-Z2-7]{55}$/;
const addr = z.string().regex(STELLAR_ADDR, "Enter a valid Stellar address");
const amount = z
  .string()
  .min(1, "Required")
  .refine((v) => {
    try {
      return parseAmount(v) > 0n;
    } catch {
      return false;
    }
  }, "Enter a positive amount");

const deadline = z
  .string()
  .min(1, "Pick a deadline")
  .refine((value) => {
    if (!value) return false;
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime()) && parsed.getTime() > Date.now();
  }, "Pick a deadline in the future");

export const schema = z.object({
  title: z.string().min(3, "At least 3 characters").max(64),
  seller: addr,
  arbiter: addr,
  token: addr,
  deadline,
  milestones: z
    .array(z.object({ description: z.string().min(1, "Required"), amount }))
    .min(1, "Add at least one milestone"),
});

type FormValues = z.infer<typeof schema>;

export function CreateEscrowDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<TransactionPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const { address, isConnected } = useWallet();
  const actions = useEscrowActions();
  const defaultArbiter = useSettingsStore((s) => s.defaultArbiter);
  const preferredToken = useSettingsStore((s) => s.preferredTokenId);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      seller: "",
      arbiter: defaultArbiter,
      token: preferredToken || config.defaultTokenId,
      deadline: "",
      milestones: [{ description: "", amount: "" }],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "milestones",
  });

  const milestones = form.watch("milestones");
  const tokenValue = form.watch("token");
  const selectedToken = tokenValue && getTokenOptions().some((option) => option.value === tokenValue)
    ? tokenValue
    : CUSTOM_TOKEN_VALUE;
  const tokenHint = resolveTokenLabel(tokenValue);
  const total = milestones.reduce((sum, m) => {
    try {
      return sum + parseAmount(m.amount || "0");
    } catch {
      return sum;
    }
  }, 0n);

  async function onSubmit(values: FormValues) {
    if (!address) return;

    const deadlineDate = new Date(values.deadline);
    if (Number.isNaN(deadlineDate.getTime()) || deadlineDate.getTime() <= Date.now()) {
      form.setError("deadline", { type: "validate", message: "Pick a deadline in the future" });
      return;
    }

    const deadlineSec = BigInt(Math.floor(deadlineDate.getTime() / 1000));
    const params = {
      buyer: address,
      seller: values.seller,
      arbiter: values.arbiter,
      token: values.token,
      title: values.title,
      deadline: deadlineSec,
      milestones: values.milestones.map((m) => ({
        description: m.description,
        amount: parseAmount(m.amount),
        released: false,
      })),
    };

    setPreviewLoading(true);
    setPreview(null);

    try {
      const nextPreview = await actions.previewCreateEscrow(params);
      setPreview(nextPreview);
      await actions.createEscrow(params);
      form.reset();
      setPreview(null);
      setOpen(false);
    } catch {
      /* surfaced by toast */
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button disabled={!isConnected}>
            <Plus className="mr-2 h-4 w-4" /> New escrow
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create escrow</DialogTitle>
          <DialogDescription>
            Funds are locked from your wallet on creation and released milestone by milestone.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Title" error={form.formState.errors.title?.message}>
            <Input placeholder="Logo design for Acme" {...form.register("title")} />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Seller address" error={form.formState.errors.seller?.message}>
              <Input placeholder="G…" {...form.register("seller")} />
            </Field>
            <Field label="Arbiter address" error={form.formState.errors.arbiter?.message}>
              <Input placeholder="G…" {...form.register("arbiter")} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Token (SAC)" error={form.formState.errors.token?.message}>
              <div className="space-y-2">
                <Select
                  value={selectedToken}
                  onValueChange={(value) => {
                    if (value === CUSTOM_TOKEN_VALUE) {
                      form.setValue("token", tokenValue || preferredToken || config.defaultTokenId, {
                        shouldValidate: true,
                      });
                      return;
                    }
                    form.setValue("token", value, { shouldValidate: true });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a token" />
                  </SelectTrigger>
                  <SelectContent>
                    {getTokenOptions().map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="C…"
                  {...form.register("token")}
                  value={tokenValue || ""}
                  onChange={(event) => form.setValue("token", event.target.value, { shouldValidate: true })}
                />
                <p className="text-xs text-muted-foreground">
                  {tokenHint === "Custom token"
                    ? "Enter a SEP-41 token contract address or pick a known preset."
                    : `Using ${tokenHint}.`}
                </p>
              </div>
            </Field>
            <Field label="Deadline" error={form.formState.errors.deadline?.message}>
              <Input type="datetime-local" {...form.register("deadline")} />
            </Field>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Milestones</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => append({ description: "", amount: "" })}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Add
              </Button>
            </div>
            {fields.map((field, i) => (
              <div key={field.id} className="flex items-start gap-2">
                <div className="flex-1">
                  <Input
                    placeholder={`Milestone ${i + 1} description`}
                    {...form.register(`milestones.${i}.description`)}
                  />
                  {form.formState.errors.milestones?.[i]?.description && (
                    <p className="mt-1 text-xs text-destructive">
                      {form.formState.errors.milestones[i]?.description?.message}
                    </p>
                  )}
                </div>
                <div className="w-28">
                  <Input
                    placeholder="0.00"
                    inputMode="decimal"
                    {...form.register(`milestones.${i}.amount`)}
                  />
                  {form.formState.errors.milestones?.[i]?.amount && (
                    <p className="mt-1 text-xs text-destructive">
                      {form.formState.errors.milestones[i]?.amount?.message}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="mt-0.5 text-muted-foreground"
                  disabled={fields.length === 1}
                  onClick={() => remove(i)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {typeof form.formState.errors.milestones?.message === "string" && (
              <p className="text-xs text-destructive">
                {form.formState.errors.milestones.message}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3 text-sm">
            <span className="text-muted-foreground">Total to lock</span>
            <span className="text-lg font-semibold">{formatAmount(total)}</span>
          </div>

          {preview && (
            <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">Estimated transaction preview</span>
                <span className="text-xs text-muted-foreground">Before wallet confirmation</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>
                  <div className="font-medium text-foreground">Fee</div>
                  <div>{formatAmount(BigInt(preview.estimatedFee))} XLM</div>
                </div>
                <div>
                  <div className="font-medium text-foreground">Resource fee</div>
                  <div>{formatAmount(BigInt(preview.resourceFee))} XLM</div>
                </div>
                <div>
                  <div className="font-medium text-foreground">Read bytes</div>
                  <div>{preview.readBytes}</div>
                </div>
                <div>
                  <div className="font-medium text-foreground">Write bytes</div>
                  <div>{preview.writeBytes}</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {preview.instructions} instructions • {preview.footprintEntries} footprint entries
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="submit" disabled={form.formState.isSubmitting || !isConnected || previewLoading}>
              {(form.formState.isSubmitting || previewLoading) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create & lock funds
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
