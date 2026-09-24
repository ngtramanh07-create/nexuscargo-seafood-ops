import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { isPublicDemoMode } from "@/lib/data-source";

export default function LoginPage() {
  if (isPublicDemoMode()) redirect("/");
  return <LoginForm />;
}
