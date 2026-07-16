export interface TokenOption {
  value: string;
  label: string;
  description: string;
}

export const CUSTOM_TOKEN_VALUE = "custom";

const KNOWN_TOKENS: TokenOption[] = [
  {
    value: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    label: "Aegis settlement token",
    description: "Default testnet settlement token used by this project.",
  },
];

export function getTokenOptions(): TokenOption[] {
  return [
    ...KNOWN_TOKENS,
    {
      value: CUSTOM_TOKEN_VALUE,
      label: "Custom address",
      description: "Enter another SEP-41 token contract ID.",
    },
  ];
}

export function resolveTokenLabel(address?: string | null): string {
  if (!address) return "Custom token";

  const match = KNOWN_TOKENS.find((token) => token.value === address);
  if (match) return `${match.label}`;

  return "Custom token";
}
