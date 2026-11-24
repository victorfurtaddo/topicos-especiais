import { IconAlertCircle, IconInfoCircle } from "@tabler/icons-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function AppAlert({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  const Icon = error ? IconAlertCircle : IconInfoCircle;
  return (
    <Alert
      variant={error ? "destructive" : "default"}
      data-variant={error ? "destructive" : "default"}
      role={error ? "alert" : "status"}
    >
      <Icon aria-hidden />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
