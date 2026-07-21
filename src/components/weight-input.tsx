import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { Scale } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Campo de peso preparado para integração futura com balanças eletrônicas.
 * Toda a operação usa este componente para que a substituição por leitura
 * automática seja transparente. Aceita entrada manual + hook `onScale`.
 */
export interface WeightInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "value" | "type"> {
  value: number | string;
  onChange: (value: number) => void;
  onScale?: () => void;
  className?: string;
  digits?: number;
  large?: boolean;
}

export const WeightInput = forwardRef<HTMLInputElement, WeightInputProps>(function WeightInput(
  { value, onChange, onScale, className, digits = 3, large, ...rest }: WeightInputProps,
  ref,
) {
  return (
    <div className={cn("relative flex items-center gap-2", className)}>
      <Input
        ref={ref}
        type="number"
        inputMode="decimal"
        step={digits === 3 ? "0.001" : "0.01"}
        value={value === 0 || value === "" ? "" : String(value)}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className={cn("font-mono pr-14", large ? "h-14 text-2xl" : "h-11")}
        placeholder="0,000"
        {...rest}
      />
      <span
        className={cn(
          "absolute right-11 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground pointer-events-none",
          large && "text-sm right-14",
        )}
      >
        kg
      </span>
      <button
        type="button"
        onClick={onScale}
        title="Ler da balança (em breve)"
        className={cn(
          "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-muted-foreground hover:text-primary transition-colors",
          !onScale && "opacity-40 cursor-not-allowed",
        )}
        disabled={!onScale}
      >
        <Scale className="size-4" />
      </button>
    </div>
  );
});
