export type CustomerProfile = {
  fullName: string;
  phone: string;
  address: string;
  governorate: string;
};

export const emptyCustomerProfile: CustomerProfile = {
  fullName: "",
  phone: "",
  address: "",
  governorate: "",
};

export function profileFromMetadata(value: unknown): CustomerProfile {
  const metadata = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const string = (key: string) => typeof metadata[key] === "string" ? metadata[key] as string : "";
  return {
    fullName: string("full_name"),
    phone: string("phone"),
    address: string("address"),
    governorate: string("governorate"),
  };
}

export function profileToMetadata(profile: CustomerProfile) {
  return {
    full_name: profile.fullName.trim(),
    phone: profile.phone.trim(),
    address: profile.address.trim(),
    governorate: profile.governorate.trim(),
  };
}
