// © 2026 HGUARD Elite by Successpartner10. All rights reserved.
// Unauthorized copying, modification, or distribution is strictly prohibited.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
