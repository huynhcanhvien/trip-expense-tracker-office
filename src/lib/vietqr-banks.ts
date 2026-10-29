/** NAPAS BINs used in VietQR payloads. Names are what members recognise in banking apps. */
export type VietQrBank = { bin: string; shortName: string; name: string };

export const VIETQR_BANKS: readonly VietQrBank[] = [
  {
    bin: "970436",
    shortName: "Vietcombank",
    name: "Ngân hàng TMCP Ngoại thương Việt Nam",
  },
  {
    bin: "970415",
    shortName: "VietinBank",
    name: "Ngân hàng TMCP Công thương Việt Nam",
  },
  {
    bin: "970418",
    shortName: "BIDV",
    name: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam",
  },
  {
    bin: "970405",
    shortName: "Agribank",
    name: "Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam",
  },
  { bin: "970422", shortName: "MB Bank", name: "Ngân hàng TMCP Quân đội" },
  {
    bin: "970407",
    shortName: "Techcombank",
    name: "Ngân hàng TMCP Kỹ thương Việt Nam",
  },
  { bin: "970416", shortName: "ACB", name: "Ngân hàng TMCP Á Châu" },
  {
    bin: "970432",
    shortName: "VPBank",
    name: "Ngân hàng TMCP Việt Nam Thịnh Vượng",
  },
  { bin: "970423", shortName: "TPBank", name: "Ngân hàng TMCP Tiên Phong" },
  {
    bin: "970403",
    shortName: "Sacombank",
    name: "Ngân hàng TMCP Sài Gòn Thương Tín",
  },
  {
    bin: "970437",
    shortName: "HDBank",
    name: "Ngân hàng TMCP Phát triển TP. Hồ Chí Minh",
  },
  { bin: "970441", shortName: "VIB", name: "Ngân hàng TMCP Quốc tế Việt Nam" },
  { bin: "970443", shortName: "SHB", name: "Ngân hàng TMCP Sài Gòn – Hà Nội" },
  {
    bin: "970431",
    shortName: "Eximbank",
    name: "Ngân hàng TMCP Xuất Nhập khẩu Việt Nam",
  },
  { bin: "970426", shortName: "MSB", name: "Ngân hàng TMCP Hàng Hải Việt Nam" },
  { bin: "970448", shortName: "OCB", name: "Ngân hàng TMCP Phương Đông" },
  { bin: "970454", shortName: "BVBank", name: "Ngân hàng TMCP Bản Việt" },
  { bin: "970429", shortName: "SCB", name: "Ngân hàng TMCP Sài Gòn" },
  { bin: "970440", shortName: "SeABank", name: "Ngân hàng TMCP Đông Nam Á" },
  { bin: "970425", shortName: "ABBANK", name: "Ngân hàng TMCP An Bình" },
  { bin: "970409", shortName: "Bac A Bank", name: "Ngân hàng TMCP Bắc Á" },
  {
    bin: "970412",
    shortName: "PVcomBank",
    name: "Ngân hàng TMCP Đại Chúng Việt Nam",
  },
  {
    bin: "970430",
    shortName: "PGBank",
    name: "Ngân hàng TMCP Thịnh vượng và Phát triển",
  },
  { bin: "970419", shortName: "NCB", name: "Ngân hàng TMCP Quốc Dân" },
  { bin: "970428", shortName: "Nam A Bank", name: "Ngân hàng TMCP Nam Á" },
  {
    bin: "970400",
    shortName: "Saigonbank",
    name: "Ngân hàng TMCP Sài Gòn Công Thương",
  },
  { bin: "970427", shortName: "VietABank", name: "Ngân hàng TMCP Việt Á" },
  {
    bin: "970433",
    shortName: "Vietbank",
    name: "Ngân hàng TMCP Việt Nam Thương Tín",
  },
  { bin: "970438", shortName: "BaoViet Bank", name: "Ngân hàng TMCP Bảo Việt" },
  {
    bin: "970452",
    shortName: "KienlongBank",
    name: "Ngân hàng TMCP Kiên Long",
  },
  {
    bin: "970449",
    shortName: "LPBank",
    name: "Ngân hàng TMCP Lộc Phát Việt Nam",
  },
  {
    bin: "970406",
    shortName: "Vikki Bank",
    name: "Ngân hàng TNHH MTV Số Vikki (DongA Bank)",
  },
  {
    bin: "970414",
    shortName: "MBV",
    name: "Ngân hàng TNHH MTV Việt Nam Hiện Đại (OceanBank)",
  },
  {
    bin: "970408",
    shortName: "GPBank",
    name: "Ngân hàng TNHH MTV Dầu Khí Toàn Cầu",
  },
  {
    bin: "970444",
    shortName: "CBBank",
    name: "Ngân hàng TNHH MTV Xây dựng Việt Nam",
  },
  { bin: "970421", shortName: "VRB", name: "Ngân hàng Liên doanh Việt – Nga" },
  { bin: "970434", shortName: "Indovina", name: "Ngân hàng TNHH Indovina" },
  {
    bin: "970424",
    shortName: "Shinhan Bank",
    name: "Ngân hàng TNHH MTV Shinhan Việt Nam",
  },
  {
    bin: "970457",
    shortName: "Woori Bank",
    name: "Ngân hàng TNHH MTV Woori Việt Nam",
  },
  {
    bin: "970439",
    shortName: "Public Bank",
    name: "Ngân hàng TNHH MTV Public Việt Nam",
  },
  {
    bin: "970442",
    shortName: "Hong Leong",
    name: "Ngân hàng TNHH MTV Hong Leong Việt Nam",
  },
  {
    bin: "970410",
    shortName: "Standard Chartered",
    name: "Ngân hàng TNHH MTV Standard Chartered Việt Nam",
  },
  {
    bin: "970458",
    shortName: "UOB",
    name: "Ngân hàng United Overseas Bank Việt Nam",
  },
  {
    bin: "970446",
    shortName: "Co-opBank",
    name: "Ngân hàng Hợp tác xã Việt Nam",
  },
  {
    bin: "422589",
    shortName: "CIMB",
    name: "Ngân hàng TNHH MTV CIMB Việt Nam",
  },
  { bin: "546034", shortName: "CAKE", name: "CAKE by VPBank" },
  { bin: "546035", shortName: "Ubank", name: "Ubank by VPBank" },
  { bin: "963388", shortName: "Timo", name: "Timo by BVBank" },
  { bin: "971005", shortName: "Viettel Money", name: "Viettel Money" },
  { bin: "971011", shortName: "VNPT Money", name: "VNPT Money" },
];

const byBin = new Map(VIETQR_BANKS.map((bank) => [bank.bin, bank]));
const fold = (value: string) => value.trim().toLowerCase().replace(/\s+/g, "");

export const bankByBin = (
  bin: string | null | undefined,
): VietQrBank | undefined => (bin ? byBin.get(bin) : undefined);

/** Abbreviations members commonly type instead of the bank's short name. */
const ALIASES: Readonly<Record<string, string>> = {
  vcb: "970436",
  ctg: "970415",
  vietin: "970415",
  bid: "970418",
  mb: "970422",
  tcb: "970407",
  vpb: "970432",
  tpb: "970423",
  stb: "970403",
  hdb: "970437",
  eib: "970431",
  lpb: "970449",
  seab: "970440",
};

/** Matches the short name, full name or a common abbreviation, ignoring case and spacing. */
export function bankByName(name: string): VietQrBank | undefined {
  const key = fold(name);
  if (!key) return undefined;
  return (
    VIETQR_BANKS.find(
      (bank) => fold(bank.shortName) === key || fold(bank.name) === key,
    ) ?? bankByBin(ALIASES[key])
  );
}

/** Profiles saved before BINs existed only have a bank name; derive the BIN from it. */
export function resolveBankBin(bank: {
  bank_bin: string | null;
  bank_name: string;
}): string | null {
  return bank.bank_bin || bankByName(bank.bank_name)?.bin || null;
}
