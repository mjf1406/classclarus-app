import {
  CN,
  DE,
  ES,
  FR,
  GB,
  IT,
  JP,
  KR,
  NL,
  PT,
  RU,
  TH,
  TW,
  UA,
  US,
} from "country-flag-icons/react/3x2";

const FLAG_COMPONENTS = {
  CN,
  DE,
  ES,
  FR,
  GB,
  IT,
  JP,
  KR,
  NL,
  PT,
  RU,
  TH,
  TW,
  UA,
  US,
} as const;

type LanguageFlagProps = {
  countryCode: keyof typeof FLAG_COMPONENTS;
};

export function LanguageFlag({ countryCode }: LanguageFlagProps) {
  const Flag = FLAG_COMPONENTS[countryCode];

  return <Flag aria-hidden="true" className="h-4 w-auto shrink-0" focusable="false" />;
}
