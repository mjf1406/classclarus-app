export function accountDeleteConfirmationPhrase(email: string | undefined | null): string {
  const trimmed = email?.trim();
  if (trimmed) {
    return `delete ${trimmed}`;
  }
  return "delete my account";
}

export function providerDisplayName(provider: string): string {
  switch (provider) {
    case "google":
      return "Google";
    case "password":
      return "Password";
    default:
      return provider.charAt(0).toUpperCase() + provider.slice(1);
  }
}
