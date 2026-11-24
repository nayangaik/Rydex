export type TabType = "kyc" | "vendor" | "vehicle";

export interface Stats {
  totalVendors: number;
  approved: number;
  pending: number;
  rejected: number;
}
