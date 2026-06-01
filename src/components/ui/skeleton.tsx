// © 2026 HGUARD Elite by Successpartner10. All rights reserved.
// Unauthorized copying, modification, or distribution is strictly prohibited.
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

export { Skeleton };
