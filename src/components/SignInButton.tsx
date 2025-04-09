/** @format */
import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button"; // Adjust the import as needed

// Construct the auth URL using environment variables
const authUrl = `/auth/sign-in?after_sign_in_url=${encodeURIComponent(
  process.env.NEXT_PUBLIC_AFTER_SIGN_IN_URL ?? "http://localhost:3000/classes",
)}&after_sign_up_url=${encodeURIComponent(
  process.env.NEXT_PUBLIC_AFTER_SIGN_UP_URL ?? "http://localhost:3000/classes",
)}&redirect_url=${encodeURIComponent(
  process.env.NEXT_PUBLIC_REDIRECT_URL ?? "http://localhost:3000/",
)}`;

interface SignInButtonProps {
  className?: string;
  variant?:
    | "default"
    | "link"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | null
    | undefined; // Adjust if you use multiple variants from ShadCN
}

export const SignInButton: React.FC<SignInButtonProps> = ({
  className = "",
  variant = "default",
}) => {
  return (
    <Link href={authUrl} passHref>
      <Button variant={variant} className={`h-10 cursor-pointer ${className}`}>
        Sign In
      </Button>
    </Link>
  );
};
