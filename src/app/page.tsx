import { Overview } from "@/components/dashboard/Overview";
import { PasswordGate } from "@/components/auth/PasswordGate";

export default function OverviewPage() {
  return (
    <PasswordGate>
      <Overview />
    </PasswordGate>
  );
}
